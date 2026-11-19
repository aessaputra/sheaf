import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const viewer = readFileSync(new URL('src/routes/v/[slug]/HeadlessViewer.svelte', root), 'utf8');

assert.match(viewer, /import \{ LinkLayer, linkPlugin \} from '@embedpdf\/svelte\/link'/);
assert.match(viewer, /linkPlugin\(\)/, 'link plugin registered');
assert.match(viewer, /<LinkLayer \/>/, 'link layer rendered on each page');
assert.doesNotMatch(viewer, /PdfLink|autoOpenLinks|annotationRenderers|window\.open/);
assert.doesNotMatch(viewer, /target=["']_blank["']/);
assert.equal(
	existsSync(new URL('src/routes/v/[slug]/PdfLink.svelte', root)),
	false,
	'custom link popover removed'
);
assert.equal(
	existsSync(new URL('src/routes/v/[slug]/PdfLinkNavigation.svelte', root)),
	false,
	'custom link navigation removed'
);

console.log('PASS: links use the v3 linkPlugin and LinkLayer, not a popover.');
