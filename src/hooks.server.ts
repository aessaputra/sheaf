import type { Handle } from '@sveltejs/kit/hooks';
import { SESSION_SECRET } from '$app/env/private';
import { COOKIE_NAME, verifySessionToken } from '#lib/server/session.ts';

const PUBLIC_API = new Set(['/api/login', '/api/logout']);

export const handle: Handle = async ({ event, resolve }) => {
	const authed = await verifySessionToken(event.cookies.get(COOKIE_NAME), SESSION_SECRET);
	event.locals.session = authed ? { authed: true } : null;

	const path = event.url.pathname;
	if (event.locals.session) return resolve(event);

	const isAdmin = path === '/admin' || path.startsWith('/admin/');
	if (isAdmin) return resolve(event); // /admin serves its own login card when logged out.
	if (path.startsWith('/api/') && !PUBLIC_API.has(path)) {
		return new Response('Unauthorized', { status: 401 });
	}
	return resolve(event);
};
