import { desc } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { pdfFiles } from '#lib/server/db/schema.ts';

export interface AdminFileEntry {
	slug: string;
	fileName: string;
	sizeBytes: number;
	createdAt: number;
}

export async function listFiles(db: D1Database): Promise<AdminFileEntry[]> {
	return await drizzle(db)
		.select({
			slug: pdfFiles.slug,
			fileName: pdfFiles.fileName,
			sizeBytes: pdfFiles.sizeBytes,
			createdAt: pdfFiles.createdAt
		})
		.from(pdfFiles)
		.orderBy(desc(pdfFiles.createdAt));
}
