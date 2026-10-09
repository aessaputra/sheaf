import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (name) =>
	readFileSync(new URL(`../src/routes/v/[slug]/${name}.svelte`, import.meta.url), 'utf8');
const toolbar = read('ViewerToolbar');
const viewer = read('HeadlessViewer');
const page = read('+page');
assert.ok(viewer.includes('bg-gray-100'));
assert.ok(toolbar.includes('text-gray-600'));
assert.match(toolbar, /aria-label="Set zoom"/);
assert.match(toolbar, /aria-label="Current page"/);
assert.match(toolbar, /aria-label="Total pages"/);
assert.ok(page.includes('sr-only'));
assert.doesNotMatch(page, /<header>/);
assert.match(page, /<HeadlessViewer streamUrl=\{data.streamUrl\} fileName=\{data.fileName\}/);
assert.match(viewer, /<ViewerToolbar \{documentId\} \{streamUrl\} \{fileName\}/);
assert.ok(toolbar.includes('px-3'));
assert.ok(viewer.includes('-outline-offset-2'));
const body = toolbar.match(/function pageScrollBehavior\(\)[\s\S]*?\n\t\}/)?.[0];
assert.ok(body);
const { default: ts } = await import('typescript');
for (const reduced of [true, false]) {
	const behavior = new Function('window', ts.transpile(body) + '; return pageScrollBehavior();')({
		matchMedia(query) {
			assert.equal(query, '(prefers-reduced-motion: reduce)');
			return { matches: reduced };
		}
	});
	assert.equal(behavior, reduced ? 'instant' : 'smooth');
}
console.log(
	'Viewer accessibility: gray viewport, contrast, heading, focus, download target, named inputs and reduced-motion branches PASS.'
);
