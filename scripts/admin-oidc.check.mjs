import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { moduleUrl } from './check-source.mjs';
import { compile } from 'svelte/compiler';

const root = new URL('../', import.meta.url);
const helperUrl = moduleUrl(await readFile(new URL('src/lib/server/oidc.ts', root), 'utf8'));
const server = await readFile(new URL('src/routes/admin/+page.server.ts', root), 'utf8');
const config = {
	OIDC_ISSUER: 'https://pocket.example.test',
	OIDC_CLIENT_ID: 'test-client-id',
	OIDC_CLIENT_SECRET: 'test-client-secret',
	OIDC_REDIRECT_URI: 'https://sheaf.example.test/api/auth/oidc/callback',
	OIDC_ALLOWED_EMAILS: 'admin@example.test',
	OIDC_ALLOWED_SUBS: '',
	SESSION_SECRET: 'fixture-session-secret',
	OIDC_TOKEN_ENDPOINT_AUTH_METHOD: undefined
};
const cases = [
	['complete', {}, true],
	['missing session secret', { SESSION_SECRET: '' }, false],
	['bad issuer', { OIDC_ISSUER: 'not a URL' }, false],
	['bad callback', { OIDC_REDIRECT_URI: 'https://sheaf.example.test/wrong' }, false],
	['bad method', { OIDC_TOKEN_ENDPOINT_AUTH_METHOD: 'invalid' }, false],
	['subject only', { OIDC_ALLOWED_EMAILS: '', OIDC_ALLOWED_SUBS: ' ExactSub ' }, true],
	...['OIDC_ISSUER', 'OIDC_CLIENT_ID', 'OIDC_CLIENT_SECRET', 'OIDC_REDIRECT_URI'].map((key) => [
		`missing ${key}`,
		{ [key]: '' },
		false
	]),
	['empty allowlists', { OIDC_ALLOWED_EMAILS: '', OIDC_ALLOWED_SUBS: '' }, false],
	['blank allowlists', { OIDC_ALLOWED_EMAILS: ' , , ', OIDC_ALLOWED_SUBS: '\t, ,\n' }, false],
	['password only', Object.fromEntries(Object.keys(config).map((key) => [key, ''])), false]
];
for (const [name, overrides, enabled] of cases) {
	const env = { ...config, ...overrides };
	const source = server
		.replace("import { dev } from '$app/env';", 'const dev = false;')
		.replace("import * as env from '$app/env/private';", `const env = ${JSON.stringify(env)};`)
		.replace("from '#lib/server/oidc.ts'", `from '${helperUrl}'`);
	const { load } = await import(moduleUrl(source));
	for (const session of [null, { authed: true }]) {
		for (const error of [null, 'forbidden']) {
			const url = new URL('https://sheaf.example.test/admin');
			if (error) url.searchParams.set('error', error);
			const result = await load({ locals: { session }, url });
			assert.deepEqual(result, { authed: !!session, oidcEnabled: enabled, oidcError: error }, name);
			for (const value of Object.values(env).filter(Boolean)) {
				assert.ok(!JSON.stringify(result).includes(value), `${name}: leaked configuration`);
			}
		}
	}
}
const component = await readFile(new URL('src/routes/admin/+page.svelte', root), 'utf8');
for (const generate of ['client', 'server']) {
	const compiled = compile(component, { filename: 'src/routes/admin/+page.svelte', generate });
	assert.equal(compiled.warnings.length, 0, JSON.stringify(compiled.warnings));
}
assert.match(
	component,
	/\{#if !authed\}[\s\S]*<form[\s\S]*Sign in[\s\S]*\{#if data\.oidcEnabled\}[\s\S]*href="\/api\/auth\/oidc\/start"[\s\S]*Sign in with OIDC[\s\S]*\{\/if\}[\s\S]*<\/form/
);
assert.match(
	component,
	/onMount\(\(\) => \{\s*if \(data\.oidcError === 'forbidden'\) toast\.error\('Account not authorized\.'\);\s*if \(authed\) void loadFiles\(\);/
);
assert.doesNotMatch(component, /Pocket\s*ID/i);
assert.match(component, /onsubmit=\{handleLogin\}/);
assert.match(component, /onclick=\{logout\}/);
console.log(
	`Admin OIDC checks passed: ${cases.length * 4} actual load cases, no config leaks, client/server compile and UI guards`
);
