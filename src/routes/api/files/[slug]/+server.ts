import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { eq } from 'drizzle-orm';
import { getDb } from '#lib/server/db/index.ts';
import { pdfFiles } from '#lib/server/db/schema.ts';

export const DELETE: RequestHandler = async ({ locals, platform, params }) => {
	if (!locals.session) throw error(401, 'Unauthorized');
	const slug = params.slug;
	if (!/^[0-9a-hjkmnp-z]{8}$/.test(slug)) throw error(400, 'Invalid slug.');
	await platform!.env.PDFS.delete(`pdfs/${slug}.pdf`);
	const db = getDb(platform!.env.DB);
	await db.delete(pdfFiles).where(eq(pdfFiles.slug, slug));
	return json({ ok: true });
};
