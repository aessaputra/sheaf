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
		schema: (value): string | undefined => {
			if (!value?.trim()) return undefined;
			return value.replace(/\/+$/, '');
		},
		description: 'Canonical Pocket ID base URL, e.g. https://id.aes.my.id. Empty disables OIDC.'
	},
	OIDC_CLIENT_ID: {
		schema: (value): string | undefined => {
			if (!value?.trim()) return undefined;
			return value as string;
		},
		description: 'OAuth client ID registered in Pocket ID. Empty disables OIDC.'
	},
	OIDC_CLIENT_SECRET: {
		schema: (value): string | undefined => {
			if (!value?.trim()) return undefined;
			return value as string;
		},
		description: 'OAuth client secret from Pocket ID. Empty disables OIDC.'
	},
	OIDC_REDIRECT_URI: {
		schema: (value): string | undefined => {
			if (!value?.trim()) return undefined;
			return value as string;
		},
		description:
			'Exact callback URL registered in Pocket ID, e.g. https://sheaf.example.workers.dev/api/auth/oidc/callback.'
	},
	OIDC_ALLOWED_EMAILS: {
		schema: (value): string | undefined => {
			if (!value?.trim()) return undefined;
			return value as string;
		},
		description: 'Comma-separated emails allowed to sign in via OIDC. Empty means no email allowlist.'
	},
	OIDC_ALLOWED_SUBS: {
		schema: (value): string | undefined => {
			if (!value?.trim()) return undefined;
			return value as string;
		},
		description:
			'Comma-separated Pocket ID sub values allowed to sign in via OIDC. Empty means no sub allowlist.'
	}
});
