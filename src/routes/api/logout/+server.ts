import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { clearSessionCookie } from '#lib/server/session.ts';

export const POST: RequestHandler = async ({ request }) => {
	const secure = new URL(request.url).protocol === 'https:';
	return json({ ok: true }, { headers: { 'set-cookie': clearSessionCookie(secure) } });
};
