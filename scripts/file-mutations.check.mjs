import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { moduleUrl } from './check-source.mjs';
import { limitBodyStream } from '../src/lib/server/body-limit.ts';

const root = new URL('../', import.meta.url);
const logs = [];
const originalError = console.error;
console.error = (...args) => logs.push(args);
const objects = new Map();
const rows = new Map();
let fault;
const fixture = {
	error: (status, message) => Object.assign(new Error(message), { status }),
	limitBodyStream,
	env: {
		PDFS: {
			async put(key, stream) {
				objects.set(key, await new Response(stream).text());
				if (fault === 'put') throw new Error('private provider details');
			},
			async delete(key) {
				if (fault === 'cleanup' || fault === 'r2-delete')
					throw new Error('private provider details');
				objects.delete(key);
			}
		},
		DB: {}
	},
	pdfFiles: { slug: 'slug', r2Key: 'r2Key' },
	eq: (_, slug) => slug,
	drizzle: () => ({
		insert: () => ({
			async values(row) {
				if (rows.has(row.slug)) throw new Error('UNIQUE constraint failed: pdf_files.slug');
				if (fault === 'insert' || fault === 'cleanup') throw new Error('private DB details');
				rows.set(row.slug, row);
			}
		}),
		select: () => ({
			from: () => ({ where: async (slug) => (rows.has(slug) ? [rows.get(slug)] : []) })
		}),
		delete: () => ({
			async where(slug) {
				if (fault === 'd1-delete') throw new Error('private DB details');
				rows.delete(slug);
			}
		})
	})
};
globalThis.__filesCheck = fixture;
async function load(path) {
	let source = await readFile(new URL(path, root), 'utf8');
	source = source.replace(/^import .* from '(?!\.\/\$types)[^']+';$/gm, '');
	return import(
		moduleUrl(
			`const { error, env, drizzle, eq, pdfFiles, limitBodyStream } = globalThis.__filesCheck;\n${source}`
		)
	);
}
const { POST } = await load('src/routes/api/files/+server.ts');
const { DELETE } = await load('src/routes/api/files/[slug]/+server.ts');
const upload = () => {
	const form = new FormData();
	form.set('file', new File(['%PDF-new'], 'private-name.pdf', { type: 'application/pdf' }));
	return POST({
		locals: { session: true },
		request: new Request('https://sheaf.example.test/api/files', { method: 'POST', body: form })
	});
};
const remove = (slug) => DELETE({ locals: { session: true }, params: { slug } });
const originalRandom = crypto.getRandomValues;
try {
	await assert.rejects(
		() =>
			POST({
				locals: { session: true },
				request: {
					headers: new Headers({ 'content-length': String(28 * 1024 * 1024) }),
					body: null
				}
			}),
		{ status: 413 },
		'oversized declared body is rejected before parsing'
	);
	const limitedStream = limitBodyStream(
		new Request('https://sheaf.example.test/api/files', {
			method: 'POST',
			body: new Uint8Array(1024)
		}),
		100
	);
	await assert.rejects(() => new Response(limitedStream.stream).arrayBuffer());
	assert.equal(limitedStream.exceeded(), true, 'oversized streamed body is rejected while reading');
	crypto.getRandomValues = (bytes) => bytes.fill(0);
	rows.set('00000000', { slug: '00000000', r2Key: 'pdfs/00000000.pdf' });
	objects.set('pdfs/00000000.pdf', '%PDF-original');
	await assert.rejects(upload, { status: 500 });
	assert.equal(objects.get('pdfs/00000000.pdf'), '%PDF-original', 'collision preserves original');
	assert.equal(objects.size, 1, 'collision attempts cleaned up');
	let draws = 0;
	crypto.getRandomValues = (bytes) => bytes.fill(draws++ === 0 ? 0 : 1);
	const retried = await (await upload()).json();
	assert.equal(retried.slug, '11111111', 'collision retries with a fresh slug');
	assert.equal(objects.get('pdfs/00000000.pdf'), '%PDF-original');
	await remove(retried.slug);
	crypto.getRandomValues = originalRandom;
	for (fault of ['put', 'insert', 'cleanup']) {
		logs.length = 0;
		await assert.rejects(
			upload,
			(e) => e.status === 500 && !e.message.includes('Nothing was saved')
		);
		assert.ok(logs.some(([, detail]) => detail.stage === fault));
		assert.equal(JSON.stringify(logs).includes('private'), false);
		assert.equal(objects.size, fault === 'cleanup' ? 2 : 1);
		for (const key of objects.keys()) if (key !== 'pdfs/00000000.pdf') objects.delete(key);
	}
	fault = undefined;
	const { slug } = await (await upload()).json();
	const key = rows.get(slug).r2Key;
	assert.match(key, /^pdfs\/[0-9a-f-]{36}\.pdf$/);
	assert.equal(objects.get(key), '%PDF-new');
	fault = 'r2-delete';
	await assert.rejects(() => remove(slug), { status: 500 });
	assert.ok(rows.has(slug));
	assert.ok(objects.has(key));
	fault = 'd1-delete';
	await assert.rejects(
		() => remove(slug),
		(e) => e.status === 500 && /retry/i.test(e.message)
	);
	assert.ok(rows.has(slug));
	assert.equal(objects.has(key), false);
	fault = undefined;
	assert.deepEqual(await (await remove(slug)).json(), { ok: true });
	assert.deepEqual(await (await remove(slug)).json(), { ok: true });
	assert.deepEqual(await (await remove('00000000')).json(), { ok: true });
	assert.equal(objects.size, 0, 'legacy stored key deleted');
	rows.set('99999999', { slug: '99999999', r2Key: 'secret/other' });
	objects.set('secret/other', 'keep');
	await assert.rejects(() => remove('99999999'), { status: 500 });
	assert.ok(rows.has('99999999'), 'unexpected key keeps metadata for cleanup');
	assert.ok(objects.has('secret/other'), 'unexpected key never deletes an arbitrary object');
	rows.delete('99999999');
	objects.delete('secret/other');
	console.log(
		'File mutation checks passed (collision, put/insert/cleanup faults, delete retry and legacy keys)'
	);
} finally {
	crypto.getRandomValues = originalRandom;
	console.error = originalError;
	delete globalThis.__filesCheck;
}
