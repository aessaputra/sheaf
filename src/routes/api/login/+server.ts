import { env } from 'cloudflare:workers';
import type { RequestHandler } from './$types';
import { ADMIN_PASSWORD, SESSION_SECRET } from '$app/env/private';
import { COOKIE_NAME, MAX_AGE, createSessionToken, timingSafeEqual } from '#lib/server/session.ts';
import { limitBodyStream } from '#lib/server/body-limit.ts';

export const POST: RequestHandler = async ({ cookies, request, getClientAddress }) => {
	try {
		const { success } = await env.LOGIN_RATE_LIMITER.limit({ key: getClientAddress() });
		if (!success) {
			return Response.json(
				{ error: 'Too many login attempts. Try again later.' },
				{ status: 429, headers: { 'Retry-After': '60' } }
			);
		}
	} catch {
		console.error('Login rate limiter unavailable.');
		return Response.json({ error: 'Login temporarily unavailable.' }, { status: 503 });
	}
	const declaredSize = Number(request.headers?.get?.('content-length'));
	if (Number.isSafeInteger(declaredSize) && declaredSize > 1024)
		return Response.json({ error: 'Invalid request.' }, { status: 413 });
	const limited = limitBodyStream(request, 1024);
	const raw = await new Response(limited.stream).text().catch(() => null);
	if (limited.exceeded()) return Response.json({ error: 'Invalid request.' }, { status: 413 });
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
		return Response.json({ error: 'Invalid credentials.' }, { status: 401 });
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
