import type { PageServerLoad } from './$types';
import { superValidate } from 'sveltekit-superforms';
import { zod4 as zod } from 'sveltekit-superforms/adapters';
import { loginSchema } from '#lib/login-schema.ts';

export const load: PageServerLoad = async ({ locals }) => {
	return {
		form: await superValidate(zod(loginSchema)),
		authed: !!locals.session
	};
};
