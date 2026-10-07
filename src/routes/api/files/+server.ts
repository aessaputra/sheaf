import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '#lib/server/db/index.ts';
import { pdfFiles } from '#lib/server/db/schema.ts';

export const POST: RequestHandler = async ({ request, locals, platform }) => {
	if (!locals.session) throw error(401, 'Unauthorized');
	const db = getDb(platform!.env.DB);
	const body = (await request.json().catch(() => null)) as {
		slug?: unknown;
		fileName?: unknown;
		sizeBytes?: unknown;
	} | null;
	if (
		typeof body?.slug !== 'string' ||
		!/^[0-9a-hjkmnp-z]{8}$/.test(body.slug) ||
		typeof body?.fileName !== 'string' ||
		body.fileName.length === 0 ||
		typeof body?.sizeBytes !== 'number'
	) {
		throw error(400, 'Invalid file record.');
	}
	await db.insert(pdfFiles).values({
		slug: body.slug,
		r2Key: `pdfs/${body.slug}.pdf`,
		fileName: body.fileName,
		sizeBytes: body.sizeBytes,
		createdAt: Date.now()
	});
	return json({ slug: body.slug });
};
