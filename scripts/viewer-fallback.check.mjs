import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (name) => readFileSync(new URL(`src/routes/v/[slug]/${name}`, root), 'utf8');
const viewer = read('HeadlessViewer.svelte');
const fallback = read('ViewerFallback.svelte');

assert.match(viewer, /<DocumentGate>/, 'document loading/error is handled by DocumentGate');
assert.match(viewer, /\{#snippet fallback\(\)\}/, 'DocumentGate has a loading fallback');
assert.match(viewer, /\{#snippet error\(\)\}/, 'DocumentGate has an error fallback');
assert.equal(
	(viewer.match(/<ViewerFallback/g) ?? []).length,
	4,
	'viewer and document fallbacks share ViewerFallback'
);
assert.ok(existsSync(new URL('src/routes/v/[slug]/ViewerFallback.svelte', root)));
assert.match(fallback, /role=\{failed \? 'alert' : 'status'\}/, 'failure is announced as an alert');
assert.match(
	fallback,
	/\{#if !failed\}[\s\S]*animate-spin/,
	'the spinner shows only while loading'
);
assert.match(
	fallback,
	/\{#if failed\}[\s\S]*download=\{fileName\}/,
	'Download shows only on failure'
);
for (const message of ['Loading…', 'Could not load the PDF engine.', 'Could not open this PDF.']) {
	assert.ok(viewer.includes(message), `fallback message: ${message}`);
}

console.log('PASS: viewer loading, engine failure and document failure share ViewerFallback.');
