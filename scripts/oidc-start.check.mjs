import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import * as oauth from 'oauth4webapi';

const root = new URL('../', import.meta.url);
let run = 0;
async function load(path, replacements = []) {
	let source = await readFile(new URL(path, root), 'utf8');
	for (const [from, to] of replacements) source = source.replace(from, to);
	const { outputText } = ts.transpileModule(source, {
		compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext }
	});
	return import(
		`data:text/javascript;base64,${Buffer.from(outputText + `\n// ${run++}`).toString('base64')}`
	);
}
const oidc = await load('src/lib/server/oidc.ts');
const config = {
	OIDC_ISSUER: 'https://id.example.test',
	OIDC_CLIENT_ID: 'sheaf',
	OIDC_CLIENT_SECRET: 'fixture-secret',
	OIDC_ALLOWED_EMAILS: 'admin@example.test',
	OIDC_ALLOWED_SUBS: '',
	OIDC_TOKEN_ENDPOINT_AUTH_METHOD: undefined,
	OIDC_REDIRECT_URI: 'https://sheaf.example.test/api/auth/oidc/callback',
	SESSION_SECRET: 'test-only-secret-not-used-in-production'
};
const transaction = await load('src/lib/server/oidc-transaction.ts');
async function invoke(overrides = {}, metadata = {}, dev = false, fetcher) {
	globalThis.__oidcCheck = { oidc, oauth, transaction, config: { ...config, ...overrides }, dev };
	globalThis.fetch =
		fetcher ??
		(async () =>
			Response.json({
				issuer: config.OIDC_ISSUER,
				authorization_endpoint: 'https://id.example.test/authorize',
				...metadata
			}));
	const { GET } = await load('src/routes/api/auth/oidc/start/+server.ts', [
		["import * as env from '$app/env/private';", 'const env = globalThis.__oidcCheck.config;'],
		["import { dev } from '$app/env';", 'const { dev } = globalThis.__oidcCheck;'],
		["import * as oauth from 'oauth4webapi';", 'const { oauth } = globalThis.__oidcCheck;'],
		[
			"import { getOidcConfig, withOidcDeadline, validatedOidcUrl } from '#lib/server/oidc.ts';",
			'const { getOidcConfig, withOidcDeadline, validatedOidcUrl } = globalThis.__oidcCheck.oidc;'
		],
		[
			/import \{[^}]+\} from '#lib\/server\/oidc-transaction.ts';/,
			'const { OIDC_TRANSACTION_COOKIE, OIDC_TRANSACTION_MAX_AGE, encodeOidcTransaction } = globalThis.__oidcCheck.transaction;'
		]
	]);
	const writes = [];
	const response = await GET({
		request: new Request('https://sheaf.example.test/api/auth/oidc/start'),
		cookies: { set: (...args) => writes.push(args) }
	});
	return { response, writes };
}
const originalFetch = globalThis.fetch;
try {
	for (const [configured, metadata] of [
		['https://auth.example.test', 'https://auth.example.test/'],
		['https://auth.example.test/', 'https://auth.example.test'],
		['https://auth.example.test/tenant', 'https://auth.example.test/tenant/'],
		['https://auth.example.test/tenant/', 'https://auth.example.test/tenant'],
		['https://AUTH.example.test', 'https://auth.example.test']
	]) {
		const { response, writes } = await invoke({ OIDC_ISSUER: configured }, { issuer: metadata });
		assert.equal(response.status, 502, `literal issuer mismatch: ${configured} != ${metadata}`);
		assert.equal(writes.length, 0);
	}
	for (const issuer of [
		'https://auth.example.test',
		'https://auth.example.test/',
		'https://auth.example.test/tenant',
		'https://auth.example.test/tenant/'
	]) {
		assert.equal(
			(await invoke({ OIDC_ISSUER: issuer }, { issuer })).response.status,
			302,
			`literal issuer match: ${issuer}`
		);
	}
	for (const overrides of [
		{ OIDC_CLIENT_SECRET: '' },
		{ OIDC_ALLOWED_EMAILS: ' , ', OIDC_ALLOWED_SUBS: '' },
		{ OIDC_TOKEN_ENDPOINT_AUTH_METHOD: 'invalid' }
	]) {
		assert.equal((await invoke(overrides)).response.status, 503);
	}
	assert.equal(
		(
			await invoke(
				{ OIDC_ISSUER: 'https://auth.example.com/tenant/' },
				{ issuer: 'https://auth.example.com/tenant/' }
			)
		).response.status,
		302
	);
	for (const value of [
		'not a URL',
		'http://id.example.test',
		'https://user:pass@id.example.test',
		'https://id.example.test/#fragment'
	]) {
		const { response, writes } = await invoke({ OIDC_ISSUER: value });
		assert.equal(response.status, 503, `issuer: ${value}`);
		assert.equal(writes.length, 0);
	}
	for (const value of [
		'not a URL',
		'http://sheaf.example.test/api/auth/oidc/callback',
		'javascript:alert(1)',
		'https://user:pass@sheaf.example.test/api/auth/oidc/callback',
		'https://sheaf.example.test/api/auth/oidc/callback#fragment',
		'https://sheaf.example.test/api/auth/oidc/callback#',
		'https:sheaf.example.test/api/auth/oidc/callback',
		'http://localhost:5173/api/auth/oidc/callback'
	]) {
		const { response, writes } = await invoke({ OIDC_REDIRECT_URI: value });
		assert.equal(response.status, 503, `redirect: ${value}`);
		assert.equal(writes.length, 0);
	}
	const invalidRedirects = [
		'https://sheaf.example.test/wrong-path',
		'https://sheaf.example.test/api/auth/oidc/callback/',
		`${config.OIDC_REDIRECT_URI}?extra=1`,
		`${config.OIDC_REDIRECT_URI}?`
	];
	const invalidRedirectResults = [];
	for (const value of invalidRedirects) {
		const { response, writes } = await invoke({ OIDC_REDIRECT_URI: value });
		invalidRedirectResults.push({ value, status: response.status, writes: writes.length });
	}
	assert.deepEqual(
		invalidRedirectResults,
		invalidRedirects.map((value) => ({ value, status: 503, writes: 0 }))
	);
	for (const key of ['OIDC_ISSUER', 'OIDC_CLIENT_ID', 'OIDC_REDIRECT_URI', 'SESSION_SECRET']) {
		const { response, writes } = await invoke({ [key]: '' });
		assert.equal(response.status, 503);
		assert.equal(writes.length, 0);
	}
	for (const endpoint of [
		undefined,
		42,
		'/authorize',
		'bad URL',
		'http://id.example.test/auth',
		'javascript:alert(1)',
		'https://user:pass@id.example.test/auth',
		'https://id.example.test/auth#fragment'
	]) {
		const { response, writes } = await invoke({}, { authorization_endpoint: endpoint });
		assert.equal(response.status, 502, `authorization endpoint: ${endpoint}`);
		assert.equal(writes.length, 0);
	}
	for (const fetcher of [
		async () => {
			throw new Error('offline');
		},
		async () => new Response('{invalid'),
		async () => Response.json({ issuer: 'https://wrong.test' }),
		async () => new Response('error', { status: 500 })
	]) {
		const { response, writes } = await invoke({}, {}, false, fetcher);
		assert.equal(response.status, 502);
		assert.equal(writes.length, 0);
	}
	const { encodeOidcTransaction, verifyOidcTransaction } = transaction;
	const first = await invoke();
	const second = await invoke();
	for (const { response, writes } of [first, second]) {
		assert.equal(response.status, 302);
		assert.equal(writes.length, 1);
		const [name, token, flags] = writes[0];
		assert.equal(name, 'sheaf_oidc');
		assert.deepEqual(flags, {
			path: '/',
			maxAge: 600,
			httpOnly: true,
			sameSite: 'lax',
			secure: true
		});
		const payload = await verifyOidcTransaction(token, config.SESSION_SECRET);
		assert.ok(payload);
		const url = new URL(response.headers.get('location'));
		for (const [key, value] of Object.entries({
			response_type: 'code',
			client_id: 'sheaf',
			redirect_uri: config.OIDC_REDIRECT_URI,
			scope: 'openid profile email',
			state: payload.state,
			nonce: payload.nonce,
			code_challenge_method: 'S256',
			code_challenge: await oauth.calculatePKCECodeChallenge(payload.verifier)
		}))
			assert.equal(url.searchParams.get(key), value);
	}
	const a = await verifyOidcTransaction(first.writes[0][1], config.SESSION_SECRET);
	const b = await verifyOidcTransaction(second.writes[0][1], config.SESSION_SECRET);
	for (const field of ['state', 'nonce', 'verifier']) assert.notEqual(a[field], b[field]);
	for (const host of ['localhost', '127.0.0.1', '[::1]'])
		assert.equal(
			(await invoke({ OIDC_REDIRECT_URI: `http://${host}:5173/api/auth/oidc/callback` }, {}, true))
				.response.status,
			302
		);
	assert.equal(
		(
			await invoke(
				{ OIDC_REDIRECT_URI: 'http://localhost.evil.test/api/auth/oidc/callback' },
				{},
				true
			)
		).response.status,
		503
	);
	const now = 1_800_000_000_000;
	const values = {
		state: oauth.generateRandomState(),
		nonce: oauth.generateRandomNonce(),
		verifier: oauth.generateRandomCodeVerifier()
	};
	const token = await encodeOidcTransaction(values, config.SESSION_SECRET, now);
	assert.deepEqual(await verifyOidcTransaction(token, config.SESSION_SECRET, now), {
		...values,
		iat: now
	});
	assert.ok(await verifyOidcTransaction(token, config.SESSION_SECRET, now + 599_999));
	assert.equal(await verifyOidcTransaction(token, config.SESSION_SECRET, now + 600_000), null);
	assert.equal(await verifyOidcTransaction(token, config.SESSION_SECRET, now - 1), null);
	assert.equal(await verifyOidcTransaction(token, 'wrong secret', now), null);
	const [payload, signature] = token.split('.');
	for (const bad of [
		undefined,
		'',
		'garbage',
		payload,
		`${payload}.${signature}.extra`,
		`${payload}.!`,
		`${payload.slice(0, -1)}A.${signature}`,
		`${payload}.${signature[0] === 'A' ? 'B' : 'A'}${signature.slice(1)}`
	])
		assert.equal(await verifyOidcTransaction(bad, config.SESSION_SECRET, now), null);
	// Independently sign malformed payloads to prove shape validation happens after MAC verification.
	const key = await crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(config.SESSION_SECRET),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	for (const raw of [
		'{invalid',
		'null',
		JSON.stringify({ ...values, iat: 'yesterday' }),
		JSON.stringify({ ...values, verifier: '', iat: now }),
		JSON.stringify({ ...values, state: 42, iat: now })
	]) {
		const encoded = Buffer.from(raw).toString('base64url');
		const mac = await crypto.subtle.sign(
			'HMAC',
			key,
			new TextEncoder().encode(`sheaf:oidc-transaction:v1:${encoded}`)
		);
		assert.equal(
			await verifyOidcTransaction(
				`${encoded}.${Buffer.from(mac).toString('base64url')}`,
				config.SESSION_SECRET,
				now
			),
			null
		);
	}
	const session = await load('src/lib/server/session.ts');
	assert.equal(await session.verifySessionToken(token, config.SESSION_SECRET), false);
	assert.equal(
		await verifyOidcTransaction(
			await session.createSessionToken(config.SESSION_SECRET),
			config.SESSION_SECRET
		),
		null
	);
	console.log('OIDC start and transaction checks passed');
} finally {
	globalThis.fetch = originalFetch;
	delete globalThis.__oidcCheck;
}
