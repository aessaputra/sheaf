import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ADMIN_PASSWORD, SESSION_SECRET } from '$app/env/private';
import { createSessionCookie } from '#lib/server/session.ts';

function same(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return diff === 0;
}

export const POST: RequestHandler = async ({ request }) => {
	const body = (await request.json().catch(() => null)) as { password?: unknown } | null;
	if (typeof body?.password !== 'string' || !same(body.password, ADMIN_PASSWORD)) {
		return json({ error: 'Invalid credentials.' }, { status: 401 });
	}
	return json(
		{ ok: true },
		{
			headers: {
				'set-cookie': await createSessionCookie(
					SESSION_SECRET,
					new URL(request.url).protocol === 'https:'
				)
			}
		}
	);
};
