// Run: node scripts/oidc-allowlist.check.mjs
import assert from 'node:assert/strict';
import { parseAllowlist, isOidcAllowed, oidcIssuerUrl } from '../src/lib/server/oidc.ts';

assert.deepEqual(parseAllowlist(undefined), []);
assert.deepEqual(parseAllowlist('  '), []);
assert.deepEqual(parseAllowlist('a@x.id, B@x.id ,,a@x.id'), ['a@x.id', 'b@x.id']);
assert.equal(
	isOidcAllowed({
		email: 'Admin@x.id',
		email_verified: true,
		sub: 's1',
		allowedEmails: 'admin@x.id',
		allowedSubs: ''
	}),
	true
);
assert.equal(isOidcAllowed({ email: 'other@x.id', sub: 's1', allowedEmails: 'admin@x.id' }), false);
assert.equal(isOidcAllowed({ email: 'other@x.id', sub: 'abc', allowedSubs: 'abc' }), true);
assert.equal(isOidcAllowed({ email: 'any@x.id', sub: 'any' }), false);
assert.equal(
	oidcIssuerUrl(
		'https://auth.example.com/tenant/',
		'https://sheaf.example.test/api/auth/oidc/callback',
		false
	).href,
	'https://auth.example.com/tenant/'
);
for (const email_verified of [undefined, false, 'true', 1])
	assert.equal(
		isOidcAllowed({ email: 'admin@x.id', email_verified, allowedEmails: 'admin@x.id' }),
		false
	);
assert.equal(isOidcAllowed({ sub: 'Subject-A', allowedSubs: ' Subject-A , Subject-A ' }), true);
assert.equal(isOidcAllowed({ sub: 'subject-a', allowedSubs: 'Subject-A' }), false);
console.log('PASS: OIDC allowlist helpers.');
