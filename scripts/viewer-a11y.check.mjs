import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (name) =>
	readFileSync(new URL(`../src/routes/v/[slug]/${name}.svelte`, import.meta.url), 'utf8');
const toolbar = read('ViewerToolbar');
const viewer = read('HeadlessViewer');
const page = read('+page');
assert.match(viewer, /background-color: #f3f4f6/);
assert.match(toolbar, /color: #595959/);
assert.match(toolbar, /aria-label="Set zoom"/);
assert.match(toolbar, /aria-label="Current page"/);
assert.match(toolbar, /aria-label="Total pages"/);
assert.match(page, /<main>\s*<h1 class="name"/);
assert.match(page, /clip-path: inset\(50%\)/);
assert.doesNotMatch(page, /<header>/);
assert.match(page, /<HeadlessViewer streamUrl=\{data.streamUrl\} fileName=\{data.fileName\}/);
assert.match(viewer, /<ViewerToolbar \{documentId\} \{streamUrl\} \{fileName\}/);
assert.match(page, /min-height: 44px/);
assert.match(page, /a:focus-visible/);
assert.match(toolbar, /padding: 0 0\.75rem/);
assert.match(viewer, /outline-offset: -2px/);
for (const action of ['Next', 'Previous']) {
	assert.ok(toolbar.includes(`scrollTo${action}Page(pageScrollBehavior())`));
}
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
