import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from 'cloudflare:workers';
import { desc } from 'drizzle-orm';
import { getDb } from '#lib/server/db/index.ts';
import { pdfFiles } from '#lib/server/db/schema.ts';

const SLUG_LEN = 8;
// ponytail: 10 MB cap, raise if users need bigger (Worker memory, not R2, is the ceiling).
const MAX_BYTES = 10 * 1024 * 1024;

function makeSlug(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(SLUG_LEN));
	return Array.from(bytes, (b) => '0123456789abcdefghjkmnpqrstuvwxyz'[b % 32]).join('');
}

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.session) throw error(401, 'Unauthorized');

	const db = getDb(env.DB);

	const rows = await db
		.select({
			slug: pdfFiles.slug,
			fileName: pdfFiles.fileName,
			sizeBytes: pdfFiles.sizeBytes,
			createdAt: pdfFiles.createdAt
		})
		.from(pdfFiles)
		.orderBy(desc(pdfFiles.createdAt));

	return json({ files: rows });
};

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.session) throw error(401, 'Unauthorized');
	const form = await request.formData().catch(() => null);
	const file = form?.get('file');
	if (!(file instanceof File) || file.size === 0) throw error(400, 'No file provided.');
	const name = file.name || '';
	if (!name.toLowerCase().endsWith('.pdf') || file.type !== 'application/pdf') {
		throw error(400, 'Only PDF files are accepted.');
	}
	if (file.size > MAX_BYTES) throw error(400, 'File too large.');
	const slug = makeSlug();
	const key = `pdfs/${slug}.pdf`;
	await env.PDFS.put(key, file.stream(), {
		httpMetadata: { contentType: 'application/pdf' }
	});
	const db = getDb(env.DB);
	await db.insert(pdfFiles).values({
		slug,
		r2Key: key,
		fileName: name,
		sizeBytes: file.size,
		createdAt: Date.now()
	});
	return json({ slug });
};
