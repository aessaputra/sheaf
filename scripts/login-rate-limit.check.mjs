import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { moduleUrl } from './check-source.mjs';

const root = new URL('../', import.meta.url);
const source = (await readFile(new URL('src/routes/api/login/+server.ts', root), 'utf8'))
	.replace(
		"import { env } from 'cloudflare:workers';",
		'const env = globalThis.__loginRateLimitEnv;'
	)
	.replace(
		"import { ADMIN_PASSWORD, SESSION_SECRET } from '$app/env/private';",
		"const ADMIN_PASSWORD = 'synthetic-password'; const SESSION_SECRET = 's'.repeat(32);"
	)
	.replace(
		"from '#lib/server/session.ts'",
		`from '${new URL('src/lib/server/session.ts', root).href}'`
	);
const keys = [];
let result = { success: true };
globalThis.__loginRateLimitEnv = {
	LOGIN_RATE_LIMITER: {
		async limit(options) {
			keys.push(options);
			if (result instanceof Error) throw result;
			return result;
		}
	}
};
try {
	const { POST } = await import(moduleUrl(source));
	for (const outcome of ['allowed', 'denied', 'failure']) {
		result =
			outcome === 'failure'
				? new Error('sensitive upstream detail')
				: { success: outcome === 'allowed' };
		let reads = 0;
		const writes = [];
		const logs = [];
		const originalError = console.error;
		console.error = (...args) => logs.push(args);
		let response;
		try {
			response = await POST({
				getClientAddress: () => '192.0.2.1',
				request: {
					url: 'https://sheaf.example.test/api/login',
					headers: new Headers({ 'x-forwarded-for': '203.0.113.1' }),
					async json() {
						reads++;
						assert.equal(outcome, 'allowed', 'blocked requests must not parse credentials');
						return { password: 'synthetic-password' };
					}
				},
				cookies: { set: (...args) => writes.push(args) }
			});
		} finally {
			console.error = originalError;
		}
		assert.equal(response.status, { allowed: 200, denied: 429, failure: 503 }[outcome]);
		assert.equal(reads, outcome === 'allowed' ? 1 : 0);
		assert.equal(writes.length, outcome === 'allowed' ? 1 : 0);
		assert.equal(response.headers.get('retry-after'), outcome === 'denied' ? '60' : null);
		assert.deepEqual(
			await response.json(),
			outcome === 'allowed'
				? { ok: true }
				: {
						error:
							outcome === 'denied'
								? 'Too many login attempts. Try again later.'
								: 'Login temporarily unavailable.'
					}
		);
		assert.deepEqual(logs, outcome === 'failure' ? [['Login rate limiter unavailable.']] : []);
	}
	assert.deepEqual(
		keys,
		Array.from({ length: 3 }, () => ({ key: '192.0.2.1' }))
	);
} finally {
	delete globalThis.__loginRateLimitEnv;
}
console.log(
	'PASS: real login endpoint limits trusted client IP before credentials, returns 429/503, and fails closed.'
);
