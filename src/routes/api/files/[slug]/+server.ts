import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from 'cloudflare:workers';
import { eq } from 'drizzle-orm';
import { getDb } from '#lib/server/db/index.ts';
import { pdfFiles } from '#lib/server/db/schema.ts';

export const DELETE: RequestHandler = async ({ locals, params }) => {
	if (!locals.session) throw error(401, 'Unauthorized');
	const slug = params.slug;
	if (!/^[0-9a-hjkmnp-z]{8}$/.test(slug)) throw error(400, 'Invalid slug.');
	const db = getDb(env.DB);
	const existing = await db
		.select({ slug: pdfFiles.slug })
		.from(pdfFiles)
		.where(eq(pdfFiles.slug, slug));
	if (existing.length === 0) throw error(404, 'File not found.');
	await env.PDFS.delete(`pdfs/${slug}.pdf`);
	await db.delete(pdfFiles).where(eq(pdfFiles.slug, slug));
	return Response.json({ ok: true });
};
