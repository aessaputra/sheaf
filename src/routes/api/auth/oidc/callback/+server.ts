import type { RequestHandler } from './$types';
import * as env from '$app/env/private';
import { dev } from '$app/env';
import * as oauth from 'oauth4webapi';
import { isOidcAllowed, getOidcConfig, withOidcDeadline } from '#lib/server/oidc.ts';
import { OIDC_TRANSACTION_COOKIE, verifyOidcTransaction } from '#lib/server/oidc-transaction.ts';
import { COOKIE_NAME, MAX_AGE, createSessionToken } from '#lib/server/session.ts';

export const GET: RequestHandler = async ({ cookies, request, url }) => {
	const raw = cookies.get(OIDC_TRANSACTION_COOKIE);
	cookies.delete(OIDC_TRANSACTION_COOKIE, { path: '/' });
	const config = getOidcConfig(env, dev);
	if (!config) return new Response('OIDC not configured.', { status: 503 });
	const { issuer } = config;
	const saved = await verifyOidcTransaction(raw, config.sessionSecret);
	if (
		!saved ||
		url.searchParams.getAll('state').length !== 1 ||
		url.searchParams.get('state') !== saved.state ||
		url.searchParams.getAll('code').length !== 1 ||
		!url.searchParams.get('code')
	)
		return new Response('Invalid OIDC callback.', { status: 400 });
	const client: oauth.Client = { client_id: config.clientId, [oauth.clockTolerance]: 0 };
	let as: oauth.AuthorizationServer;
	try {
		as = await withOidcDeadline(async (signal) =>
			oauth.processDiscoveryResponse(issuer, await oauth.discoveryRequest(issuer, { signal }))
		);
		if (as.issuer !== config.issuerIdentifier) throw new Error('OIDC issuer mismatch');
	} catch {
		return new Response('OIDC discovery failed.', { status: 502 });
	}
	let params: URLSearchParams;
	try {
		params = oauth.validateAuthResponse(as, client, url.searchParams, saved.state);
	} catch {
		return new Response('Invalid OIDC callback.', { status: 400 });
	}
	let claims: oauth.IDToken | undefined;
	try {
		const methods = as.token_endpoint_auth_methods_supported ?? ['client_secret_basic'];
		if (!methods.includes(config.method)) throw new Error('Unsupported client authentication');
		const auth =
			config.method === 'client_secret_basic'
				? oauth.ClientSecretBasic(config.clientSecret)
				: oauth.ClientSecretPost(config.clientSecret);
		const { response, tokens } = await withOidcDeadline(async (signal) => {
			const response = await oauth.authorizationCodeGrantRequest(
				as,
				client,
				auth,
				params,
				config.redirectUri,
				saved.verifier,
				{ signal }
			);
			const tokens = await oauth.processAuthorizationCodeResponse(as, client, response, {
				expectedNonce: saved.nonce,
				requireIdToken: true
			});
			return { response, tokens };
		});
		await withOidcDeadline((signal) =>
			oauth.validateApplicationLevelSignature(as, response, { signal })
		);
		claims = oauth.getValidatedIdTokenClaims(tokens);
		if (!claims?.sub) throw new Error('Missing subject');
	} catch {
		return new Response('OIDC login failed.', { status: 502 });
	}
	if (
		!isOidcAllowed({
			email: claims.email,
			email_verified: claims.email_verified,
			sub: claims.sub,
			allowedEmails: env.OIDC_ALLOWED_EMAILS,
			allowedSubs: env.OIDC_ALLOWED_SUBS
		})
	)
		return Response.redirect(new URL('/admin?error=forbidden', url.origin), 302);
	cookies.set(COOKIE_NAME, await createSessionToken(config.sessionSecret), {
		path: '/',
		maxAge: MAX_AGE,
		httpOnly: true,
		sameSite: 'lax',
		secure: new URL(request.url).protocol === 'https:'
	});
	return Response.redirect(new URL('/admin', url.origin), 302);
};
