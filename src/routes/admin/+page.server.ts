import type { PageServerLoad } from './$types';
import { getOidcConfig } from '#lib/server/oidc.ts';
import { listFiles } from '#lib/server/admin-files.ts';
import { env as cfEnv } from 'cloudflare:workers';
import { dev } from '$app/env';
import * as env from '$app/env/private';

export const load: PageServerLoad = async ({ locals, url, platform }) => {
	const authed = !!locals.session;
	return {
		authed,
		initialFiles: authed ? await listFiles((platform?.env ?? cfEnv).DB) : [],
		oidcEnabled: !!getOidcConfig(env, dev),
		oidcError: url.searchParams.get('error')
	};
};
