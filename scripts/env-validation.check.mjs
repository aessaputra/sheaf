// Run: node scripts/env-validation.check.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { defineEnvVars } from '@sveltejs/kit/env';
import { validate, handle_issues } from '../node_modules/@sveltejs/kit/src/exports/internal/env.js';

const source = readFileSync(new URL('../src/env.ts', import.meta.url), 'utf8');
function check(building, values) {
	const context = { building, defineEnvVars };
	vm.createContext(context);
	vm.runInContext(
		ts.transpile(
			source
				.replace(/^import .*;$/gm, '')
				.replace('export const variables', 'globalThis.variables'),
			{ target: ts.ScriptTarget.ES2022 }
		),
		context
	);
	const issues = {};
	const result = {};
	for (const name of Object.keys(context.variables)) {
		result[name] = validate(context.variables, values[name], name, issues);
	}
	handle_issues(issues);
	return result;
}

const oidcEmpty = {
	OIDC_TOKEN_ENDPOINT_AUTH_METHOD: undefined,
	OIDC_ISSUER: undefined,
	OIDC_CLIENT_ID: undefined,
	OIDC_CLIENT_SECRET: undefined,
	OIDC_REDIRECT_URI: undefined,
	OIDC_ALLOWED_EMAILS: undefined,
	OIDC_ALLOWED_SUBS: undefined
};
assert.deepEqual(check(true, {}), {
	ADMIN_PASSWORD: undefined,
	SESSION_SECRET: undefined,
	...oidcEmpty
});
const valid = { ADMIN_PASSWORD: 'synthetic-admin-password', SESSION_SECRET: 's'.repeat(32) };
assert.deepEqual(check(false, valid), { ...valid, ...oidcEmpty });
for (const name of Object.keys(valid)) {
	for (const value of [
		undefined,
		'',
		'   ',
		...(name === 'SESSION_SECRET' ? ['s'.repeat(31)] : [])
	]) {
		assert.throws(() => check(false, { ...valid, [name]: value }), /env_invalid/);
	}
}
console.log(
	'PASS: build accepts absent secrets; runtime rejects missing/invalid secrets and accepts valid values.'
);

const oidcValid = {
	OIDC_ISSUER: 'https://id.aes.my.id',
	OIDC_CLIENT_ID: 'sheaf',
	OIDC_CLIENT_SECRET: 'x'.repeat(32),
	OIDC_REDIRECT_URI: 'https://sheaf.example.workers.dev/api/auth/oidc/callback',
	OIDC_ALLOWED_EMAILS: 'admin@example.id',
	OIDC_ALLOWED_SUBS: ''
};
assert.deepEqual(check(true, {}).OIDC_ISSUER, undefined);
assert.deepEqual(check(false, { ...valid, ...oidcValid }).OIDC_ISSUER, 'https://id.aes.my.id');
for (const method of ['client_secret_basic', 'client_secret_post'])
	assert.equal(
		check(false, { ...valid, OIDC_TOKEN_ENDPOINT_AUTH_METHOD: method })
			.OIDC_TOKEN_ENDPOINT_AUTH_METHOD,
		method
	);
assert.throws(
	() => check(false, { ...valid, OIDC_TOKEN_ENDPOINT_AUTH_METHOD: 'invalid' }),
	/env_invalid/
);
// Issuer identity includes a significant path trailing slash.
assert.equal(
	check(false, { ...valid, ...oidcValid, OIDC_ISSUER: 'https://auth.example.com/tenant/' })
		.OIDC_ISSUER,
	'https://auth.example.com/tenant/'
);
