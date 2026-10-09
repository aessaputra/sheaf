// Run: node scripts/file-response.check.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(
	new URL('../src/routes/v/[slug]/file/+server.ts', import.meta.url),
	'utf8'
);
const data = new TextEncoder().encode('%PDF-fixture');
const context = {
	Response,
	Headers,
	env: {
		DB: {},
		PDFS: {
			get: async (_key, { range }) => {
				const partial = range.has('range');
				return {
					body: partial ? data.slice(1, 4) : data,
					size: data.length,
					range: { offset: partial ? 1 : 0, length: partial ? 3 : data.length },
					httpEtag: '"fixture"',
					writeHttpMetadata: () => {}
				};
			}
		}
	},
	drizzle: () => ({
		select: () => ({
			from: () => ({ where: () => ({ limit: async () => [{ r2Key: 'fixture' }] }) })
		})
	}),
	pdfFiles: { slug: 'slug' },
	eq: () => {},
	error: (status) => new Error(String(status))
};
vm.createContext(context);
vm.runInContext(
	ts.transpile(
		source
			.replace(/^import .*;$/gm, '')
			.replace('export const GET: RequestHandler', 'globalThis.GET'),
		{
			target: ts.ScriptTarget.ES2022
		}
	),
	context
);
for (const partial of [false, true]) {
	const response = await context.GET({
		params: { slug: '22222222' },
		request: new Request('http://localhost/v/22222222/file', {
			headers: partial ? { Range: 'bytes=1-3' } : {}
		})
	});
	assert.equal(response.status, partial ? 206 : 200);
	assert.equal(response.headers.get('content-range'), partial ? `bytes 1-3/${data.length}` : null);
	assert.deepEqual(new Uint8Array(await response.arrayBuffer()), partial ? data.slice(1, 4) : data);
}
console.log(
	'PASS: full R2 metadata yields 200 without Range; requested range yields 206 with exact bytes.'
);
