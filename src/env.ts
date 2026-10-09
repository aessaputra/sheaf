import { defineEnvVars } from '@sveltejs/kit/env';
import { building } from '$app/env';

export const variables = defineEnvVars({
	ADMIN_PASSWORD: {
		schema: (value): string => {
			if (!building && !value?.trim()) throw new Error('Expected a non-empty admin password.');
			// Build analysis never authenticates; runtime validation guarantees a string.
			return value as string;
		},
		description: 'Single admin password for /admin login. Set a long random value in production.'
	},
	SESSION_SECRET: {
		schema: (value): string => {
			if (!building && (!value?.trim() || value.length < 32)) {
				throw new Error('Expected a session secret of at least 32 characters.');
			}
			return value as string;
		},
		description:
			'Secret used to sign the admin session cookie. 32+ random characters in production.'
	},
	OIDC_ISSUER: {
		schema: (value): string | undefined => (value?.trim() ? value : undefined),
		description: 'Canonical OIDC issuer URL, e.g. https://auth.example.com. Empty disables OIDC.'
	},
	OIDC_CLIENT_ID: {
		schema: (value): string | undefined => (value?.trim() ? value : undefined),
		description: 'OAuth client ID registered with the OIDC provider. Empty disables OIDC.'
	},
	OIDC_CLIENT_SECRET: {
		schema: (value): string | undefined => (value?.trim() ? value : undefined),
		description: 'OAuth client secret from the OIDC provider. Empty disables OIDC.'
	},
	OIDC_TOKEN_ENDPOINT_AUTH_METHOD: {
		schema: (value): 'client_secret_basic' | 'client_secret_post' | undefined => {
			if (!value?.trim()) return undefined;
			if (value !== 'client_secret_basic' && value !== 'client_secret_post')
				throw new Error('Expected client_secret_basic or client_secret_post.');
			return value;
		},
		description: 'Registered token endpoint authentication method. Defaults to client_secret_basic.'
	},
	OIDC_REDIRECT_URI: {
		schema: (value): string | undefined => (value?.trim() ? value : undefined),
		description:
			'Exact callback URL registered with the OIDC provider, e.g. https://sheaf.example.workers.dev/api/auth/oidc/callback.'
	},
	OIDC_ALLOWED_EMAILS: {
		schema: (value): string | undefined => (value?.trim() ? value : undefined),
		description:
			'Comma-separated emails allowed to sign in via OIDC. Empty means no email allowlist.'
	},
	OIDC_ALLOWED_SUBS: {
		schema: (value): string | undefined => (value?.trim() ? value : undefined),
		description:
			'Comma-separated OIDC subject (sub) values allowed to sign in via OIDC. Empty means no sub allowlist.'
	}
});
