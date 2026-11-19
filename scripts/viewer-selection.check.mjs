import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { copySelectedText } from '../src/routes/v/[slug]/selection-actions.ts';

const root = new URL('../', import.meta.url);
const selection = readFileSync(new URL('src/routes/v/[slug]/PdfSelection.svelte', root), 'utf8');
const viewer = readFileSync(new URL('src/routes/v/[slug]/HeadlessViewer.svelte', root), 'utf8');

assert.match(selection, /from '@embedpdf\/svelte\/selection'/);
assert.match(selection, /from '.\/selection-actions'/);
assert.match(selection, /<SelectionMenu /);
assert.match(selection, /copySelectedText\(/);
assert.match(selection, /copySelection\(scope\)/, 'copy uses the v3 clipboard helper');
assert.match(selection, /annotation\.createFromSelection\('highlight'\)/);
assert.match(selection, /selection\.canCopy\(\)/);
assert.match(selection, /annotation\.canCreate\(\)/);
assert.match(selection, /aria-label="Text selection actions"/);
assert.doesNotMatch(selection, /@embedpdf\/models|PdfAnnotationSubtype|PdfPermissionFlag|uuidV4/);
assert.doesNotMatch(selection, /selectionMenuSnippet|keepMenuInViewport/);
assert.match(
	viewer,
	/tools: \[\{ id: 'highlight', defaults: \{ color: '#FFCD45' \} \}\]/,
	'highlight color preserved'
);
assert.match(viewer, /annotationPlugin\(\{[\s\S]*editable: false/);

function fakeSelection(range, canCopy = true) {
	let current = range;
	let cleared = false;
	return {
		canCopy: () => canCopy,
		getRange: () => current,
		clear: () => {
			cleared = true;
			current = null;
		},
		replaceRange: (next) => {
			current = next;
		},
		get cleared() {
			return cleared;
		}
	};
}

const blocked = fakeSelection({ id: 1 }, false);
let copies = 0;
let errors = 0;
await copySelectedText(
	blocked,
	async () => {
		copies++;
	},
	() => errors++
);
assert.equal(copies, 0, 'copy is skipped without permission');
assert.equal(blocked.cleared, false);

const copied = fakeSelection({ id: 1 });
await copySelectedText(
	copied,
	async () => {
		copies++;
	},
	() => errors++
);
assert.equal(copies, 1, 'copy runs with permission');
assert.equal(copied.cleared, true, 'the copied selection is cleared');
assert.equal(errors, 0);

const raced = fakeSelection({ id: 1 });
await copySelectedText(
	raced,
	async () => {
		raced.replaceRange({ id: 2 });
	},
	() => errors++
);
assert.equal(raced.cleared, false, 'a newer selection survives the clipboard await');

const failed = fakeSelection({ id: 1 });
await copySelectedText(
	failed,
	async () => {
		throw new Error('clipboard denied');
	},
	() => errors++
);
assert.equal(failed.cleared, false, 'failed copy keeps the selection');
assert.equal(errors, 1, 'failed copy reports the error');

console.log('PASS: selection menu keeps Copy + Highlight with v3 capabilities.');
