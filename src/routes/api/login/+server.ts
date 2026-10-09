import type { RequestHandler } from './$types';
import { ADMIN_PASSWORD, SESSION_SECRET } from '$app/env/private';
import { COOKIE_NAME, MAX_AGE, createSessionToken, timingSafeEqual } from '#lib/server/session.ts';

export const POST: RequestHandler = async ({ cookies, request }) => {
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
