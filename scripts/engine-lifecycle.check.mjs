// Integration contract only: engine cleanup is now owned by the upstream hook.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse, compile } from 'svelte/compiler';
import ts from 'typescript';

const source = readFileSync(
	new URL('../src/routes/v/[slug]/HeadlessViewer.svelte', import.meta.url),
	'utf8'
);
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
assert.equal(declaration.initializer.arguments.length, 0, 'Use the version-matched default CDN');
assert.match(source, /from '@embedpdf\/engines\/svelte'/);
assert.doesNotMatch(source, /onMount|createPdfiumEngine|closeAllDocuments|\.destroy\(/);
assert.ok(source.indexOf('{#if pdfEngine.error}') < source.indexOf('pdfEngine.isLoading'));
assert.match(source, /<EmbedPDF engine=\{pdfEngine.engine\}/);
compile(source, { generate: 'client' });
console.log(
	'PASS: official engine hook, default CDN WASM, error-first state and client compilation. Cleanup delegated to EmbedPDF.'
);
