<script lang="ts">
	import { Trash } from 'phosphor-svelte';
	import CopyLinkButton from './CopyLinkButton.svelte';

	export interface FileEntry {
		slug: string;
		fileName: string;
		sizeBytes: number;
		createdAt: number;
	}

	let {
		file,
		ondelete
	}: {
		file: FileEntry;
		ondelete: (slug: string) => Promise<void>;
	} = $props();

	let deleting = $state(false);

	function formatSize(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}

	function formatDate(ts: number): string {
		return new Date(ts).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
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
			{formatSize(file.sizeBytes)} · {formatDate(file.createdAt)}
		</p>
	</div>
	<CopyLinkButton slug={file.slug} />
	<button
		type="button"
		onclick={handleDelete}
		disabled={deleting}
		class="inline-flex items-center rounded-[5px] border border-[#EAEAEA] px-2.5 py-1.5 text-xs text-[#9F2F2D] transition-colors hover:bg-[#FDEBEC] disabled:opacity-50"
		title="Delete file"
	>
		<Trash size={14} />
		<span class="sr-only">Delete {file.fileName}</span>
	</button>
</li>
