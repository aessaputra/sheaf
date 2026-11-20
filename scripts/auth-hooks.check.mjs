import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { moduleUrl } from './check-source.mjs';

const root = new URL('../', import.meta.url);
const secret = 'test-only-auth-hooks-secret';
async function transpile(path, replacements = []) {
	let source = await readFile(new URL(path, root), 'utf8');
	for (const [from, to] of replacements) {
		assert.ok(source.includes(from), `missing import in ${path}: ${from}`);
		source = source.replace(from, to);
	}
	return moduleUrl(source);
}
const sessionUrl = await transpile('src/lib/server/session.ts');
const httpUrl = await transpile('src/lib/server/http.ts');
const { COOKIE_NAME, createSessionToken } = await import(sessionUrl);
const hooksUrl = (maintenance) =>
	transpile('src/hooks.server.ts', [
		[
			"import errorPage from './error.html?raw';",
			`const errorPage = '<p class="status">%sveltekit.status%</p><h1>%sveltekit.error.message%</h1>';`
		],
		[
			"import { MAINTENANCE, SESSION_SECRET } from '$app/env/private';",
			`const MAINTENANCE = ${maintenance}; const SESSION_SECRET = ${JSON.stringify(secret)};`
		],
		["from '#lib/server/session.ts'", `from '${sessionUrl}'`],
		["from '#lib/server/http.ts'", `from '${httpUrl}'`]
	]);
const { handle } = await import(await hooksUrl(false));
async function invoke(path, token) {
	const event = {
		url: new URL(path, 'https://sheaf.example.test'),
		cookies: {
			get(name) {
				assert.equal(name, COOKIE_NAME);
				return token;
			}
		},
		locals: {}
	};
	let resolved = false;
	const response = await handle({
		event,
		resolve(received) {
			assert.equal(received, event);
			resolved = true;
			return new Response('resolved');
		}
	});
	return { status: response.status, resolved, session: event.locals.session };
}
const publicPaths = [
	'/api/auth/oidc/start',
	'/api/auth/oidc/callback',
	'/api/login',
	'/api/logout',
	'/',
	'/v/slug',
	'/admin',
	'/admin/settings'
];
for (const path of publicPaths) {
	assert.deepEqual(await invoke(path), { status: 200, resolved: true, session: null }, path);
}
for (const path of [
	'/api/files',
	'/api/files/slug',
	'/api/auth/oidc',
	'/api/auth/oidc/start/',
	'/api/auth/oidc/start/nested',
	'/api/auth/oidc/start-lookalike',
	'/api/auth/oidc/callback/',
	'/api/auth/oidc/callback/nested',
	'/api/auth/oidc/callback-lookalike'
]) {
	assert.deepEqual(await invoke(path), { status: 401, resolved: false, session: null }, path);
}
const token = await createSessionToken(secret);
for (const path of ['/api/files', '/api/files/slug']) {
	assert.deepEqual(await invoke(path, token), {
		status: 200,
		resolved: true,
		session: { authed: true }
	});
	for (const invalid of ['invalid', `${token}x`, await createSessionToken('wrong-secret')]) {
		assert.deepEqual(await invoke(path, invalid), { status: 401, resolved: false, session: null });
	}
}
console.log('Auth hooks checks passed: exact OIDC routes, auth boundaries, and real sessions');

const { handle: maintenanceHandle } = await import(await hooksUrl(true));
const maintenanceEvent = (path) => ({
	url: new URL(path, 'https://sheaf.example.test'),
	cookies: { get: () => null },
	locals: {}
});
for (const path of ['/', '/admin', '/v/slug']) {
	const response = await maintenanceHandle({
		event: maintenanceEvent(path),
		resolve() {
			assert.fail(`resolve must not run for ${path}`);
		}
	});
	assert.equal(response.status, 503, path);
	assert.equal(response.headers.get('retry-after'), '600', path);
	assert.equal(response.headers.get('cache-control'), 'no-store', path);
	assert.match(response.headers.get('content-type'), /^text\/html/, path);
	const body = await response.text();
	assert.ok(body.includes('503'), path);
	assert.ok(body.includes('Service temporarily unavailable. Please try again shortly.'), path);
	assert.ok(!body.includes('%sveltekit.'), path);
}
for (const path of ['/api/files', '/api/login']) {
	const response = await maintenanceHandle({
		event: maintenanceEvent(path),
		resolve() {
			assert.fail(`resolve must not run for ${path}`);
		}
	});
	assert.equal(response.status, 503, path);
	assert.equal(response.headers.get('retry-after'), '600', path);
	assert.deepEqual(await response.json(), {
		status: 503,
		message: 'Service temporarily unavailable.'
	});
}
console.log(
	'Maintenance checks passed: pages return HTML 503 with Retry-After, API returns JSON 503'
);
