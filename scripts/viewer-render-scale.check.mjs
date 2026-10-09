import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from 'svelte/compiler';

const source = readFileSync(
	new URL('../src/routes/v/[slug]/HeadlessViewer.svelte', import.meta.url),
	'utf8'
);
const ast = parse(source, { modern: true });
const layers = [];
function visit(node) {
	if (!node || typeof node !== 'object') return;
	if (node.type === 'Component' && node.name === 'PagePointerProvider') {
		const children = node.fragment.nodes.filter((child) => child.type === 'Component');
		assert.deepEqual(
			children.map((child) => child.name),
			['RenderLayer', 'TilingLayer', 'AnnotationLayer']
		);
		layers.push(...children);
	}
	for (const value of Object.values(node)) {
		if (Array.isArray(value)) value.forEach(visit);
		else if (value && typeof value === 'object') visit(value);
	}
}
visit(ast.fragment);
assert.equal(layers.length, 3);
const scale = layers[0].attributes.find((attribute) => attribute.name === 'scale');
assert.equal(scale?.value.expression.value, 1, 'Reference base raster uses scale 1');
assert.ok(!layers[1].attributes.some((attribute) => attribute.name === 'scale'));
assert.match(
	source,
	/createPluginRegistration\(TilingPluginPackage,\s*\{\s*tileSize: 768,\s*overlapPx: 2\.5,\s*extraRings: 0/
);
console.log('Viewer tiling: reference base/detail layers and visible-only tile config PASS.');
