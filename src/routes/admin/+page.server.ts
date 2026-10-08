import type { PageServerLoad } from './$types';
import { superValidate } from 'sveltekit-superforms';
import { zod4 as zod } from 'sveltekit-superforms/adapters';
import { loginSchema } from '#lib/login-schema.ts';
import { getOidcConfig } from '#lib/server/oidc.ts';
import { dev } from '$app/env';
import * as env from '$app/env/private';

export const load: PageServerLoad = async ({ locals, url }) => {
	return {
		form: await superValidate(zod(loginSchema)),
		authed: !!locals.session,
		oidcEnabled: !!getOidcConfig(env, dev),
		oidcError: url.searchParams.get('error')
	};
};
