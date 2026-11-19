import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const viewer = readFileSync(new URL('src/routes/v/[slug]/HeadlessViewer.svelte', root), 'utf8');

assert.match(viewer, /renderPlugin\(\)/, 'render plugin registered');
assert.match(viewer, /<RenderLayer \/>/, 'render layer draws each page');
assert.doesNotMatch(viewer, /SafeTilingLayer|plugin-tiling/);
assert.equal(
	existsSync(new URL('src/routes/v/[slug]/SafeTilingLayer.svelte', root)),
	false,
	'custom tiling workaround removed'
);

console.log('PASS: v3 renderPlugin owns tiling; the custom SafeTilingLayer is gone.');
