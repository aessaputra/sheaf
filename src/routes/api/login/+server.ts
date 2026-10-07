import type { RequestHandler } from './$types';
import { ADMIN_PASSWORD, SESSION_SECRET } from '$app/env/private';
import { COOKIE_NAME, MAX_AGE, createSessionToken } from '#lib/server/session.ts';

function same(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return diff === 0;
}

export const POST: RequestHandler = async ({ cookies, request }) => {
	const body = (await request.json().catch(() => null)) as { password?: unknown } | null;
	if (typeof body?.password !== 'string' || !same(body.password, ADMIN_PASSWORD)) {
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
