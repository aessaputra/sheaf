import type { Handle } from '@sveltejs/kit/hooks';
import { SESSION_SECRET } from '$app/env/private';
import { verifySessionCookie } from '#lib/server/session.ts';

const PUBLIC_PREFIXES = ['/', '/v/', '/api/login', '/api/logout'];

export const handle: Handle = async ({ event, resolve }) => {
	const authed = await verifySessionCookie(event.request.headers.get('cookie'), SESSION_SECRET);
	event.locals.session = authed ? { authed: true } : null;

	const path = event.url.pathname;
	const needsAuth =
		path.startsWith('/admin') || (path.startsWith('/api/') && !PUBLIC_PREFIXES.includes(path));
	if (needsAuth && !authed) {
		if (path.startsWith('/api/')) return new Response('Unauthorized', { status: 401 });
		const login = new URL('/admin', event.url);
		login.searchParams.set('next', path);
		return Response.redirect(login, 302);
	}
	return resolve(event);
};
