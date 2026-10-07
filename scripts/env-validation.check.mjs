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

assert.deepEqual(check(true, {}), { ADMIN_PASSWORD: undefined, SESSION_SECRET: undefined });
const valid = { ADMIN_PASSWORD: 'synthetic-admin-password', SESSION_SECRET: 's'.repeat(32) };
assert.deepEqual(check(false, valid), valid);
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
