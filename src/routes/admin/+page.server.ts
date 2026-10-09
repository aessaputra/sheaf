import type { PageServerLoad } from './$types';
import { getOidcConfig } from '#lib/server/oidc.ts';
import { dev } from '$app/env';
import * as env from '$app/env/private';

export const load: PageServerLoad = async ({ locals, url }) => {
	return {
		authed: !!locals.session,
		oidcEnabled: !!getOidcConfig(env, dev),
		oidcError: url.searchParams.get('error')
	};
};
