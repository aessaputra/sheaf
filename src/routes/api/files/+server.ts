import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from 'cloudflare:workers';
import { desc } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { pdfFiles } from '#lib/server/db/schema.ts';

const SLUG_LEN = 8;
const ALPHABET = '0123456789abcdefghjkmnpqrstuvwxyz';

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

	const db = drizzle(env.DB);

	const rows = await db
		.select({
			slug: pdfFiles.slug,
			fileName: pdfFiles.fileName,
			sizeBytes: pdfFiles.sizeBytes,
			createdAt: pdfFiles.createdAt
		})
		.from(pdfFiles)
		.orderBy(desc(pdfFiles.createdAt));

	return Response.json({ files: rows });
};

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.session) throw error(401, 'Unauthorized');
	const form = await request.formData().catch(() => null);
	const file = form?.get('file');
	if (!(file instanceof File) || file.size === 0) throw error(400, 'No file provided.');
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
		const key = `pdfs/${slug}.pdf`;
		try {
			await env.PDFS.put(key, file.stream(), {
				httpMetadata: { contentType: 'application/pdf' }
			});
		} catch {
			throw error(500, 'Upload failed. Nothing was saved.');
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
			await env.PDFS.delete(key).catch(() => {});
			if (attempt === 0 && String((e as Error)?.message ?? e).includes('UNIQUE constraint failed'))
				continue;
			throw error(500, 'Upload failed. Nothing was saved.');
		}
	}
};
