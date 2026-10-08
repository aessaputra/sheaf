import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const toolbar = readFileSync(
	new URL('../src/routes/v/[slug]/ViewerToolbar.svelte', import.meta.url),
	'utf8'
);
assert.match(toolbar, /href=\{streamUrl\} download=\{fileName\}/);
assert.ok(toolbar.indexOf('aria-label="Zoom out"') < toolbar.indexOf('>Download</a>'));
assert.match(toolbar, /\.toolbar \{[^}]*padding: 0\.5rem 1rem;/);
assert.match(toolbar, /@container \(max-width: 25rem\)/);
assert.match(toolbar, /\.toolbar > a \{[^}]*margin-left: auto;/);
assert.match(toolbar, /position: absolute/);
assert.match(toolbar, /bottom: 1rem/);
assert.match(toolbar, /left: 50%/);
assert.match(toolbar, /translateX\(-50%\)/);
assert.equal((toolbar.match(/<input\b/g) ?? []).length, 2);
assert.match(toolbar, /aria-label="Current page"/);
assert.match(toolbar, /aria-label="Set zoom"/);
assert.match(toolbar, /popover="auto"/);
assert.match(toolbar, /anchor-name: --zoom-presets/);
assert.match(toolbar, /position-anchor: --zoom-presets/);
assert.match(toolbar, /top: anchor\(bottom\)/);
assert.match(toolbar, /left: anchor\(left\)/);
assert.doesNotMatch(toolbar, /<form\b|>Go</);
assert.doesNotMatch(toolbar, /Page \{|of \{scroll\.state\.totalPages\}/);
assert.ok((toolbar.match(/<button\b/g) ?? []).length >= 5);
for (const icon of [
	'CaretLeftIcon',
	'CaretRightIcon',
	'MinusCircleIcon',
	'PlusCircleIcon',
	'CaretDownIcon',
	'HandPalmIcon'
]) {
	assert.ok(toolbar.includes(`<${icon} size={20} aria-hidden="true"`));
}
// Kaizen 2 (RED): floating nav hidden entirely when totalPages <= 1.
assert.match(toolbar, /scroll\.state\.totalPages > 1/);
assert.doesNotMatch(toolbar, /⌄/);
// Kaizen 3 (RED): Download link has comfortable horizontal padding; buttons keep theirs.
assert.match(toolbar, /a \{[\s\S]*?padding: 0 0\.75rem/);
for (const name of ['Previous page', 'Next page', 'Zoom out', 'Zoom in', 'Fit width']) {
	assert.ok(toolbar.includes(`aria-label="${name}"`));
	assert.ok(toolbar.includes(`title="${name}`));
}
assert.ok(toolbar.includes('aria-label="Toggle pan"'));
assert.ok(toolbar.includes('title="Pan (hand)"'));
assert.match(toolbar, /min-width: 2rem/);
assert.match(toolbar, /min-height: 2rem/);
assert.match(toolbar, /button:focus-visible/);
for (const control of ['Prev', 'Next', 'Zoom out', 'Zoom in', 'Fit width', 'Toggle pan']) {
	assert.ok(toolbar.includes(control), `${control} remains available`);
}
for (const action of [
	'scrollToPreviousPage(pageScrollBehavior())',
	'scrollToNextPage(pageScrollBehavior())',
	'zoomOut()',
	'zoomIn()',
	'chooseZoom(ZoomMode.FitWidth)',
	'togglePan()'
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
// Exercise real input handlers, not a parallel parser.
const inputHandlers = ['commitPage', 'validZoom', 'commitZoom']
	.map((name) => {
		const body = toolbar.match(new RegExp(`function ${name}\\(\\) \\{[\\s\\S]*?\\n\\t\\}`))?.[0];
		assert.ok(body, name);
		return body;
	})
	.join('\n');
const runInput = new Function(
	'pageDraft',
	'zoomDraft',
	'scroll',
	'zoom',
	'pageScrollBehavior',
	ts.transpile(inputHandlers) + '; commitPage(); commitZoom(); return { pageDraft, zoomDraft };'
);
for (const value of ['', ' ', '-1', '0', 'Infinity', 'NaN', '1.5', '4', '2x', '0x2', '1e0']) {
	const applied = [];
	const result = runInput(
		value,
		'',
		{ state: { totalPages: 3 }, provides: { scrollToPage: (v) => applied.push(v) } },
		{ provides: { requestZoom: (v) => applied.push(v) } },
		() => 'instant'
	);
	assert.deepEqual(applied, []);
	assert.deepEqual(result, { pageDraft: null, zoomDraft: null });
}
for (const value of [
	'',
	' ',
	'-100',
	'0',
	'Infinity',
	'NaN',
	'19',
	'6001',
	'100x',
	'0x64',
	'1e2'
]) {
	const applied = [];
	runInput(
		'',
		value,
		{ state: { totalPages: 3 } },
		{ provides: { requestZoom: (v) => applied.push(v) } },
		() => 'instant'
	);
	assert.deepEqual(applied, []);
}
for (const value of ['20', '125.5', '6000']) {
	const applied = [];
	runInput(
		'2',
		value,
		{ state: { totalPages: 3 }, provides: { scrollToPage: (v) => applied.push(v) } },
		{ provides: { requestZoom: (v) => applied.push(v) } },
		() => 'instant'
	);
	assert.deepEqual(applied, [{ pageNumber: 2, behavior: 'instant' }, Number(value) / 100]);
}
// Kaizen 1 (RED): floating nav auto-hides after 4000ms idle, reappears on activity/hover/focus.
assert.match(toolbar, /useViewportScrollActivity/);
assert.match(toolbar, /from '@embedpdf\/plugin-viewport\/svelte'/);
assert.match(toolbar, /setTimeout\([\s\S]*?,\s*4000\)/);
assert.match(toolbar, /clearTimeout/);
assert.match(toolbar, /onmouseenter/);
assert.match(toolbar, /onmouseleave/);
assert.match(toolbar, /onfocusin/);
assert.match(toolbar, /onfocusout/);
assert.match(toolbar, /transition: opacity/);
console.log(
	'Viewer toolbar: editable page/zoom, native presets, accessible controls, input guards and page boundaries PASS.'
);
