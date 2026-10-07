// Run: node scripts/engine-lifecycle.check.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const component = readFileSync(
	new URL('../src/routes/v/[slug]/HeadlessViewer.svelte', import.meta.url),
	'utf8'
);
const script = component.match(/<script lang="ts">([\s\S]*?)<\/script>/)[1];
async function check(unmountFirst, closeFails = false) {
	let resolve;
	const pending = new Promise((done) => (resolve = done));
	let cleanup;
	let destroys = 0;
	let closes = 0;
	const engine = {
		closeAllDocuments: () => ({
			wait: (success, failure) => {
				closes++;
				(closeFails ? failure : success)();
			}
		}),
		destroy: () => destroys++
	};
	const context = {
		loadEngine: () => Promise.resolve({ createPdfiumEngine: () => pending }),
		onMount: (callback) => (cleanup = callback()),
		$props: () => ({ streamUrl: '/fixture.pdf' }),
		$state: (value) => value,
		$derived: (value) => value,
		createPluginRegistration: () => ({}),
		DocumentManagerPluginPackage: {},
		ViewportPluginPackage: {},
		ScrollPluginPackage: {},
		RenderPluginPackage: {},
		ZoomPluginPackage: {},
		ZoomMode: { FitWidth: 'fit-width' }
	};
	vm.createContext(context);
	// Execute the actual component lifecycle, substituting only the asynchronous factory boundary.
	const code = script
		.replace(/^\s*import\s+[\s\S]*?;$/gm, '')
		.replace(/import\('@embedpdf\/engines\/pdfium-worker-engine'\)/g, 'loadEngine()');
	vm.runInContext(
		ts.transpile(code, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext }),
		context
	);
	await Promise.resolve(); // Factory has started but its successful result is still pending.
	if (unmountFirst) cleanup();
	resolve(engine);
	await new Promise((done) => setImmediate(done));
	if (!unmountFirst) cleanup();
	assert.equal(destroys, 1, 'successful engine must be destroyed exactly once across unmount');
	assert.equal(closes, unmountFirst ? 0 : 1, 'only a published engine can have open documents');
}

await check(true);
await check(false);
await check(false, true);
console.log(
	'PASS: late success destroyed; mounted success closed/destroyed; close failure still destroys.'
);
