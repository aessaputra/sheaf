import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const row = readFileSync(new URL('../src/lib/components/FileRow.svelte', import.meta.url), 'utf8');
const upload = readFileSync(
	new URL('../src/lib/components/UploadCard.svelte', import.meta.url),
	'utf8'
);
for (const source of [row, upload]) {
	assert.doesNotMatch(source, /class="truncate/, 'Full filenames must wrap, not truncate');
	assert.match(source, /\bwrap-anywhere\b/, 'Unbroken filenames must fit narrow screens');
}
assert.match(row, /flex-wrap/, 'Mobile actions may move below the filename');
assert.match(row, /w-full[^"\n]*sm:w-auto/, 'Filename gets a full row on mobile');
for (const name of ['FileRow', 'CopyLinkButton', 'OpenLinkButton']) {
	const source = readFileSync(
		new URL(`../src/lib/components/${name}.svelte`, import.meta.url),
		'utf8'
	);
	assert.ok(/min-h-11/.test(source), `${name}: minimum 44px touch height`);
	assert.ok(/min-w-11/.test(source), `${name}: minimum 44px touch width`);
	assert.ok(/focus-visible:outline-2/.test(source), `${name}: visible keyboard focus`);
}
console.log('PASS: admin filenames wrap, actions have 44px targets and visible focus.');
