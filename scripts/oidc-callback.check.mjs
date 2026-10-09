// Local synthetic provider fixtures; real handler, oauth4webapi and WebCrypto.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import * as oauth from 'oauth4webapi';
import { createServer } from 'node:http';

const root = new URL('../', import.meta.url);
let run = 0;
async function load(path, route = false) {
	let source = await readFile(new URL(path, root), 'utf8');
	if (route) {
		source = source
			.replace(
				"import * as env from '$app/env/private';",
				'const env = globalThis.__callback.config;'
			)
			.replace("import { dev } from '$app/env';", 'const { dev } = globalThis.__callback;')
			.replace(
				"import * as oauth from 'oauth4webapi';",
				'const { oauth } = globalThis.__callback;'
			);
		for (const name of ['oidc', 'oidc-transaction', 'session']) {
			source = source.replace(
				new RegExp(`import \\{([^}]+)\\} from '#lib/server/${name}\\.ts';`, 'g'),
				`const {$1} = globalThis.__callback['${name}'];`
			);
		}
	}
	const { outputText } = ts.transpileModule(source, {
		compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext }
	});
	return import(
		`data:text/javascript;base64,${Buffer.from(outputText + `\n// ${run++}`).toString('base64')}`
	);
}
const oidc = await load('src/lib/server/oidc.ts');
const transaction = await load('src/lib/server/oidc-transaction.ts');
const session = await load('src/lib/server/session.ts');
const config = {
	OIDC_ISSUER: 'https://id.example.test',
	OIDC_CLIENT_ID: 'sheaf',
	OIDC_CLIENT_SECRET: 'fixture-secret',
	OIDC_REDIRECT_URI: 'https://sheaf.example.test/api/auth/oidc/callback',
	SESSION_SECRET: 'fixture-session-secret',
	OIDC_ALLOWED_EMAILS: 'admin@example.test',
	OIDC_ALLOWED_SUBS: ''
};
const values = {
	state: oauth.generateRandomState(),
	nonce: oauth.generateRandomNonce(),
	verifier: oauth.generateRandomCodeVerifier()
};
const key = await crypto.subtle.generateKey(
	{
		name: 'RSASSA-PKCS1-v1_5',
		modulusLength: 2048,
		publicExponent: new Uint8Array([1, 0, 1]),
		hash: 'SHA-256'
	},
	true,
	['sign', 'verify']
);
const jwk = {
	...(await crypto.subtle.exportKey('jwk', key.publicKey)),
	kid: 'fixture',
	alg: 'RS256',
	use: 'sig'
};
const b64 = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
async function jwt(overrides = {}, badSignature = false) {
	const now = Math.floor(Date.now() / 1000);
	const input = `${b64({ alg: 'RS256', kid: 'fixture' })}.${b64({ iss: config.OIDC_ISSUER, aud: config.OIDC_CLIENT_ID, sub: 'Subject-A', iat: now, exp: now + 300, nonce: values.nonce, email: 'Admin@example.test', email_verified: true, ...overrides })}`;
	const sig = new Uint8Array(
		await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key.privateKey, new TextEncoder().encode(input))
	);
	if (badSignature) sig[0] ^= 1;
	return `${input}.${Buffer.from(sig).toString('base64url')}`;
}
async function invoke(options = {}) {
	globalThis.__callback = {
		config: { ...config, ...options.config },
		dev: options.dev ?? false,
		oauth,
		oidc,
		'oidc-transaction': transaction,
		session
	};
	const calls = [];
	globalThis.fetch = async (input, init) => {
		const url = String(input);
		const phase = url.includes('.well-known')
			? 'discovery'
			: url.endsWith('/token')
				? 'token'
				: 'jwks';
		if (options.stall === phase) {
			assert.ok(init.signal instanceof AbortSignal);
			return options.body
				? new Response(
						new ReadableStream({
							start(controller) {
								init.signal.addEventListener(
									'abort',
									() => {
										options.aborted = true;
										controller.error(init.signal.reason);
									},
									{ once: true }
								);
							}
						}),
						{ headers: { 'content-type': 'application/json' } }
					)
				: new Promise((resolve, reject) =>
						init.signal.addEventListener(
							'abort',
							() => {
								options.aborted = true;
								reject(init.signal.reason);
							},
							{ once: true }
						)
					);
		}
		calls.push(url);
		if (url.includes('.well-known')) {
			if (options.discoveryFailure) throw new Error('fixture offline');
			return Response.json({
				issuer: config.OIDC_ISSUER,
				token_endpoint: `${config.OIDC_ISSUER}/token`,
				jwks_uri: `${config.OIDC_ISSUER}/jwks`,
				id_token_signing_alg_values_supported: ['RS256'],
				token_endpoint_auth_methods_supported: options.methods ?? [
					'client_secret_basic',
					'client_secret_post'
				],
				...options.metadata
			});
		}
		if (url.endsWith('/token')) {
			assert.equal(new URLSearchParams(init.body).get('code_verifier'), values.verifier);
			assert.equal(
				new URLSearchParams(init.body).get('redirect_uri'),
				globalThis.__callback.config.OIDC_REDIRECT_URI
			);
			if (options.config?.OIDC_TOKEN_ENDPOINT_AUTH_METHOD === 'client_secret_post') {
				assert.equal(
					new URLSearchParams(init.body).get('client_secret'),
					config.OIDC_CLIENT_SECRET
				);
				assert.equal(new Headers(init.headers).has('authorization'), false);
			} else assert.ok(new Headers(init.headers).get('authorization')?.startsWith('Basic '));
			if (options.tokenFailure) throw new Error('fixture offline');
			if (options.tokenError) return Response.json({ error: 'invalid_grant' }, { status: 400 });
			return Response.json({
				access_token: 'fixture-access-token',
				token_type: 'Bearer',
				...(options.missingIdToken
					? {}
					: { id_token: await jwt(options.claims, options.badSignature) })
			});
		}
		if (url.endsWith('/jwks')) {
			if (options.jwksFailure) throw new Error('fixture offline');
			return Response.json({ keys: [jwk] });
		}
		throw new Error(`Unexpected fixture URL: ${url}`);
	};
	const { GET } = await load('src/routes/api/auth/oidc/callback/+server.ts', true);
	const writes = [],
		deletes = [];
	const raw =
		'raw' in options
			? options.raw
			: await transaction.encodeOidcTransaction(
					values,
					config.SESSION_SECRET,
					options.expired ? Date.now() - 600_000 : Date.now()
				);
	const url = new URL(config.OIDC_REDIRECT_URI);
	url.search =
		options.query ?? new URLSearchParams({ state: values.state, code: 'fixture-code' }).toString();
	const response = await GET({
		url,
		request: new Request(url),
		cookies: {
			get: (name) => {
				assert.equal(name, transaction.OIDC_TRANSACTION_COOKIE);
				return raw;
			},
			delete: (...args) => deletes.push(args),
			set: (...args) => writes.push(args)
		}
	});
	assert.deepEqual(deletes, [[transaction.OIDC_TRANSACTION_COOKIE, { path: '/' }]]);
	assert.ok(calls.filter((url) => url.endsWith('/token')).length <= 1, 'never retry consumed code');
	return { response, writes, calls };
}
const originalFetch = globalThis.fetch;
const originalTimeout = globalThis.setTimeout;
globalThis.setTimeout = (fn, ms, ...args) => originalTimeout(fn, ms === 10_000 ? 30 : ms, ...args);
try {
	for (const [configured, metadata] of [
		['https://auth.example.test', 'https://auth.example.test/'],
		['https://auth.example.test/', 'https://auth.example.test'],
		['https://auth.example.test/tenant', 'https://auth.example.test/tenant/'],
		['https://auth.example.test/tenant/', 'https://auth.example.test/tenant'],
		['https://AUTH.example.test', 'https://auth.example.test']
	]) {
		const result = await invoke({
			config: { OIDC_ISSUER: configured },
			metadata: { issuer: metadata },
			claims: { iss: metadata }
		});
		assert.equal(
			result.response.status,
			502,
			`literal issuer mismatch: ${configured} != ${metadata}`
		);
		assert.equal(result.writes.length, 0);
		assert.equal(result.calls.length, 1, 'reject discovery before token exchange or JWKS');
	}
	for (const issuer of [
		'https://auth.example.test',
		'https://auth.example.test/',
		'https://auth.example.test/tenant',
		'https://auth.example.test/tenant/'
	]) {
		const options = {
			config: { OIDC_ISSUER: issuer },
			metadata: { issuer },
			claims: { iss: issuer }
		};
		const success = await invoke(options);
		assert.equal(success.response.status, 302, `literal issuer match: ${issuer}`);
		assert.equal(success.writes.length, 1);
		assert.ok(success.calls.some((url) => url.endsWith('/jwks')));
		// Regression: redirects must stay mutable so SvelteKit can attach cookies
		// on Workers (Response.redirect() is immutable and crashes).
		success.response.headers.append('set-cookie', 'probe=1');
		assert.equal(success.response.headers.get('set-cookie'), 'probe=1');
		const mismatch = await invoke({
			...options,
			claims: { iss: issuer.endsWith('/') ? issuer.slice(0, -1) : `${issuer}/` }
		});
		assert.equal(
			mismatch.response.status,
			502,
			'JWT issuer must equal accepted metadata literally'
		);
		assert.equal(mismatch.writes.length, 0);
	}
	// Native fetch proves cancellation also interrupts a real stalled socket/body.
	const server = createServer((request, response) => {
		if (request.url === '/body') {
			response.writeHead(200, { 'content-type': 'application/json' });
			response.write('{');
		}
	});
	await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
	try {
		for (const path of ['/headers', '/body']) {
			let signal;
			await assert.rejects(
				oidc.withOidcDeadline(async (deadline) => {
					signal = deadline;
					const response = await originalFetch(`http://127.0.0.1:${server.address().port}${path}`, {
						signal
					});
					await response.json();
				})
			);
			assert.equal(signal.aborted, true);
		}
	} finally {
		server.closeAllConnections();
		await new Promise((resolve) => server.close(resolve));
	}
	for (const stall of ['discovery', 'token', 'jwks'])
		for (const body of [false, true]) {
			const options = { stall, body };
			assert.equal((await invoke(options)).response.status, 502);
			assert.equal(options.aborted, true, `${stall}: transport/body aborted`);
		}
	for (const query of [
		`state=${values.state}&error=access_denied`,
		`state=${values.state}&code=fixture-code&error=access_denied`
	]) {
		const denied = await invoke({ query });
		assert.equal(denied.response.status, 400);
		assert.equal(denied.writes.length, 0);
		assert.equal(
			denied.calls.some((url) => url.endsWith('/token')),
			false
		);
	}
	const success = await invoke();
	assert.equal(success.response.status, 302);
	assert.equal(success.response.headers.get('location'), 'https://sheaf.example.test/admin');
	assert.equal(success.writes.length, 1);
	assert.equal(success.writes[0][0], session.COOKIE_NAME);
	assert.deepEqual(success.writes[0][2], {
		path: '/',
		maxAge: session.MAX_AGE,
		httpOnly: true,
		sameSite: 'lax',
		secure: true
	});
	assert.equal(await session.verifySessionToken(success.writes[0][1], config.SESSION_SECRET), true);
	assert.ok(success.calls.some((url) => url.endsWith('/jwks')));
	for (const options of [
		{ claims: { email: 'other@example.test' } },
		{ claims: { email_verified: false } },
		{ claims: { email_verified: 'true' } },
		{ claims: { email_verified: null } },
		{ config: { OIDC_ALLOWED_EMAILS: '', OIDC_ALLOWED_SUBS: 'subject-a' } }
	]) {
		const result = await invoke(options);
		assert.equal(
			result.response.headers.get('location'),
			'https://sheaf.example.test/admin?error=forbidden'
		);
		assert.equal(result.writes.length, 0);
	}
	assert.equal(
		(
			await invoke({
				config: { OIDC_ALLOWED_EMAILS: '', OIDC_ALLOWED_SUBS: ' Subject-A ' },
				claims: { email_verified: false }
			})
		).response.status,
		302
	);
	assert.equal(
		(await invoke({ config: { OIDC_TOKEN_ENDPOINT_AUTH_METHOD: 'client_secret_post' } })).response
			.status,
		302
	);
	assert.equal((await invoke({ methods: ['client_secret_post'] })).response.status, 502);
	assert.equal(
		(
			await invoke({
				config: { OIDC_TOKEN_ENDPOINT_AUTH_METHOD: 'client_secret_post' },
				methods: ['client_secret_basic']
			})
		).response.status,
		502
	);
	for (const config of [
		{ OIDC_TOKEN_ENDPOINT_AUTH_METHOD: 'invalid' },
		{ OIDC_ALLOWED_EMAILS: ' , ', OIDC_ALLOWED_SUBS: '' }
	])
		assert.equal((await invoke({ config })).response.status, 503);
	for (const options of [
		{ raw: undefined },
		{ raw: 'malformed' },
		{ expired: true },
		{ raw: await transaction.encodeOidcTransaction(values, 'wrong-signing-secret') },
		{
			raw: (await transaction.encodeOidcTransaction(values, config.SESSION_SECRET)).replace(
				/.$/,
				'!'
			)
		},
		{
			raw: (await transaction.encodeOidcTransaction(values, config.SESSION_SECRET)).replace(
				/\.([A-Za-z0-9_-])/,
				(_, char) => `.${char === 'A' ? 'B' : 'A'}`
			)
		},
		{ query: 'code=x' },
		{ query: 'state=wrong&code=x' },
		{ query: `state=${values.state}` },
		{ query: `state=${values.state}&code=` },
		{ query: `state=${values.state}&code=a&code=b` },
		{ query: `state=${values.state}&state=${values.state}&code=x` },
		{ query: `state=${values.state}&code=x&iss=https://wrong.test` }
	]) {
		const result = await invoke(options);
		assert.equal(result.response.status, 400, JSON.stringify(options));
		assert.equal(result.writes.length, 0);
	}
	for (const options of [
		{ badSignature: true },
		{ claims: { nonce: 'wrong' } },
		{ claims: { nonce: null } },
		{ claims: { iss: 'https://wrong.test' } },
		{ claims: { aud: 'other-client' } },
		{ claims: { exp: Math.floor(Date.now() / 1000) - 1 } },
		{ claims: { sub: '' } },
		{ claims: { sub: null } },
		{ missingIdToken: true },
		{ discoveryFailure: true },
		{ tokenFailure: true },
		{ jwksFailure: true },
		{ tokenError: true },
		{ methods: ['private_key_jwt'] },
		{ metadata: { issuer: 'https://wrong.test' } }
	]) {
		const result = await invoke(options);
		assert.equal(result.response.status, 502, JSON.stringify(options));
		assert.equal(result.writes.length, 0);
	}
	for (const key of [
		'OIDC_ISSUER',
		'OIDC_CLIENT_ID',
		'OIDC_CLIENT_SECRET',
		'OIDC_REDIRECT_URI',
		'SESSION_SECRET'
	])
		assert.equal((await invoke({ config: { [key]: '' } })).response.status, 503);
	for (const config of [
		{ OIDC_ISSUER: 'http://id.example.test' },
		{ OIDC_ISSUER: 'https://id.example.test?query' },
		{ OIDC_REDIRECT_URI: 'http://sheaf.example.test/api/auth/oidc/callback' },
		{ OIDC_REDIRECT_URI: 'https://sheaf.example.test/wrong' },
		{ OIDC_REDIRECT_URI: 'https://sheaf.example.test/api/auth/oidc/callback?' }
	])
		assert.equal((await invoke({ config })).response.status, 503);
	console.log('OIDC callback checks passed (local synthetic signed JWT fixtures)');
} finally {
	globalThis.fetch = originalFetch;
	globalThis.setTimeout = originalTimeout;
	delete globalThis.__callback;
}
