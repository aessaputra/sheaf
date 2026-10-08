// Run: node scripts/oidc-allowlist.check.mjs
import assert from 'node:assert/strict';
import { parseAllowlist, isOidcAllowed, normalizeIssuer } from '../src/lib/server/oidc.ts';

assert.deepEqual(parseAllowlist(undefined), []);
assert.deepEqual(parseAllowlist('  '), []);
assert.deepEqual(parseAllowlist('a@x.id, B@x.id ,,a@x.id'), ['a@x.id', 'b@x.id']);
assert.equal(
	isOidcAllowed({ email: 'Admin@x.id', sub: 's1', allowedEmails: 'admin@x.id', allowedSubs: '' }),
	true
);
assert.equal(isOidcAllowed({ email: 'other@x.id', sub: 's1', allowedEmails: 'admin@x.id' }), false);
assert.equal(isOidcAllowed({ email: 'other@x.id', sub: 'abc', allowedSubs: 'abc' }), true);
assert.equal(isOidcAllowed({ email: 'any@x.id', sub: 'any' }), false);
assert.equal(normalizeIssuer('https://id.aes.my.id/'), 'https://id.aes.my.id');
console.log('PASS: OIDC allowlist helpers.');
