import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from 'cloudflare:workers';
import { drizzle } from 'drizzle-orm/d1';
import { listFiles } from '#lib/server/admin-files.ts';
import { pdfFiles } from '#lib/server/db/schema.ts';
import { limitBodyStream } from '#lib/server/body-limit.ts';

const SLUG_LEN = 8;
const ALPHABET = '0123456789abcdefghjkmnpqrstuvwxyz';
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
// Multipart headers only; the file field itself is capped separately.
const MAX_REQUEST_BYTES = MAX_UPLOAD_BYTES + 2 * 1024 * 1024;

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
	const declaredSize = Number(request.headers?.get?.('content-length'));
	if (Number.isSafeInteger(declaredSize) && declaredSize > MAX_REQUEST_BYTES)
		throw error(413, 'File is too large.');
	const contentType = request.headers?.get?.('content-type') ?? '';
	if (!/^multipart\/form-data(?:;|$)/i.test(contentType) || !/boundary=/i.test(contentType))
		throw error(400, 'Only PDF files are accepted.');
	const limited = limitBodyStream(request, MAX_REQUEST_BYTES);
	const form = await new Response(limited.stream, {
		headers: { 'content-type': contentType }
	})
		.formData()
		.catch(() => null);
	if (limited.exceeded()) throw error(413, 'File is too large.');
	const file = form?.get('file');
	if (!(file instanceof File) || file.size === 0) throw error(400, 'No file provided.');
	if (file.size > MAX_UPLOAD_BYTES) throw error(413, 'File is too large.');
	const name = file.name || '';
	if (
		!name.toLowerCase().endsWith('.pdf') ||
		(file.type !== '' && file.type !== 'application/pdf')
	) {
		throw error(400, 'Only PDF files are accepted.');
	}
	const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
	if (
		head.length < 4 ||
		head[0] !== 0x25 ||
		head[1] !== 0x50 ||
		head[2] !== 0x44 ||
		head[3] !== 0x46
	) {
		throw error(400, 'Only PDF files are accepted.');
	}
	const db = drizzle(env.DB);
	for (let attempt = 0; ; attempt++) {
		const slug = makeSlug();
		const key = `pdfs/${crypto.randomUUID()}.pdf`;
		try {
			await env.PDFS.put(key, file.stream(), {
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
		try {
			await db.insert(pdfFiles).values({
				slug,
				r2Key: key,
				fileName: name,
				sizeBytes: file.size,
				createdAt: Date.now()
			});
			return Response.json({ slug });
		} catch (e) {
			console.error('File upload failed', { stage: 'insert', key });
			try {
				await env.PDFS.delete(key);
			} catch {
				console.error('File upload failed', { stage: 'cleanup', key });
				throw error(500, 'Upload failed. Storage cleanup failed; contact an administrator.');
			}
			if (attempt === 0 && String((e as Error)?.message ?? e).includes('UNIQUE constraint failed'))
				continue;
			throw error(500, 'Upload failed. Please try again.');
		}
	}
};
