import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const toolbar = readFileSync(
	new URL('../src/routes/v/[slug]/ViewerToolbar.svelte', import.meta.url),
	'utf8'
);
assert.ok(toolbar.includes('href={streamUrl}'));
assert.ok(toolbar.includes('download={fileName}'));
assert.ok(toolbar.indexOf('aria-label="Zoom out"') < toolbar.indexOf('>Download</a'));
assert.ok(toolbar.includes('px-4 py-2'));
assert.doesNotMatch(toolbar, /<style>/);
assert.ok(toolbar.includes('@max-'));
assert.ok(toolbar.includes('ml-auto'));
assert.ok(toolbar.includes('absolute bottom-4'));
assert.ok(toolbar.includes('left-1/2'));
assert.ok(toolbar.includes('-translate-x-1/2'));
assert.equal((toolbar.match(/<input\b/g) ?? []).length, 2);
assert.ok(toolbar.includes('aria-label="Zoom presets"'));
assert.ok(!toolbar.includes('position-anchor'));
assert.ok(!toolbar.includes('popovertarget'));
assert.ok(toolbar.includes('isPresetOpen'));
assert.doesNotMatch(toolbar, /<form\b|>Go</);
assert.doesNotMatch(toolbar, /Page \{|of \{scroll\.state\.totalPages\}/);
assert.ok((toolbar.match(/<button\b/g) ?? []).length >= 5);
for (const icon of [
	'CaretLeftIcon',
	'CaretRightIcon',
	'MinusCircleIcon',
	'PlusCircleIcon',
	'CaretDownIcon'
]) {
	assert.ok(toolbar.includes(`<${icon} size={20} aria-hidden="true"`));
}
// Kaizen 2 (RED): floating nav hidden entirely when totalPages <= 1.
assert.match(toolbar, /scroll\.state\.totalPages > 1/);
assert.doesNotMatch(toolbar, /⌄/);
// Kaizen 3 (GREEN): Download link has comfortable horizontal padding; buttons keep theirs.
assert.ok(toolbar.includes('p-[5px]'));
for (const name of ['Previous page', 'Next page', 'Zoom out', 'Zoom in']) {
	assert.ok(toolbar.includes(`aria-label="${name}"`));
	assert.ok(toolbar.includes(`title="${name}`));
}
const presetSource = toolbar.match(/const presets = \[[\s\S]*?\n\t\];/)?.[0];
assert.ok(presetSource);
const presets = new Function('ZoomMode', presetSource + '; return presets;')({
	FitPage: 'fit-page',
	FitWidth: 'fit-width'
});
assert.deepEqual(
	presets.map(({ value }) => value),
	[0.25, 0.5, 1, 1.25, 1.5, 2, 4, 8, 16, 'fit-page', 'fit-width']
);
assert.deepEqual(
	presets.slice(-2).map(({ label }) => label),
	['Fit page', 'Fit width']
);
assert.match(toolbar, /aria-label=\{label\}[\s\S]*?title=\{label\}/);
assert.match(toolbar, /\{#each presets as \{ label, value \}/);
assert.ok(toolbar.includes('min-w-8'));
assert.ok(toolbar.includes('min-h-8'));
assert.ok(toolbar.includes('focus-visible:'));
for (const control of ['Prev', 'Next', 'Zoom out', 'Zoom in', 'Fit width']) {
	assert.ok(toolbar.includes(control), `${control} remains available`);
}
for (const action of [
	'scrollToPreviousPage(pageScrollBehavior())',
	'scrollToNextPage(pageScrollBehavior())',
	'zoomOut()',
	'zoomIn()',
	'chooseZoom(value)'
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
	ts.transpile('let isPresetOpen = false; let presetButton;\n' + handler) +
		'; return handleZoomKeydown;'
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
// Execute the actual dismissal/selection handlers with trigger/option focus.
const chooseHandler = toolbar.match(
	/function chooseZoom\(value: number \| ZoomMode\) \{[\s\S]*?\n\t\}/
)?.[0];
assert.ok(chooseHandler);
assert.match(toolbar, /<button\s+bind:this=\{presetButton\}[\s\S]*?aria-label="Zoom presets"/);
const runPreset = new Function(
	'zoom',
	'scroll',
	'HTMLElement',
	'presetButton',
	'event',
	'value',
	ts.transpile(
		'let isPresetOpen = true; let zoomDraft = "125";\n' + handler + '\n' + chooseHandler
	) +
		'; if (event) handleZoomKeydown(event); else chooseZoom(value); return { isPresetOpen, zoomDraft };'
);
for (const focused of ['trigger', 'option']) {
	let active = focused;
	const trigger = {
		focus() {
			active = 'trigger';
		}
	};
	let prevented = false;
	const result = runPreset(zoom, scroll, Element, trigger, {
		key: 'Escape',
		ctrlKey: false,
		target: new Element(),
		preventDefault() {
			prevented = true;
		}
	});
	assert.equal(result.isPresetOpen, false);
	assert.equal(active, 'trigger');
	assert.equal(prevented, true);
}
for (const value of [1.25, 'fit-page', 'fit-width']) {
	let active = 'option';
	const applied = [];
	const result = runPreset(
		{ provides: { requestZoom: (v) => applied.push(v) } },
		scroll,
		Element,
		{
			focus() {
				active = 'trigger';
			}
		},
		null,
		value
	);
	assert.deepEqual(applied, [value]);
	assert.deepEqual(result, { isPresetOpen: false, zoomDraft: null });
	assert.equal(active, 'trigger');
}
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
assert.ok(toolbar.includes('transition-opacity'));
console.log(
	'Viewer toolbar: editable page/zoom, custom presets, accessible controls, input guards and page boundaries PASS.'
);
