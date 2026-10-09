import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from 'cloudflare:workers';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { pdfFiles } from '#lib/server/db/schema.ts';

type ParsedRange = { offset: number; length: number } | { unsatisfiable: true } | { ignore: true };

function parseRange(header: string, size: number): ParsedRange {
	if (!header.startsWith('bytes=')) return { ignore: true };
	const spec = header.slice('bytes='.length).trim();
	// Multiple ranges: serve the full file instead of multipart.
	if (spec.includes(',')) return { ignore: true };
	const dash = spec.indexOf('-');
	if (dash === -1) return { ignore: true };
	const startStr = spec.slice(0, dash).trim();
	const endStr = spec.slice(dash + 1).trim();
	if (startStr === '' && endStr === '') return { unsatisfiable: true };
	if (startStr === '') {
		const suffix = Number(endStr);
		if (!Number.isSafeInteger(suffix)) return { ignore: true };
		if (suffix <= 0) return { unsatisfiable: true };
		if (suffix >= size) return { offset: 0, length: size };
		return { offset: size - suffix, length: suffix };
	}
	if (endStr === '') {
		const start = Number(startStr);
		if (!Number.isSafeInteger(start)) return { ignore: true };
		if (start < 0 || start >= size) return { unsatisfiable: true };
		return { offset: start, length: size - start };
	}
	const start = Number(startStr);
	const end = Number(endStr);
	if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end)) return { ignore: true };
	if (start < 0 || end < 0 || start > end) return { unsatisfiable: true };
	if (start >= size) return { unsatisfiable: true };
	return { offset: start, length: Math.min(end, size - 1) - start + 1 };
}

export const GET: RequestHandler = async ({ params, request }) => {
	const slug = params.slug;
	if (!/^[0-9a-hjkmnp-z]{8}$/.test(slug)) throw error(404, 'Not found.');
	const db = drizzle(env.DB);
	const rows = await db.select().from(pdfFiles).where(eq(pdfFiles.slug, slug)).limit(1);
	if (rows.length === 0) throw error(404, 'Not found.');
	const head = await env.PDFS.head(rows[0].r2Key);
	if (head === null) throw error(404, 'Not found.');
	const size = head.size;

	const headers = new Headers();
	head.writeHttpMetadata(headers);
	headers.set('content-type', 'application/pdf');
	headers.set('accept-ranges', 'bytes');
	headers.set('etag', head.httpEtag);
	headers.set('cache-control', 'public, max-age=31536000, immutable');
	headers.set('x-robots-tag', 'noindex');

	const rangeHeader = request.headers.get('range');
	if (rangeHeader) {
		const parsed = parseRange(rangeHeader, size);
		if ('unsatisfiable' in parsed) {
			headers.set('content-range', `bytes */${size}`);
			return new Response('Range not satisfiable', { status: 416, headers });
		}
		if ('offset' in parsed) {
			const obj = await env.PDFS.get(rows[0].r2Key, {
				range: { offset: parsed.offset, length: parsed.length }
			});
			if (obj === null) throw error(404, 'Not found.');
			headers.set('content-length', String(parsed.length));
			headers.set(
				'content-range',
				`bytes ${parsed.offset}-${parsed.offset + parsed.length - 1}/${size}`
			);
			return new Response(obj.body, { status: 206, headers });
		}
	}

	const obj = await env.PDFS.get(rows[0].r2Key);
	if (obj === null) throw error(404, 'Not found.');
	headers.set('content-length', String(obj.size));
	return new Response(obj.body, { headers });
};
