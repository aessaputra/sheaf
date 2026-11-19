import assert from 'node:assert/strict';
import { readPdfResponse } from '../src/routes/v/[slug]/viewer-fetch.ts';

function pdfResponse({ chunks, length, ok = true, status = 200, close = true, onCancel }) {
	return {
		ok,
		status,
		headers: new Headers(length === undefined ? {} : { 'content-length': String(length) }),
		body: new ReadableStream({
			start(controller) {
				for (const chunk of chunks) controller.enqueue(Uint8Array.from(chunk));
				if (close) controller.close();
			},
			cancel() {
				onCancel?.();
			}
		})
	};
}

const body = [0x25, 0x50, 0x44, 0x46, 1, 2, 3, 4];
for (const split of [1, 4]) {
	const percents = [];
	const result = await readPdfResponse(
		pdfResponse({ chunks: [body.slice(0, split), body.slice(split)], length: body.length }),
		(percent) => percents.push(percent)
	);
	assert.equal(result.ok, true, 'a complete body is accepted');
	assert.equal(result.status, 200);
	assert.deepEqual(new Uint8Array(await result.arrayBuffer()), Uint8Array.from(body));
	assert.equal(percents[0], 0, 'progress starts at zero');
	assert.equal(percents.at(-1), 100, 'progress reaches one hundred');
}

const withoutLength = pdfResponse({ chunks: [body] });
assert.equal(
	await readPdfResponse(withoutLength, () => assert.fail('progress without a length')),
	withoutLength,
	'a response without content-length is passed through untouched'
);

const notOk = pdfResponse({ chunks: [body], length: body.length, ok: false, status: 404 });
assert.equal(await readPdfResponse(notOk, () => {}), notOk, 'HTTP errors pass through untouched');

let cancelled = false;
const overrun = await readPdfResponse(
	pdfResponse({ chunks: [body], length: 4, close: false, onCancel: () => (cancelled = true) }),
	() => {}
);
assert.deepEqual(
	{ ok: overrun.ok, status: overrun.status },
	{ ok: false, status: 502 },
	'a body larger than its declared length fails'
);
assert.equal(cancelled, true, 'the unread body is cancelled');

const empty = await readPdfResponse(pdfResponse({ chunks: [], length: body.length }), () => {});
assert.deepEqual(
	{ ok: empty.ok, status: empty.status },
	{ ok: false, status: 502 },
	'an empty body fails'
);

const short = await readPdfResponse(
	pdfResponse({ chunks: [body.slice(0, 3)], length: body.length }),
	() => {}
);
assert.equal(short.ok, true, 'a short body keeps what arrived');
assert.deepEqual(new Uint8Array(await short.arrayBuffer()), Uint8Array.from(body.slice(0, 3)));

console.log('PASS: PDF download progress handles full, short, empty, overrun and error responses.');
