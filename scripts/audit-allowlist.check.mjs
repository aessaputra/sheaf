import assert from 'node:assert/strict';
import { unapprovedAdvisories } from './audit-check.mjs';

const allowed = 'https://github.com/advisories/GHSA-mrhx-c7xc-m3w5';
const other = 'https://github.com/advisories/GHSA-aaaa-bbbb-cccc';

const report = (vulnerabilities) => ({ vulnerabilities });

assert.deepEqual(
	[...unapprovedAdvisories(report({ zod: { via: [{ url: allowed, severity: 'high' }] } }))],
	[],
	'the documented zod advisory is allowed'
);

assert.deepEqual(
	[
		...unapprovedAdvisories(
			report({
				pkg: {
					via: [
						{ url: allowed, severity: 'high' },
						{ url: other, severity: 'high', title: 'other bug' }
					]
				}
			})
		)
	],
	[[other, 'other bug']],
	'another high advisory still fails'
);

assert.equal(
	unapprovedAdvisories(report({ pkg: { via: [{ url: other, severity: 'moderate' }] } })).size,
	0,
	'moderate advisories are ignored'
);

assert.equal(
	unapprovedAdvisories(report({ pkg: { via: ['transitive-package', { severity: 'high' }] } })).size,
	0,
	'chains without an advisory url are ignored'
);

assert.equal(unapprovedAdvisories(undefined).size, 0, 'a missing report has nothing to block');

console.log('PASS: the audit gate allows only the documented zod advisory.');
