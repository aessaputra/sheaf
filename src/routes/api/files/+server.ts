import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from 'cloudflare:workers';
import { drizzle } from 'drizzle-orm/d1';
import { listFiles } from '#lib/server/admin-files.ts';
import { pdfFiles } from '#lib/server/db/schema.ts';
import { MAX_UPLOAD_BYTES } from '#lib/upload-limit.ts';

const SLUG_LEN = 8;
const ALPHABET = '0123456789abcdefghjkmnpqrstuvwxyz';

// R2 needs a known stream length. Read the first bytes to check the PDF signature, then replay
// them and the rest of the body through a FixedLengthStream.
async function pdfStream(
	body: ReadableStream<Uint8Array> | null,
	length: number
): Promise<ReadableStream<Uint8Array>> {
	if (!body) throw error(400, 'No file provided.');
	const reader = body.getReader();
	const chunks: Uint8Array[] = [];
	const head = new Uint8Array(4);
	let filled = 0;
	while (filled < 4) {
		const { done, value } = await reader.read();
		if (done) break;
		chunks.push(value);
		const take = Math.min(value.byteLength, 4 - filled);
		head.set(value.subarray(0, take), filled);
		filled += take;
	}
	if (filled < 4 || head[0] !== 0x25 || head[1] !== 0x50 || head[2] !== 0x44 || head[3] !== 0x46) {
		await reader.cancel().catch(() => {});
		throw error(400, 'Only PDF files are accepted.');
	}
	const checked = new ReadableStream<Uint8Array>({
		start(controller) {
			for (const chunk of chunks) controller.enqueue(chunk);
		},
		async pull(controller) {
			const { done, value } = await reader.read();
			if (done) controller.close();
			else controller.enqueue(value);
		},
		cancel(reason) {
			return reader.cancel(reason);
		}
	});
	return checked.pipeThrough(new FixedLengthStream(length));
}

function makeSlug(): string {
	let slug = '';
	while (slug.length < SLUG_LEN) {
		const bytes = crypto.getRandomValues(new Uint8Array(SLUG_LEN - slug.length));
		for (const b of bytes) {
			if (b > 230) continue; // rejection sampling: 231 values, 231 % 33 === 0
			slug += ALPHABET[b % ALPHABET.length];
			if (slug.length === SLUG_LEN) break;
		}
	}
	return slug;
}

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.session) throw error(401, 'Unauthorized');

	const rows = await listFiles(env.DB);

	return Response.json({ files: rows });
};

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.session) throw error(401, 'Unauthorized');
	const contentType = request.headers?.get?.('content-type') ?? '';
	if (!/^application\/pdf(?:;|$)/i.test(contentType))
		throw error(400, 'Only PDF files are accepted.');
	const length = Number(request.headers?.get?.('content-length'));
	if (!Number.isSafeInteger(length) || length <= 0) throw error(400, 'No file provided.');
	if (length > MAX_UPLOAD_BYTES) throw error(413, 'File is too large.');
	let name: string;
	try {
		name = decodeURIComponent(request.headers?.get?.('x-file-name') ?? '');
	} catch {
		throw error(400, 'No file provided.');
	}
	if (!name) throw error(400, 'No file provided.');
	if (!name.toLowerCase().endsWith('.pdf')) throw error(400, 'Only PDF files are accepted.');
	const body = await pdfStream(request.body, length);
	const db = drizzle(env.DB);
	const key = `pdfs/${crypto.randomUUID()}.pdf`;
	try {
		await env.PDFS.put(key, body, {
			httpMetadata: { contentType: 'application/pdf' }
		});
	} catch {
		console.error('File upload failed', { stage: 'put', key });
		try {
			await env.PDFS.delete(key);
		} catch {
			console.error('File upload failed', { stage: 'cleanup', key });
			throw error(500, 'Upload failed. Storage cleanup failed; contact an administrator.');
		}
		throw error(500, 'Upload failed. Please try again.');
	}
	for (let attempt = 0; ; attempt++) {
		const slug = makeSlug();
		try {
			await db.insert(pdfFiles).values({
				slug,
				r2Key: key,
				fileName: name,
				sizeBytes: length,
				createdAt: Date.now()
			});
			return Response.json({ slug });
		} catch (e) {
			// The body is already streamed to R2, so a slug collision retries the row, not the upload.
			if (attempt === 0 && String((e as Error)?.message ?? e).includes('UNIQUE constraint failed'))
				continue;
			console.error('File upload failed', { stage: 'insert', key });
			try {
				await env.PDFS.delete(key);
			} catch {
				console.error('File upload failed', { stage: 'cleanup', key });
				throw error(500, 'Upload failed. Storage cleanup failed; contact an administrator.');
			}
			throw error(500, 'Upload failed. Please try again.');
		}
	}
};
