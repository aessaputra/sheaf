import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (name) =>
	readFileSync(new URL(`../src/routes/v/[slug]/${name}.svelte`, import.meta.url), 'utf8');
const toolbar = read('ViewerToolbar');
const viewer = read('HeadlessViewer');
const page = read('+page');

assert.match(viewer, /role="region"/);
assert.match(viewer, /aria-label="PDF pages"/);
assert.match(viewer, /tabindex="0"/, 'the PDF surface is keyboard reachable');
assert.ok(viewer.includes('bg-gray-100'), 'pages keep the gray backdrop');
assert.ok(viewer.includes('-outline-offset-2'));
assert.ok(toolbar.includes('text-gray-600'));
assert.match(toolbar, /aria-label="Set zoom"/);
assert.match(toolbar, /aria-label="Current page"/);
assert.match(toolbar, /aria-label="Total pages"/);
assert.match(toolbar, /aria-label="Pan mode"/);
assert.match(toolbar, /aria-label="Pointer mode"/);
assert.match(toolbar, /aria-pressed=\{interactionState\.activeToolId === 'pan'\}/);
assert.match(toolbar, /aria-pressed=\{interactionState\.activeToolId === 'pointer'\}/);
assert.ok(page.includes('sr-only'));
assert.doesNotMatch(page, /<header>/);
assert.match(page, /<HeadlessViewer streamUrl=\{data.streamUrl\} fileName=\{data.fileName\}/);
assert.match(viewer, /<ViewerToolbar \{streamUrl\} \{fileName\}/);
assert.ok(toolbar.includes('px-3'));

const body = toolbar.match(/function pageScrollBehavior\(\)[\s\S]*?\n\t\}/)?.[0];
assert.ok(body);
for (const reduced of [true, false]) {
	const behavior = new Function('window', `${body}; return pageScrollBehavior();`)({
		matchMedia(query) {
			assert.equal(query, '(prefers-reduced-motion: reduce)');
			return { matches: reduced };
		}
	});
	assert.equal(behavior, reduced ? 'instant' : 'smooth');
}

console.log(
	'PASS: viewer keeps region semantics, focus, contrast, named inputs and reduced motion.'
);
