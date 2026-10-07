import type { RequestHandler } from './$types';
import { COOKIE_NAME } from '#lib/server/session.ts';

export const POST: RequestHandler = async ({ cookies }) => {
	cookies.delete(COOKIE_NAME, { path: '/' });
	return Response.json({ ok: true });
};
