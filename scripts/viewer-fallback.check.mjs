import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { compile } from 'svelte/compiler';
import { render } from 'svelte/server';

const source = await readFile(
	new URL('../src/routes/v/[slug]/HeadlessViewer.svelte', import.meta.url),
	'utf8'
);
const snippet = source.match(/\{#snippet fallback\([^]*?\{\/snippet\}/)?.[0];
assert.ok(snippet, 'viewer loading/error states must share one fallback');
const { js } = compile(
	`<script lang="ts">let { message, failed, streamUrl, fileName } = $props();</script>${snippet}{@render fallback(message, failed)}`,
	{ generate: 'server' }
);
const code = js.code.replace(/from '([^']+)'/g, (_, name) => `from '${import.meta.resolve(name)}'`);
const { default: Component } = await import(
	`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
);
for (const [message, failed] of [
	['Loading…', false],
	['Could not load the PDF engine.', true],
	['Could not open this PDF.', true]
]) {
	const { body } = render(Component, {
		props: { message, failed, streamUrl: '/v/fixture/file', fileName: 'fixture.pdf' }
	});
	assert.ok(body.includes(message));
	assert.ok(body.includes(`role="${failed ? 'alert' : 'status'}"`));
	assert.match(body, /href="\/v\/fixture\/file"/);
	assert.match(body, /download="fixture.pdf"/);
	assert.ok(body.includes('Download'));
}
assert.equal((source.match(/\{@render fallback\(/g) ?? []).length, 3);
console.log('PASS: shared viewer fallback preserves loading/error roles and download target.');
