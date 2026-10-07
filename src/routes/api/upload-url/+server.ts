import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from 'cloudflare:workers';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const SLUG_LEN = 8;

function makeSlug(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(SLUG_LEN));
	return Array.from(bytes, (b) => '0123456789abcdefghjkmnpqrstuvwxyz'[b % 32]).join('');
}

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.session) throw error(401, 'Unauthorized');
	const body = (await request.json().catch(() => null)) as {
		fileName?: unknown;
		contentType?: unknown;
	} | null;
	if (typeof body?.fileName !== 'string' || !body.fileName.toLowerCase().endsWith('.pdf')) {
		throw error(400, 'Only PDF files are accepted.');
	}
	if (body.contentType !== undefined && body.contentType !== 'application/pdf') {
		throw error(400, 'Only PDF files are accepted.');
	}
	const slug = makeSlug();
	const key = `pdfs/${slug}.pdf`;
	const accountId = env.R2_ACCOUNT_ID ?? '';
	const s3 = new S3Client({
		region: 'auto',
		endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
		credentials: {
			accessKeyId: env.R2_ACCESS_KEY_ID ?? '',
			secretAccessKey: env.R2_SECRET_ACCESS_KEY ?? ''
		}
	});
	const url = await getSignedUrl(
		s3,
		new PutObjectCommand({ Bucket: 'sheaf-pdfs', Key: key, ContentType: 'application/pdf' }),
		{ expiresIn: 300 }
	);
	return json({ slug, url });
};
