import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const toolbar = readFileSync(
	new URL('../src/routes/v/[slug]/ViewerToolbar.svelte', import.meta.url),
	'utf8'
);
const { parse } = await import('svelte/compiler');
const { default: ts } = await import('typescript');
const ast = parse(toolbar, { modern: true });
const script = ts.createSourceFile(
	'toolbar.ts',
	toolbar.slice(ast.instance.content.start, ast.instance.content.end),
	ts.ScriptTarget.Latest,
	true
);
function functionSource(name) {
	const declaration = script.statements.find(
		(node) => ts.isFunctionDeclaration(node) && node.name?.text === name
	);
	assert.ok(declaration, name);
	return declaration.getText(script);
}
// Check the actual event expressions so Enter and blur cannot diverge.
const inputs = [];
function visit(node) {
	if (!node || typeof node !== 'object') return;
	if (node.type === 'RegularElement' && node.name === 'input') inputs.push(node);
	for (const value of Object.values(node)) {
		if (Array.isArray(value)) value.forEach(visit);
		else if (value && typeof value === 'object') visit(value);
	}
}
visit(ast.fragment);
const zoomInput = inputs.find((node) =>
	node.attributes.some((attr) => attr.name === 'aria-label' && attr.value?.[0]?.data === 'Set zoom')
);
const blur = zoomInput.attributes.find((attr) => attr.name === 'onblur');
assert.equal(blur.value.expression.name, 'commitZoom');
const zoomEvents = ['onfocus', 'oninput', 'onblur', 'onkeydown']
	.map((name) => {
		const expression = zoomInput.attributes.find((attr) => attr.name === name).value.expression;
		return `${name}: ${toolbar.slice(expression.start, expression.end)}`;
	})
	.join(',');
const createZoomInput = new Function(
	'zoom',
	ts.transpile(`let zoomDraft = null;
${functionSource('validZoom')}
${functionSource('commitZoom')}
return { ${zoomEvents}, draft: () => zoomDraft };`)
);
// Execute the wired focus/input/keydown/blur sequence, including fit modes.
for (const mode of ['fit-page', 'fit-width', 1]) {
	for (const scenario of [
		{ value: null, key: null, expected: [] },
		{ value: null, key: 'Enter', expected: [] },
		{ value: '200', key: null, expected: [2] },
		{ value: '200', key: 'Enter', expected: [2] },
		{ value: '200', key: 'Escape', expected: [] },
		{ value: 'invalid', key: 'Enter', expected: [] },
		{ value: '19', key: null, expected: [] }
	]) {
		const applied = [];
		const handlers = createZoomInput({
			state: { zoomMode: mode, currentZoomLevel: 1.25 },
			provides: { requestZoom: (value) => applied.push(value) }
		});
		const currentTarget = {
			value: '125',
			select() {},
			blur: () => handlers.onblur()
		};
		handlers.onfocus({ currentTarget });
		if (scenario.value !== null) {
			currentTarget.value = scenario.value;
			handlers.oninput({ currentTarget });
		}
		if (scenario.key) {
			handlers.onkeydown({
				key: scenario.key,
				isComposing: false,
				preventDefault() {},
				currentTarget
			});
		}
		handlers.onblur(); // A subsequent blur cannot apply the draft twice.
		assert.equal(handlers.draft(), null);
		assert.deepEqual(applied, scenario.expected, `${mode}: ${JSON.stringify(scenario)}`);
	}
}
const handler = functionSource('handleZoomKeydown');
const presetDeclaration = script.statements
	.filter(ts.isVariableStatement)
	.flatMap((node) => [...node.declarationList.declarations])
	.find((node) => node.name.getText(script) === 'presets');
const presets = new Function('ZoomMode', `return ${presetDeclaration.initializer.getText(script)}`)(
	{ FitPage: 'fit-page', FitWidth: 'fit-width' }
);
assert.deepEqual(
	presets.map(({ value }) => value),
	[0.25, 0.5, 1, 1.25, 1.5, 2, 4, 8, 16, 'fit-page', 'fit-width']
);
assert.match(toolbar, /popover="auto"/);
assert.match(toolbar, /popovertarget=\{presetId\}/);
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
// Preset selection applies zoom, closes the native popover, and restores focus.
for (const value of [1.25, 'fit-page', 'fit-width']) {
	const applied = [];
	let closed = false;
	let focused = false;
	const choose = new Function(
		'zoom',
		'presetMenu',
		'presetButton',
		ts.transpile('let zoomDraft = "125";\n' + functionSource('chooseZoom')) + '; return chooseZoom;'
	)(
		{ provides: { requestZoom: (v) => applied.push(v) } },
		{
			hidePopover: () => {
				closed = true;
			}
		},
		{
			focus: () => {
				focused = true;
			}
		}
	);
	choose(value);
	assert.deepEqual(applied, [value]);
	assert.ok(closed && focused);
}
// Activity must not hide navigation held by either pointer or keyboard.
const createNav = new Function(
	'setTimeout',
	'clearTimeout',
	ts.transpile(`let navVisible = true; let hideTimer; let navHovered = false; let navFocused = false;
${functionSource('startHideTimer')}
${functionSource('showNav')}
${functionSource('holdNav')}
return { startHideTimer, showNav, holdNav, hover: (v) => navHovered = v, focus: (v) => navFocused = v, visible: () => navVisible };`)
);
let pending;
const nav = createNav(
	(callback) => {
		pending = callback;
		return 1;
	},
	() => {
		pending = undefined;
	}
);
nav.startHideTimer();
pending();
assert.equal(nav.visible(), false);
for (const hold of ['hover', 'focus']) {
	nav[hold](true);
	nav.holdNav();
	nav.showNav();
	assert.equal(pending, undefined);
	assert.equal(nav.visible(), true);
	nav[hold](false);
	nav.startHideTimer();
	pending();
	assert.equal(nav.visible(), false);
}
// Moving focus between navigation controls must not release the hold.
class FocusNode {}
let released = 0;
const release = new Function(
	'Node',
	'startHideTimer',
	ts.transpile('let navFocused = true;\n' + functionSource('releaseNavFocus')) +
		'; return releaseNavFocus;'
)(FocusNode, () => released++);
const inside = new FocusNode();
release({ relatedTarget: inside, currentTarget: { contains: (node) => node === inside } });
assert.equal(released, 0);
release({ relatedTarget: new FocusNode(), currentTarget: { contains: () => false } });
release({ relatedTarget: null, currentTarget: { contains: () => false } });
assert.equal(released, 2);

// Exercise real input handlers, not a parallel parser.
const inputHandlers = ['commitPage', 'validZoom', 'commitZoom'].map(functionSource).join('\n');
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
console.log(
	'PASS: toolbar input boundaries, keyboard guards, preset selection and held navigation.'
);
