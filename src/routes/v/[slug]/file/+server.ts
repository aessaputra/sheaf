import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from 'cloudflare:workers';
import { eq } from 'drizzle-orm';
import { getDb } from '#lib/server/db/index.ts';
import { pdfFiles } from '#lib/server/db/schema.ts';

export const GET: RequestHandler = async ({ params, request }) => {
	const slug = params.slug;
	if (!/^[0-9a-hjkmnp-z]{8}$/.test(slug)) throw error(404, 'Not found.');
	const db = getDb(env.DB);
	const rows = await db.select().from(pdfFiles).where(eq(pdfFiles.slug, slug)).limit(1);
	if (rows.length === 0) throw error(404, 'Not found.');
	const obj = await env.PDFS.get(rows[0].r2Key, { range: request.headers });
	if (obj === null) throw error(404, 'Not found.');
	const headers = new Headers();
	obj.writeHttpMetadata(headers);
	headers.set('content-type', 'application/pdf');
	headers.set('accept-ranges', 'bytes');
	headers.set('etag', obj.httpEtag);
	const range = obj.range;
	if (range && 'offset' in range && range.offset !== undefined && range.length !== undefined) {
		headers.set('content-length', String(range.length));
		headers.set('content-range', `bytes ${range.offset}-${range.offset + range.length - 1}/${obj.size}`);
		return new Response(obj.body, { status: 206, headers });
	}
	headers.set('content-length', String(obj.size));
	return new Response(obj.body, { headers });
};
