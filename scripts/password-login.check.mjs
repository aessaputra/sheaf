import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const root = new URL('../', import.meta.url);
const session = await import('../src/lib/server/session.ts');
const component = await readFile(new URL('src/routes/admin/+page.svelte', root), 'utf8');
const handler = component.match(
	/async function handleLogin\(event: SubmitEvent\) \{[\s\S]*?\n\t\}/
)?.[0];
assert.ok(handler);
assert.match(
	component,
	/<input[\s\S]*?type="password"[\s\S]*?\brequired\b[\s\S]*?bind:value=\{password\}/
);
for (const password of ['', 'synthetic-password']) {
	const calls = [];
	const run = new Function(
		'password',
		'fetch',
		'toast',
		'loadFiles',
		ts.transpile('let loggingIn = false; let authed = false;\n' + handler) +
			'; return handleLogin({ preventDefault() {} }).then(() => ({ password, loggingIn, authed }));'
	);
	const result = await run(
		password,
		async (url, options) => {
			calls.push({ url, body: JSON.parse(options.body) });
			return new Response('{}');
		},
		{ error: assert.fail },
		async () => {}
	);
	assert.deepEqual(calls, password ? [{ url: '/api/login', body: { password } }] : []);
	assert.deepEqual(result, { password: '', loggingIn: false, authed: !!password });
}

assert.equal(typeof session.timingSafeEqual, 'function', 'login must reuse the session comparator');
for (const [a, b, equal] of [
	['', '', true],
	['abc', 'abc', true],
	['abc', 'abd', false],
	['a', 'ab', false]
]) {
	assert.equal(session.timingSafeEqual(a, b), equal);
}
let source = await readFile(new URL('src/routes/api/login/+server.ts', root), 'utf8');
source = source
	.replace(
		"import { ADMIN_PASSWORD, SESSION_SECRET } from '$app/env/private';",
		"const ADMIN_PASSWORD = 'synthetic-password'; const SESSION_SECRET = 's'.repeat(32);"
	)
	.replace(
		"from '#lib/server/session.ts'",
		`from '${new URL('src/lib/server/session.ts', root).href}'`
	);
const { outputText } = ts.transpileModule(source, {
	compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext }
});
const { POST } = await import(
	`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
);
for (const body of [
	'{broken',
	'null',
	'{}',
	'{"password":42}',
	'{"password":"wrong"}',
	'{"password":"synthetic-password"}'
]) {
	const writes = [];
	const response = await POST({
		request: new Request('https://sheaf.example.test/api/login', { method: 'POST', body }),
		cookies: { set: (...args) => writes.push(args) }
	});
	const valid = body === '{"password":"synthetic-password"}';
	assert.equal(response.status, valid ? 200 : 401);
	assert.equal(writes.length, valid ? 1 : 0);
	if (valid) {
		assert.equal(writes[0][0], session.COOKIE_NAME);
		assert.equal(await session.verifySessionToken(writes[0][1], 's'.repeat(32)), true);
		assert.deepEqual(writes[0][2], {
			path: '/',
			maxAge: session.MAX_AGE,
			httpOnly: true,
			sameSite: 'lax',
			secure: true
		});
	}
}
console.log(
	'PASS: native password form, empty-submit guard, shared comparator and real login/session boundary.'
);
