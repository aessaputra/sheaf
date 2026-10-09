<script lang="ts">
	import { TrashIcon } from 'phosphor-svelte';
	import type { FileEntry } from '#lib/server/admin-files.ts';
	import CopyLinkButton from './CopyLinkButton.svelte';
	import OpenLinkButton from './OpenLinkButton.svelte';

	let {
		file,
		ondelete
	}: {
		file: FileEntry;
		ondelete: (slug: string) => Promise<void>;
	} = $props();

	let deleting = $state(false);

	function formatMeta(bytes: number, ts: number): string {
		const size =
			bytes < 1024
				? `${bytes} B`
				: bytes < 1024 * 1024
					? `${(bytes / 1024).toFixed(1)} KB`
					: `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
		const date = new Date(ts).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
		return `${size} · ${date}`;
	}

	async function handleDelete() {
		deleting = true;
		try {
			await ondelete(file.slug);
		} finally {
			deleting = false;
		}
	}
</script>

<li class="flex items-center gap-4 border-b border-[#EAEAEA] py-4 last:border-b-0">
	<div class="min-w-0 flex-1">
		<p class="truncate text-sm font-medium text-[#111111]">{file.fileName}</p>
		<p class="mt-0.5 font-mono text-xs text-[#787774]">
			{formatMeta(file.sizeBytes, file.createdAt)}
		</p>
	</div>
	<CopyLinkButton slug={file.slug} />
	<OpenLinkButton slug={file.slug} />
	<button
		type="button"
		onclick={handleDelete}
		disabled={deleting}
		class="inline-flex items-center rounded-md border border-[#EAEAEA] px-2.5 py-1.5 text-xs text-[#9F2F2D] transition-colors hover:bg-[#FDEBEC] disabled:opacity-50"
		title="Delete file"
	>
		<TrashIcon size={14} />
		<span class="sr-only">Delete {file.fileName}</span>
	</button>
</li>
