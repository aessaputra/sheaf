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
			head: async () => ({
				size: data.length,
				httpEtag: '"fixture"',
				writeHttpMetadata: () => {}
			}),
			get: async (...args) => {
				const { range } = args[1] ?? {};
				// Production only sends explicit { offset, length }; raw headers are a regression.
				if (range instanceof Headers) throw new Error('raw headers must not be forwarded');
				const offset = range?.offset ?? 0;
				const length = range?.length ?? data.length - offset;
				return {
					body: data.slice(offset, offset + length),
					size: data.length,
					range: { offset, length },
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
async function fetchFile(range) {
	return context.GET({
		params: { slug: '22222222' },
		request: new Request('http://localhost/v/22222222/file', {
			headers: range ? { Range: range } : {}
		})
	});
}
for (const [range, status, contentRange, bytes] of [
	[undefined, 200, null, data],
	['bytes=1-3', 206, `bytes 1-3/${data.length}`, data.slice(1, 4)],
	['bytes=1-', 206, `bytes 1-${data.length - 1}/${data.length}`, data.slice(1)],
	['bytes=-3', 206, `bytes ${data.length - 3}-${data.length - 1}/${data.length}`, data.slice(-3)],
	[`bytes=${data.length}-${data.length + 100}`, 416, `bytes */${data.length}`, null],
	['bytes=5-1', 416, `bytes */${data.length}`, null],
	['bytes=-0', 416, `bytes */${data.length}`, null],
	['bytes=abc-def', 200, null, data]
]) {
	const response = await fetchFile(range);
	assert.equal(response.status, status, `Range ${range}`);
	assert.equal(response.headers.get('content-range'), contentRange, `Content-Range ${range}`);
	if (bytes) assert.deepEqual(new Uint8Array(await response.arrayBuffer()), bytes);
	assert.ok(
		!source.includes('{ range: request.headers }'),
		'Must not forward raw Range headers to R2'
	);
}
console.log(
	'PASS: full R2 metadata yields 200 without Range; valid ranges yield 206; unsatisfiable yields 416, never 500.'
);
