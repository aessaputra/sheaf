import type { RequestHandler } from './$types';
import { OIDC_CLIENT_ID, OIDC_ISSUER, OIDC_REDIRECT_URI } from '$app/env/private';
import * as oauth from 'oauth4webapi';
import { normalizeIssuer } from '#lib/server/oidc.ts';

const TEMP_COOKIE = 'sheaf_oidc';
const TEMP_MAX_AGE = 600; // 10 minutes

function b64urlEncode(bytes: Uint8Array): string {
	let s = '';
	for (const b of bytes) s += String.fromCharCode(b);
	return btoa(s).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

export const GET: RequestHandler = async ({ cookies, request }) => {
	if (!OIDC_ISSUER || !OIDC_CLIENT_ID || !OIDC_REDIRECT_URI) {
		return new Response('OIDC not configured.', { status: 503 });
	}

	const issuer = normalizeIssuer(OIDC_ISSUER);
	const as = await oauth
		.processDiscoveryResponse(new URL(issuer), await oauth.discoveryRequest(new URL(issuer)))
		.catch(() => null);
	if (!as?.authorization_endpoint) return new Response('OIDC discovery failed.', { status: 502 });

	const state = oauth.generateRandomState();
	const nonce = oauth.generateRandomNonce();
	const verifier = oauth.generateRandomCodeVerifier();
	const challenge = await oauth.calculatePKCECodeChallenge(verifier);

	const payload = b64urlEncode(
		new TextEncoder().encode(JSON.stringify({ state, nonce, verifier }))
	);

	cookies.set(TEMP_COOKIE, payload, {
		path: '/',
		maxAge: TEMP_MAX_AGE,
		httpOnly: true,
		sameSite: 'lax',
		secure: new URL(request.url).protocol === 'https:'
	});

	const url = new URL(as.authorization_endpoint);
	url.searchParams.set('response_type', 'code');
	url.searchParams.set('client_id', OIDC_CLIENT_ID);
	url.searchParams.set('redirect_uri', OIDC_REDIRECT_URI);
	url.searchParams.set('scope', 'openid profile email');
	url.searchParams.set('state', state);
	url.searchParams.set('nonce', nonce);
	url.searchParams.set('code_challenge', challenge);
	url.searchParams.set('code_challenge_method', 'S256');
	return Response.redirect(url.toString(), 302);
};
