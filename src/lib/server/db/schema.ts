import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const pdfFiles = sqliteTable('pdf_files', {
	slug: text('slug').primaryKey(),
	r2Key: text('r2_key').notNull(),
	fileName: text('file_name').notNull(),
	sizeBytes: integer('size_bytes').notNull(),
	createdAt: integer('created_at').notNull()
});
