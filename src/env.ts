import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
	ADMIN_PASSWORD: {
		description: 'Single admin password for /admin login. Set a long random value in production.'
	},
	SESSION_SECRET: {
		description:
			'Secret used to sign the admin session cookie. 32+ random characters in production.'
	}
});
