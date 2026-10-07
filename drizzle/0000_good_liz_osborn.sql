CREATE TABLE `pdf_files` (
	`slug` text PRIMARY KEY NOT NULL,
	`r2_key` text NOT NULL,
	`file_name` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`created_at` integer NOT NULL
);
