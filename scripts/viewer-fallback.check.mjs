import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { compile } from 'svelte/compiler';
import { render } from 'svelte/server';

const root = new URL('../', import.meta.url);
const fallback = await readFile(new URL('src/routes/v/[slug]/ViewerFallback.svelte', root), 'utf8');
const viewer = await readFile(new URL('src/routes/v/[slug]/HeadlessViewer.svelte', root), 'utf8');
const route = await readFile(new URL('src/routes/v/[slug]/+page.svelte', root), 'utf8');

// Both files share one fallback component, no local duplicates.
for (const [name, source] of [
	['HeadlessViewer', viewer],
	['route', route]
]) {
	assert.match(source, /ViewerFallback/, `${name} uses the shared fallback`);
	assert.doesNotMatch(source, /\{#snippet fallback/, `${name} has no local fallback snippet`);
}
assert.match(fallback, /<SpinnerGapIcon[^/]*class="[^"]*animate-spin/);

// Stub the icon: the harness cannot import .svelte files in Node.
const withoutImport = fallback.replace(/import[^;]+;/, '');
const stubbed = withoutImport.replace(
	/<SpinnerGapIcon[^/]*\/>/,
	'<svg class="animate-spin" aria-hidden="true"></svg>'
);
const { js } = compile(stubbed, { generate: 'server' });
const code = js.code.replace(/from '([^']+)'/g, (_, name) => `from '${import.meta.resolve(name)}'`);
const { default: Component } = await import(
	`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
);
for (const [message, failed] of [
	['Loading viewer…', false],
	['Could not load the PDF engine.', true],
	['Could not open this PDF.', true]
]) {
	const { body } = render(Component, {
		props: { message, failed, streamUrl: '/v/fixture/file', fileName: 'fixture.pdf' }
	});
	assert.ok(body.includes(message));
	assert.ok(body.includes(`role="${failed ? 'alert' : 'status'}"`));
	assert.equal(
		body.includes('Download'),
		failed,
		'Download is an error fallback, not a loading action'
	);
	assert.equal(
		body.includes('animate-spin'),
		!failed,
		'spinner shows while loading, not on failure'
	);
	if (failed) {
		assert.match(body, /href="\/v\/fixture\/file"/);
		assert.match(body, /download="fixture.pdf"/);
	}
}
console.log('PASS: shared viewer fallback preserves loading/error roles and download target.');
