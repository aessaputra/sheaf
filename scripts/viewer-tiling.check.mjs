import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const viewer = readFileSync(
	new URL('../src/routes/v/[slug]/HeadlessViewer.svelte', import.meta.url),
	'utf8'
);

// The upstream TilingLayer renders {#each tiles (tile.id)} straight from the
// tiling store. Under rapid zoom oscillation the store can hold two tiles with
// the same id (stale fallback + fresh tile), and Svelte throws
// each_key_duplicate, killing the whole viewer (seen as 500 on brutal zoom).
// The viewer must route tiles through SafeTilingLayer, which enforces unique
// ids before they reach a keyed each block.
assert.ok(
	/import\s+SafeTilingLayer\s+from\s*'\.\/SafeTilingLayer\.svelte'/.test(viewer),
	'HeadlessViewer must import SafeTilingLayer'
);
assert.ok(/<SafeTilingLayer[\s>]/.test(viewer), 'HeadlessViewer must render SafeTilingLayer');
assert.ok(
	!/<TilingLayer[\s>]/.test(viewer.replace(/SafeTilingLayer/g, '')),
	'HeadlessViewer must not render the bare upstream TilingLayer'
);

const safe = readFileSync(
	new URL('../src/routes/v/[slug]/SafeTilingLayer.svelte', import.meta.url),
	'utf8'
);
// Must subscribe to the same tile stream the upstream layer uses.
assert.ok(/onTileRendering/.test(safe), 'SafeTilingLayer must subscribe to onTileRendering');
// Must enforce unique ids keyed by tile.id before rendering.
assert.ok(/tile\.id/.test(safe), 'SafeTilingLayer must key dedup on tile.id');
// On a duplicate id the fresh (non-fallback) tile must win so it mounts,
// renders, and drives the store back to a clean state via MARK_TILE_STATUS.
assert.ok(
	/isFallback/.test(safe),
	'SafeTilingLayer must prefer the non-fallback tile on duplicate ids'
);
// Must render the upstream TileImg so tile rendering behavior is unchanged.
assert.ok(/TileImg/.test(safe), 'SafeTilingLayer must render the upstream TileImg');

console.log('Viewer tiling guard: unique tile ids before keyed render PASS.');
