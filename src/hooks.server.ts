import type { Handle } from '@sveltejs/kit/hooks';
import { MAINTENANCE, SESSION_SECRET } from '$app/env/private';
import errorPage from './error.html?raw';
import { jsonError } from '#lib/server/http.ts';
import { COOKIE_NAME, verifySessionToken } from '#lib/server/session.ts';

const PUBLIC_API = new Set([
	'/api/login',
	'/api/logout',
	'/api/auth/oidc/start',
	'/api/auth/oidc/callback'
]);

const maintenancePage = () =>
	new Response(
		errorPage
			.replaceAll('%sveltekit.status%', '503')
			.replaceAll(
				'%sveltekit.error.message%',
				'Service temporarily unavailable. Please try again shortly.'
			),
		{
			status: 503,
			headers: {
				'content-type': 'text/html; charset=utf-8',
				'cache-control': 'no-store',
				'retry-after': '600'
			}
		}
	);

export const handle: Handle = async ({ event, resolve }) => {
	const path = event.url.pathname;

	if (MAINTENANCE) {
		if (path.startsWith('/api/'))
			return jsonError(503, 'Service temporarily unavailable.', { 'Retry-After': '600' });
		return maintenancePage();
	}

	const authed = await verifySessionToken(event.cookies.get(COOKIE_NAME), SESSION_SECRET);
	event.locals.session = authed ? { authed: true } : null;

	if (event.locals.session) return resolve(event);

	if (path.startsWith('/api/') && !PUBLIC_API.has(path)) {
		return jsonError(401, 'Unauthorized');
	}
	return resolve(event);
};
