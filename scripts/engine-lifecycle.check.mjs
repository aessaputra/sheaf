// Executes the installed hook or the viewer's compiled lifecycle with real Svelte effects.
// Only engine creation is stubbed: counters are NOT browser Worker/RSS measurements.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse, compile, compileModule } from 'svelte/compiler';
import ts from 'typescript';
// eslint-disable-next-line svelte/no-svelte-internal -- check-only harness; public svelte entry exposes flushSync but not effect_root
import * as runtime from 'svelte/internal/client';
import { flushSync } from 'svelte';

const viewerUrl = new URL('../src/routes/v/[slug]/HeadlessViewer.svelte', import.meta.url);
const source = readFileSync(viewerUrl, 'utf8');
const ast = parse(source, { modern: true });
const script = ts.createSourceFile(
	'viewer.ts',
	source.slice(ast.instance.content.start, ast.instance.content.end),
	ts.ScriptTarget.Latest,
	true
);
const declaration = script.statements
	.filter(ts.isVariableStatement)
	.flatMap((node) => [...node.declarationList.declarations])
	.find((node) => node.name.getText(script) === 'pdfEngine');
assert.equal(declaration.initializer.expression.getText(script), 'usePdfiumEngine');
assert.equal(declaration.initializer.arguments.length, 0);
const upstreamUrl = new URL(
	'../node_modules/@embedpdf/engines/dist/svelte/index.js',
	import.meta.url
);
const upstream = readFileSync(upstreamUrl, 'utf8');
const engineStub =
	'data:text/javascript,' +
	encodeURIComponent(
		'export const createPdfiumEngine = (...args) => globalThis.__sheafEngineCheck.create(...args);'
	);
function executable(code) {
	return code
		.replace(/(["'])(svelte(?:\/[^"']*)?|@embedpdf\/models)\1/g, (_, quote, name) =>
			JSON.stringify(import.meta.resolve(name))
		)
		.replace(
			/(["'])@embedpdf\/engines\/pdfium-(?:worker|direct)-engine\1/g,
			JSON.stringify(engineStub)
		);
}
async function load(code) {
	return import('data:text/javascript,' + encodeURIComponent(executable(code)));
}
globalThis.window = {};
const installed = await load(upstream);
const moduleSource = readFileSync(new URL('pdf-engine.svelte.ts', viewerUrl), 'utf8');
const js = ts.transpileModule(moduleSource, {
	compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext }
}).outputText;
const production = await load(
	compileModule(js, { filename: 'pdf-engine.svelte.js', generate: 'client' }).js.code
);
const settle = async () => {
	for (let i = 0; i < 12; i++) await Promise.resolve();
	flushSync();
};
async function scenario(
	hook,
	{ late = false, rejectInit = false, rejectClose = false, repeat = 1 } = {}
) {
	const counters = { created: 0, closed: 0, destroyed: 0, live: 0, publishedAfterUnmount: 0 };
	for (let i = 0; i < repeat; i++) {
		let resolve, reject;
		const pending = new Promise((yes, no) => {
			resolve = yes;
			reject = no;
		});
		globalThis.__sheafEngineCheck = {
			create(url) {
				assert.equal(url, 'https://cdn.jsdelivr.net/npm/@embedpdf/pdfium@2.15.1/dist/pdfium.wasm');
				return pending;
			}
		};
		let state;
		const unmount = runtime.effect_root(() => {
			state = hook();
		});
		flushSync();
		await settle();
		if (late) unmount();
		if (rejectInit) reject(new Error('controlled init failure'));
		else {
			counters.created++;
			counters.live++;
			resolve({
				closeAllDocuments() {
					counters.closed++;
					return {
						wait(success, failure) {
							queueMicrotask(() =>
								rejectClose ? failure(new Error('controlled close failure')) : success()
							);
						}
					};
				},
				destroy() {
					counters.destroyed++;
					counters.live--;
				}
			});
		}
		await settle();
		if (late && state.engine) counters.publishedAfterUnmount++;
		if (!late) {
			if (rejectInit) assert.ok(state.error);
			else {
				assert.ok(state.engine);
				assert.equal(state.isLoading, false);
			}
			unmount();
		}
		await settle();
		if (late && rejectInit) assert.equal(state.error, null);
	}
	delete globalThis.__sheafEngineCheck;
	return counters;
}
const baseline = await scenario(installed.usePdfiumEngine, { late: true, repeat: 10 });
console.log('Installed hook late-success/unmount (stub resources):', JSON.stringify(baseline));
assert.deepEqual(
	baseline,
	{ created: 10, closed: 0, destroyed: 0, live: 10, publishedAfterUnmount: 10 },
	'Installed-hook reproduction changed; reassess workaround'
);
const late = await scenario(production.usePdfiumEngine, { late: true, repeat: 10 });
console.log('Viewer late-success/unmount (stub resources):', JSON.stringify(late));
assert.deepEqual(
	late,
	{ created: 10, closed: 10, destroyed: 10, live: 0, publishedAfterUnmount: 0 },
	'Late engine must be disposed, never published'
);
const closeFailure = await scenario(production.usePdfiumEngine, { rejectClose: true });
console.log('Viewer close failure (stub resources):', JSON.stringify(closeFailure));
assert.equal(closeFailure.live, 0, 'Destroy must still run when document close fails');
for (const options of [
	{},
	{ late: true, rejectClose: true },
	{ rejectInit: true },
	{ late: true, rejectInit: true }
]) {
	const result = await scenario(production.usePdfiumEngine, options);
	assert.equal(result.live, 0);
	assert.equal(result.destroyed, result.created);
}
assert.ok(source.indexOf('{#if pdfEngine.error}') < source.indexOf('pdfEngine.isLoading'));
assert.match(source, /<EmbedPDF engine=\{pdfEngine.engine\}/);
assert.match(source, /from '\.\/pdf-engine\.svelte'/);
compile(source, { generate: 'client' });
console.log(
	'PASS: lifecycle timing, initialization failure, default CDN and viewer client compilation'
);
