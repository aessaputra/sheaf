import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const toolbar = readFileSync(
	new URL('../src/routes/v/[slug]/ViewerToolbar.svelte', import.meta.url),
	'utf8'
);
assert.doesNotMatch(toolbar, /<input\b|<form\b|jumpToPage|Jump to page|>Go</);
assert.doesNotMatch(toolbar, /Page \{|of \{scroll\.state\.totalPages\}/);
assert.equal((toolbar.match(/<button\b/g) ?? []).length, 5);
for (const icon of ['CaretLeftIcon', 'CaretRightIcon', 'MinusCircleIcon', 'PlusCircleIcon']) {
	assert.ok(toolbar.includes(`<${icon} size={20} aria-hidden="true"`));
}
for (const name of ['Previous page', 'Next page', 'Zoom out', 'Zoom in', 'Fit width']) {
	assert.ok(toolbar.includes(`aria-label="${name}"`));
	assert.ok(toolbar.includes(`title="${name}`));
}
assert.match(toolbar, /min-width: 44px/);
assert.match(toolbar, /min-height: 44px/);
assert.match(toolbar, /button:focus-visible/);
for (const control of ['Prev', 'Next', 'Zoom out', 'Zoom in', 'Fit width']) {
	assert.ok(toolbar.includes(control), `${control} remains available`);
}
for (const action of [
	'scrollToPreviousPage(pageScrollBehavior())',
	'scrollToNextPage(pageScrollBehavior())',
	'zoomOut()',
	'zoomIn()',
	'requestZoom(ZoomMode.FitWidth)'
]) {
	assert.ok(toolbar.includes(action), `${action} remains connected`);
}
assert.match(toolbar, /disabled=\{scroll.state.currentPage <= 1\}/);
assert.match(toolbar, /disabled=\{scroll.state.currentPage >= scroll.state.totalPages\}/);
// Exercise the component handler itself without a test framework or DOM dependency.
const { default: ts } = await import('typescript');
const handler = toolbar.match(
	/function handleZoomKeydown\(event: KeyboardEvent\) \{[\s\S]*?\n\t\}/
)?.[0];
assert.ok(handler, 'document-scoped keyboard handler exists');
assert.match(toolbar, /<svelte:window onkeydown=\{handleZoomKeydown\}/);
assert.match(toolbar, /aria-keyshortcuts="Control\+-"/);
assert.match(toolbar, /aria-keyshortcuts="Control\+\+ Control\+="/);
class Element {
	constructor(editable = false, field = false) {
		this.isContentEditable = editable;
		this.field = field;
	}
	closest() {
		return this.field ? this : null;
	}
}
const zoom = { provides: { zoomIn: () => calls.push('in'), zoomOut: () => calls.push('out') } };
const scroll = { provides: {}, state: { totalPages: 3 } };
const calls = [];
const handle = new Function(
	'zoom',
	'scroll',
	'HTMLElement',
	ts.transpile(handler) + '; return handleZoomKeydown;'
)(zoom, scroll, Element);
function press(key, overrides = {}) {
	let prevented = false;
	handle({
		key,
		ctrlKey: true,
		altKey: false,
		metaKey: false,
		isComposing: false,
		defaultPrevented: false,
		target: new Element(),
		preventDefault() {
			prevented = true;
		},
		...overrides
	});
	return prevented;
}
for (const key of ['-', '+', '=']) assert.equal(press(key), true);
assert.deepEqual(calls, ['out', 'in', 'in']);
for (const overrides of [
	{ ctrlKey: false },
	{ altKey: true },
	{ metaKey: true },
	{ isComposing: true },
	{ defaultPrevented: true },
	{ target: new Element(true) },
	{ target: new Element(false, true) }
]) {
	assert.equal(press('+', overrides), false);
}
assert.equal(press('0'), false);
zoom.provides = undefined;
assert.equal(press('+'), false);
zoom.provides = { zoomIn: () => calls.push('in') };
scroll.state.totalPages = 0;
assert.equal(press('+'), false);
assert.equal(calls.length, 3);
console.log(
	'Viewer toolbar: no jump form; no page indicator; five accessible icon/text controls and page boundaries preserved.'
);
