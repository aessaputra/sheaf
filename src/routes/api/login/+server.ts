import { env } from 'cloudflare:workers';
import type { RequestHandler } from './$types';
import { ADMIN_PASSWORD, SESSION_SECRET } from '$app/env/private';
import { COOKIE_NAME, MAX_AGE, createSessionToken, timingSafeEqual } from '#lib/server/session.ts';
import { jsonError } from '#lib/server/http.ts';
import { limitBodyStream } from '#lib/server/body-limit.ts';

export const POST: RequestHandler = async ({ cookies, request, getClientAddress }) => {
	try {
		const { success } = await env.LOGIN_RATE_LIMITER.limit({ key: getClientAddress() });
		if (!success) {
			return jsonError(429, 'Too many login attempts. Try again later.', { 'Retry-After': '60' });
		}
	} catch {
		console.error('Login rate limiter unavailable.');
		return jsonError(503, 'Login temporarily unavailable.');
	}
	const declaredSize = Number(request.headers?.get?.('content-length'));
	if (Number.isSafeInteger(declaredSize) && declaredSize > 1024)
		return jsonError(413, 'Invalid request.');
	const limited = limitBodyStream(request, 1024);
	const raw = await new Response(limited.stream).text().catch(() => null);
	if (limited.exceeded()) return jsonError(413, 'Invalid request.');
	let body: { password?: unknown } | null = null;
	if (raw) {
		try {
			const parsed: unknown = JSON.parse(raw);
			if (typeof parsed === 'object' && parsed !== null) body = parsed as { password?: unknown };
		} catch {
			body = null;
		}
	}
	if (typeof body?.password !== 'string' || !timingSafeEqual(body.password, ADMIN_PASSWORD)) {
		return jsonError(401, 'Invalid credentials.');
	}
	cookies.set(COOKIE_NAME, await createSessionToken(SESSION_SECRET), {
		path: '/',
		maxAge: MAX_AGE,
		httpOnly: true,
		sameSite: 'lax',
		secure: new URL(request.url).protocol === 'https:'
	});
	return Response.json({ ok: true });
};
