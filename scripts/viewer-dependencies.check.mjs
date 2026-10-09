import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(
	new URL('../src/routes/v/[slug]/HeadlessViewer.svelte', import.meta.url),
	'utf8'
);
assert.match(
	source,
	/createPluginRegistration\(PanPluginPackage\)/,
	'Use the reference Pan registration and its touch-only default'
);
const { PanPluginPackage } = await import('@embedpdf/plugin-pan');
assert.equal(PanPluginPackage.manifest.defaultConfig.defaultMode, 'mobile');
const registrations = [...source.matchAll(/createPluginRegistration\((\w+PluginPackage)/g)].map(
	(match) => match[1]
);
const manifests = [];
for (const name of registrations) {
	const imports = [...source.matchAll(/import\s*\{([^}]+)\}\s*from\s*'(@embedpdf\/[^']+)'/g)];
	const declaration = imports.find((match) =>
		match[1].split(',').some((part) => part.trim() === name)
	);
	assert.ok(declaration, `import exists for ${name}`);
	const packageName = declaration[2].replace(/\/svelte$/, '');
	const exports = await import(packageName);
	manifests.push(exports[name].manifest);
}
const provided = new Set(manifests.flatMap((manifest) => manifest.provides));
for (const manifest of manifests) {
	for (const capability of manifest.requires) {
		assert.ok(
			provided.has(capability),
			`Missing required capability: ${capability} for plugin ${manifest.id}`
		);
	}
}
console.log('PASS: viewer registrations satisfy installed plugin manifests.');
