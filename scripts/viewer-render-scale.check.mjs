import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from 'svelte/compiler';

const source = readFileSync(
	new URL('../src/routes/v/[slug]/HeadlessViewer.svelte', import.meta.url),
	'utf8'
);
const ast = parse(source, { modern: true });
let stage;
function visit(node) {
	if (!node || typeof node !== 'object') return;
	if (node.type === 'Component' && node.name === 'Stage') stage = node;
	for (const value of Object.values(node)) {
		if (Array.isArray(value)) value.forEach(visit);
		else if (value && typeof value === 'object') visit(value);
	}
}
visit(ast.fragment);
assert.ok(stage, 'Stage rendered');
const layers = stage.fragment.nodes.filter((node) => node.type === 'Component');
assert.deepEqual(
	layers.map((node) => node.name),
	['RenderLayer', 'SelectionLayer', 'AnnotationLayer', 'LinkLayer']
);
const renderLayer = layers.find((node) => node.name === 'RenderLayer');
assert.equal(renderLayer.attributes.length, 0, 'RenderLayer takes no scale/dpr props in v3');

console.log('PASS: Stage draws the v3 page layers in order without v2 scale props.');
