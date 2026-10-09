import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from 'cloudflare:workers';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { pdfFiles } from '#lib/server/db/schema.ts';

export const DELETE: RequestHandler = async ({ locals, params }) => {
	if (!locals.session) throw error(401, 'Unauthorized');
	const slug = params.slug;
	if (!/^[0-9a-hjkmnp-z]{8}$/.test(slug)) throw error(400, 'Invalid slug.');
	const db = drizzle(env.DB);
	const existing = await db
		.select({ r2Key: pdfFiles.r2Key })
		.from(pdfFiles)
		.where(eq(pdfFiles.slug, slug));
	if (existing.length === 0) return Response.json({ ok: true });
	const key = existing[0].r2Key;
	// Log only application-generated keys, never arbitrary stored values.
	const logKey = /^pdfs\/(?:[0-9a-hjkmnp-z]{8}|[0-9a-f-]{36})\.pdf$/.test(key) ? key : '[redacted]';
	try {
		await env.PDFS.delete(key);
	} catch {
		console.error('File deletion failed', { stage: 'r2-delete', key: logKey });
		throw error(500, 'File deletion failed. Please retry.');
	}
	try {
		await db.delete(pdfFiles).where(eq(pdfFiles.slug, slug));
	} catch {
		console.error('File deletion incomplete', { stage: 'd1-delete', key: logKey });
		throw error(500, 'File storage deleted, but metadata deletion failed. Please retry deletion.');
	}
	return Response.json({ ok: true });
};
