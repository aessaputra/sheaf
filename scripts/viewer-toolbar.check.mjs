import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
	pageIndex,
	validZoom,
	zoomLevel,
	zoomShortcut
} from '../src/routes/v/[slug]/toolbar-logic.ts';

const toolbar = readFileSync(
	new URL('../src/routes/v/[slug]/ViewerToolbar.svelte', import.meta.url),
	'utf8'
);

assert.match(toolbar, /from '@embedpdf\/svelte\/stage'/);
assert.match(toolbar, /from '@embedpdf\/svelte\/interaction'/);
assert.match(toolbar, /from '@embedpdf\/svelte\/selection'/);
assert.match(toolbar, /from '.\/toolbar-logic'/);
assert.doesNotMatch(toolbar, /@embedpdf\/plugin-/);
for (const call of [
	'useStage()',
	'useStageState()',
	'useStageEvent(',
	'useInteraction()',
	'useInteractionState()',
	'useSelection()',
	'stage.goToPage(',
	'stage.zoomTo(',
	'stage.previousPage(',
	'stage.nextPage(',
	'stage.fitPage()',
	'stage.fitWidth()',
	'stage.zoomIn()',
	'stage.zoomOut()',
	"activateTool('pointer')",
	'selection.clear()',
	'onblur={commitZoom}',
	'onblur={commitPage}',
	'zoomShortcut(event, stageState.pageCount)',
	'chooseZoom(value)'
]) {
	assert.ok(toolbar.includes(call), `toolbar uses ${call}`);
}

for (const value of [null, '', ' ', '-100', '0', '19', '6001', '100x', '0x64', '1e2']) {
	assert.equal(validZoom(value), false, `rejects zoom ${JSON.stringify(value)}`);
	assert.equal(zoomLevel(value), null, `rejects zoom level ${JSON.stringify(value)}`);
}
for (const value of ['20', '125.5', '6000']) {
	assert.equal(validZoom(value), true, `accepts zoom ${value}`);
	assert.equal(zoomLevel(value), Number(value) / 100);
}

for (const value of [null, '', ' ', '-1', '0', '4', '1.5', '2x', 'Infinity', 'NaN']) {
	assert.equal(pageIndex(value, 3), null, `rejects page ${JSON.stringify(value)}`);
}
assert.equal(pageIndex('1', 3), 0);
assert.equal(pageIndex('3', 3), 2);
assert.equal(pageIndex('1', 0), null);

class Element {
	constructor(editable = false, field = false) {
		this.isContentEditable = editable;
		this.field = field;
	}
	closest() {
		return this.field ? this : null;
	}
}
globalThis.HTMLElement = Element;
function keyEvent(key, overrides = {}) {
	return {
		key,
		ctrlKey: true,
		altKey: false,
		metaKey: false,
		isComposing: false,
		defaultPrevented: false,
		target: new Element(),
		...overrides
	};
}

assert.equal(zoomShortcut(keyEvent('-'), 3), 'out');
assert.equal(zoomShortcut(keyEvent('+'), 3), 'in');
assert.equal(zoomShortcut(keyEvent('='), 3), 'in');
for (const overrides of [
	{ ctrlKey: false },
	{ altKey: true },
	{ metaKey: true },
	{ isComposing: true },
	{ defaultPrevented: true },
	{ target: new Element(true) },
	{ target: new Element(false, true) }
]) {
	assert.equal(zoomShortcut(keyEvent('+', overrides), 3), null);
}
assert.equal(zoomShortcut(keyEvent('0'), 3), null);
assert.equal(zoomShortcut(keyEvent('+'), 0), null);

console.log('PASS: toolbar uses Stage/Interaction APIs with valid page and zoom boundaries.');
