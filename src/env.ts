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
	}
});
