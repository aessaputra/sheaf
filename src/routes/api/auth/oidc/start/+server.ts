import type { RequestHandler } from './$types';
import * as env from '$app/env/private';
import { dev } from '$app/env';
import * as oauth from 'oauth4webapi';
import { getOidcConfig, withOidcDeadline, validatedOidcUrl } from '#lib/server/oidc.ts';
import {
	OIDC_TRANSACTION_COOKIE,
	OIDC_TRANSACTION_MAX_AGE,
	encodeOidcTransaction
} from '#lib/server/oidc-transaction.ts';

export const GET: RequestHandler = async ({ cookies, request }) => {
	const config = getOidcConfig(env, dev);
	if (!config) return new Response('OIDC not configured.', { status: 503 });
	const { issuer } = config;
	let url: URL;
	try {
		const as = await withOidcDeadline(async (signal) =>
			oauth.processDiscoveryResponse(issuer, await oauth.discoveryRequest(issuer, { signal }))
		);
		if (as.issuer !== config.issuerIdentifier) throw new Error('OIDC issuer mismatch');
		if (typeof as.authorization_endpoint !== 'string')
			throw new Error('Missing authorization endpoint');
		url = validatedOidcUrl(as.authorization_endpoint);
	} catch {
		console.error('OIDC failure', { stage: 'start-discovery', category: 'provider-or-metadata' });
		return new Response('OIDC discovery failed.', { status: 502 });
	}

	const state = oauth.generateRandomState();
	const nonce = oauth.generateRandomNonce();
	const verifier = oauth.generateRandomCodeVerifier();
	const challenge = await oauth.calculatePKCECodeChallenge(verifier);
	const payload = await encodeOidcTransaction({ state, nonce, verifier }, config.sessionSecret);

	url.searchParams.set('response_type', 'code');
	url.searchParams.set('client_id', config.clientId);
	url.searchParams.set('redirect_uri', config.redirectUri);
	url.searchParams.set('scope', 'openid profile email');
	url.searchParams.set('state', state);
	url.searchParams.set('nonce', nonce);
	url.searchParams.set('code_challenge', challenge);
	url.searchParams.set('code_challenge_method', 'S256');

	cookies.set(OIDC_TRANSACTION_COOKIE, payload, {
		path: '/',
		maxAge: OIDC_TRANSACTION_MAX_AGE,
		httpOnly: true,
		sameSite: 'lax',
		secure: new URL(request.url).protocol === 'https:'
	});
	// NOTE: never return Response.redirect() here. It produces an immutable
	// response and SvelteKit crashes attaching the transaction cookie
	// ("Can't modify immutable headers"). A plain 302 keeps headers mutable.
	return new Response(null, { status: 302, headers: { location: url.toString() } });
};
