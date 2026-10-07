import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { eq } from 'drizzle-orm';
import { getDb } from '#lib/server/db/index.ts';
import { pdfFiles } from '#lib/server/db/schema.ts';

export const load: PageServerLoad = async ({ params, platform }) => {
	const slug = params.slug;
	if (!/^[0-9a-hjkmnp-z]{8}$/.test(slug)) throw error(404, 'Not found.');
	const db = getDb(platform!.env.DB);
	const rows = await db.select().from(pdfFiles).where(eq(pdfFiles.slug, slug)).limit(1);
	if (rows.length === 0) throw error(404, 'Not found.');
	return { fileName: rows[0].fileName, streamUrl: `/v/${slug}/file` };
};
