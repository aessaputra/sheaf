import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { parse } from 'svelte/compiler';
import ts from 'typescript';
import { PdfAnnotationSubtype, PdfBlendMode, PdfPermissionFlag } from '@embedpdf/models';

const path = new URL('../src/routes/v/[slug]/PdfSelection.svelte', import.meta.url);
assert.ok(existsSync(path), 'Viewer must provide text selection actions');
const source = readFileSync(path, 'utf8');
const ast = parse(source, { modern: true });
const script = ts.createSourceFile(
	'selection.ts',
	source.slice(ast.instance.content.start, ast.instance.content.end),
	ts.ScriptTarget.Latest,
	true
);
const handlers = script.statements
	.filter(ts.isFunctionDeclaration)
	.map((node) => node.getText(script));
const selections = [
	{
		pageIndex: 0,
		rect: { origin: { x: 10, y: 20 }, size: { width: 80, height: 12 } },
		segmentRects: [{ origin: { x: 10, y: 20 }, size: { width: 80, height: 12 } }]
	},
	{
		pageIndex: 1,
		rect: { origin: { x: 15, y: 25 }, size: { width: 90, height: 14 } },
		segmentRects: [{ origin: { x: 15, y: 25 }, size: { width: 90, height: 14 } }]
	}
];
function setup({
	failCopy = false,
	ready = true,
	allowed = true,
	empty = false,
	deferred = false
} = {}) {
	const created = [];
	const copied = [];
	const errors = [];
	let cleared = 0;
	let ids = 0;
	let range = { start: { page: 0, index: 0 }, end: { page: 0, index: 10 } };
	let finish;
	const wait = deferred
		? new Promise((resolve) => {
				finish = resolve;
			})
		: Promise.resolve();
	const selection = {
		getFormattedSelection: () => (empty ? [] : selections),
		getState: () => ({ selection: range }),
		getSelectedText: () => ({ toPromise: async () => ['First line', 'Second line'] }),
		clear: () => cleared++
	};
	const actions = new Function(
		'selectionScope',
		'annotationScope',
		'permissions',
		'navigator',
		'toast',
		'uuidV4',
		'PdfAnnotationSubtype',
		'PdfBlendMode',
		'PdfPermissionFlag',
		ts.transpile(
			`let busy = false; ${handlers.join('\n')} return { copySelection, highlightSelection, busy: () => busy };`
		)
	)(
		ready ? selection : null,
		ready ? { createAnnotation: (page, annotation) => created.push({ page, annotation }) } : null,
		{ hasPermission: () => allowed },
		{
			clipboard: {
				writeText: async (text) => {
					if (failCopy) throw new Error('Denied');
					copied.push(text);
					await wait;
				}
			}
		},
		{ error: (message) => errors.push(message) },
		() => `highlight-${++ids}`,
		PdfAnnotationSubtype,
		PdfBlendMode,
		PdfPermissionFlag
	);
	return {
		actions,
		created,
		copied,
		errors,
		cleared: () => cleared,
		finish: () => finish(),
		replace: () => {
			range = { start: { page: 1, index: 0 }, end: { page: 1, index: 10 } };
		}
	};
}
// Catch horizontal clipping at either edge, including scaled PDF pages.
const positionSource = handlers.find((handler) => handler.includes('function keepMenuInViewport'));
const position = new Function(
	'ResizeObserver',
	ts.transpile(positionSource) + '; return keepMenuInViewport;'
)(
	class {
		observe() {
			this.callback();
		}
		disconnect() {}
		constructor(callback) {
			this.callback = callback;
		}
	}
);
for (const scale of [0.5, 1, 1.5]) {
	for (const x of [-30, 291]) {
		const viewport = {
			getBoundingClientRect: () => ({ left: 0, right: 375 }),
			addEventListener() {},
			removeEventListener() {}
		};
		const menu = {
			style: {},
			offsetWidth: 182,
			closest: () => viewport,
			getBoundingClientRect() {
				return { left: x + parseFloat(this.style.left || '0') * scale, width: 182 * scale };
			}
		};
		const action = position(menu);
		const rect = menu.getBoundingClientRect();
		assert.ok(
			rect.left >= 8 && rect.left + rect.width <= 367,
			'Menu stays inside viewport at either edge'
		);
		action.destroy();
	}
}
const highlight = setup();
highlight.actions.highlightSelection();
assert.equal(highlight.created.length, 2, 'Every selected page gets a highlight');
for (const [index, { page, annotation }] of highlight.created.entries()) {
	assert.equal(page, index);
	assert.equal(annotation.pageIndex, index);
	assert.equal(annotation.type, PdfAnnotationSubtype.HIGHLIGHT);
	assert.deepEqual(annotation.rect, selections[index].rect);
	assert.deepEqual(annotation.segmentRects, selections[index].segmentRects);
	assert.equal(annotation.blendMode, PdfBlendMode.Multiply);
	assert.ok(annotation.strokeColor && annotation.opacity > 0);
}
assert.notEqual(highlight.created[0].annotation.id, highlight.created[1].annotation.id);
assert.equal(highlight.cleared(), 1);
const copy = setup();
await copy.actions.copySelection();
assert.deepEqual(copy.copied, ['First line\nSecond line']);
assert.equal(copy.cleared(), 1);
assert.equal(copy.actions.busy(), false);
const race = setup({ deferred: true });
const pendingCopy = race.actions.copySelection();
await Promise.resolve();
race.replace();
race.finish();
await pendingCopy;
assert.equal(race.cleared(), 0, 'Copy must preserve a newer selection');
const failed = setup({ failCopy: true });
await failed.actions.copySelection();
assert.equal(failed.cleared(), 0, 'Failed clipboard write preserves selection for retry');
assert.equal(failed.errors.length, 1);
assert.equal(failed.actions.busy(), false);
for (const options of [{ ready: false }, { allowed: false }, { empty: true }]) {
	const guarded = setup(options);
	guarded.actions.highlightSelection();
	await guarded.actions.copySelection();
	assert.deepEqual(guarded.created, []);
	assert.deepEqual(guarded.copied, []);
	assert.equal(guarded.cleared(), 0);
}
console.log(
	'PASS: multi-page session highlights, clipboard success/failure and permission guards.'
);
