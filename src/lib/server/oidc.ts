export function parseAllowlist(value: string | undefined): string[] {
	if (!value) return [];
	const seen = new Set<string>();
	for (const part of value.split(',')) {
		const v = part.trim().toLowerCase();
		if (v) seen.add(v);
	}
	return [...seen];
}

export function isOidcAllowed(args: {
	email?: unknown;
	email_verified?: unknown;
	sub?: unknown;
	allowedEmails?: string;
	allowedSubs?: string;
}): boolean {
	const emails = parseAllowlist(args.allowedEmails);
	const subs = (args.allowedSubs ?? '')
		.split(',')
		.map((sub) => sub.trim())
		.filter(Boolean);
	if (emails.length === 0 && subs.length === 0) return false; // fail closed
	if (
		args.email_verified === true &&
		typeof args.email === 'string' &&
		emails.includes(args.email.toLowerCase())
	)
		return true;
	if (typeof args.sub === 'string' && subs.includes(args.sub)) return true;
	return false;
}

export function validatedOidcUrl(value: string, allowLoopback = false): URL {
	if (!/^https?:\/\//i.test(value) || /[\s\\#]/.test(value)) throw new Error('Invalid OIDC URL');
	const url = new URL(value);
	const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
	if (
		(url.protocol !== 'https:' && !(allowLoopback && url.protocol === 'http:' && loopback)) ||
		url.username ||
		url.password ||
		url.hash
	)
		throw new Error('Invalid OIDC URL');
	return url;
}

export function oidcIssuerUrl(issuer: string, redirectUri: string, dev: boolean): URL {
	const url = validatedOidcUrl(issuer);
	if (issuer.includes('?')) throw new Error('Invalid issuer query');
	const redirect = validatedOidcUrl(redirectUri, dev);
	if (redirect.pathname !== '/api/auth/oidc/callback' || redirectUri.includes('?'))
		throw new Error('Invalid redirect callback');
	return url;
}

export function getOidcConfig(
	env: {
		OIDC_ISSUER?: string;
		OIDC_CLIENT_ID?: string;
		OIDC_CLIENT_SECRET?: string;
		OIDC_REDIRECT_URI?: string;
		SESSION_SECRET?: string;
		OIDC_ALLOWED_EMAILS?: string;
		OIDC_ALLOWED_SUBS?: string;
		OIDC_TOKEN_ENDPOINT_AUTH_METHOD?: string;
	},
	dev: boolean
) {
	const {
		OIDC_ISSUER: issuer,
		OIDC_CLIENT_ID: clientId,
		OIDC_CLIENT_SECRET: clientSecret,
		OIDC_REDIRECT_URI: redirectUri,
		SESSION_SECRET: sessionSecret
	} = env;
	const method = env.OIDC_TOKEN_ENDPOINT_AUTH_METHOD ?? 'client_secret_basic';
	if (
		!issuer?.trim() ||
		!clientId?.trim() ||
		!clientSecret?.trim() ||
		!redirectUri?.trim() ||
		!sessionSecret?.trim() ||
		!(
			parseAllowlist(env.OIDC_ALLOWED_EMAILS).length || parseAllowlist(env.OIDC_ALLOWED_SUBS).length
		) ||
		(method !== 'client_secret_basic' && method !== 'client_secret_post')
	)
		return undefined;
	try {
		return {
			issuer: oidcIssuerUrl(issuer, redirectUri, dev),
			issuerIdentifier: issuer,
			clientId,
			clientSecret,
			redirectUri,
			sessionSecret,
			method
		};
	} catch {
		return undefined;
	}
}

// Each phase includes fetch and body processing; the signal cancels I/O, not just waiting.
export async function withOidcDeadline<T>(
	operation: (signal: AbortSignal) => Promise<T>
): Promise<T> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(new Error('OIDC deadline exceeded')), 10_000);
	try {
		return await operation(controller.signal);
	} finally {
		clearTimeout(timer);
	}
}
