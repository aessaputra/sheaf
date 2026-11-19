import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const viewer = readFileSync(new URL('src/routes/v/[slug]/HeadlessViewer.svelte', root), 'utf8');

// shortcut: warmup and disposal belong to the v3 Viewer; this checks only our contract. Real
// lifecycle needs a browser and WASM, so run the browser smoke test after upgrading EmbedPDF.
assert.match(
	viewer,
	/engine=\{\(\) => localEngine\(\)\}/,
	'Viewer creates and destroys the engine'
);
assert.match(viewer, /import \{ localEngine \} from '@embedpdf\/engine'/);
assert.doesNotMatch(viewer, /usePdfiumEngine/);
assert.doesNotMatch(viewer, /import\(['"]@embedpdf\/engines/);
assert.doesNotMatch(viewer, /\.warmup\(|\.destroy\(/, 'the viewer owns warmup and disposal');
assert.equal(
	existsSync(new URL('src/routes/v/[slug]/pdf-engine.svelte.ts', root)),
	false,
	'custom engine lifecycle removed'
);

console.log('PASS: the v3 Viewer owns the local engine lifecycle.');
