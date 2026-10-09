import { env } from 'cloudflare:workers';
import type { RequestHandler } from './$types';
import { ADMIN_PASSWORD, SESSION_SECRET } from '$app/env/private';
import { COOKIE_NAME, MAX_AGE, createSessionToken, timingSafeEqual } from '#lib/server/session.ts';

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
	const body = (await request.json().catch(() => null)) as { password?: unknown } | null;
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
