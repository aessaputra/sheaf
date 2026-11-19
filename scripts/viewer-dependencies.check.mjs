import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const pkg = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'));
const viewer = readFileSync(new URL('src/routes/v/[slug]/HeadlessViewer.svelte', root), 'utf8');

const embedpdf = Object.entries(pkg.dependencies).filter(([name]) => name.startsWith('@embedpdf/'));
assert.deepEqual(
	Object.fromEntries(embedpdf),
	{ '@embedpdf/engine': '3.3.0', '@embedpdf/svelte': '3.3.0' },
	'only the v3 engine and Svelte binding are direct dependencies'
);

assert.match(viewer, /import \{ localEngine \} from '@embedpdf\/engine'/);
assert.match(viewer, /engine=\{\(\) => localEngine\(\)\}/, 'Viewer owns the engine lifecycle');
for (const subpath of [
	'runtime',
	'stage',
	'render',
	'selection',
	'annotation',
	'interaction',
	'link'
]) {
	assert.match(
		viewer,
		new RegExp(`from '@embedpdf/svelte/${subpath}'`),
		`imports the v3 ${subpath} binding`
	);
}
assert.doesNotMatch(viewer, /@embedpdf\/(core|models|plugin-|engines)/, 'no v2 packages');
assert.doesNotMatch(viewer, /usePdfiumEngine|createPluginRegistration|LockModeType/);
assert.doesNotMatch(viewer, /cdn\.jsdelivr\.net|pdfium\.wasm/);

console.log('PASS: viewer uses only @embedpdf/svelte 3.3.0 + @embedpdf/engine 3.3.0.');
