<script lang="ts">
	import { UploadSimple, SpinnerGap } from 'phosphor-svelte';
	import { toast } from 'svelte-sonner';
	import CopyLinkButton from './CopyLinkButton.svelte';

	let { onuploaded }: { onuploaded: () => void } = $props();

	let uploading = $state(false);
	let lastSlug = $state<string | null>(null);
	let fileName = $state<string | null>(null);
	let fileInput: HTMLInputElement | undefined = $state();

	async function handleChange() {
		const file = fileInput?.files?.[0];
		if (!file) return;
		if (!file.name.toLowerCase().endsWith('.pdf') || file.type !== 'application/pdf') {
			toast.error('Only PDF files are accepted.');
			fileInput!.value = '';
			return;
		}
		uploading = true;
		try {
			const urlRes = await fetch('/api/upload-url', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ fileName: file.name, contentType: 'application/pdf' })
			});
			if (!urlRes.ok) throw 0;
			const { slug, url } = (await urlRes.json()) as { slug: string; url: string };

			const putRes = await fetch(url, {
				method: 'PUT',
				headers: { 'content-type': 'application/pdf' },
				body: file
			});
			if (!putRes.ok) throw 0;

			const recRes = await fetch('/api/files', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ slug, fileName: file.name, sizeBytes: file.size })
			});
			if (!recRes.ok) throw 0;

			lastSlug = slug;
			fileName = file.name;
			toast.success('File uploaded.');
			onuploaded();
		} catch {
			toast.error('Upload failed. Nothing was saved.');
		} finally {
			uploading = false;
			if (fileInput) fileInput.value = '';
		}
	}
</script>

<section class="rounded-[12px] border border-[#EAEAEA] bg-white p-6 sm:p-8">
	<h2 class="text-lg font-semibold text-[#111111]">Upload a PDF</h2>
	<p class="mt-1 text-sm leading-[1.6] text-[#787774]">Pick a file. A share link appears here.</p>

	<label
		class="mt-6 flex cursor-pointer flex-col items-center gap-3 rounded-[8px] border border-dashed border-[#EAEAEA] bg-[#F7F6F3] px-6 py-10 text-center transition-colors hover:bg-[#EFEDE9]"
	>
		{#if uploading}
			<SpinnerGap size={28} class="animate-spin text-[#787774]" />
			<span class="text-sm text-[#787774]">Uploading…</span>
		{:else}
			<UploadSimple size={28} weight="bold" class="text-[#2F3437]" />
			<span class="text-sm font-medium text-[#2F3437]">Choose a PDF file</span>
		{/if}
		<input
			bind:this={fileInput}
			type="file"
			accept="application/pdf,.pdf"
			class="sr-only"
			disabled={uploading}
			onchange={handleChange}
		/>
	</label>

	{#if lastSlug}
		<div class="mt-6 border-t border-[#EAEAEA] pt-4">
			<p class="truncate text-sm text-[#2F3437]">{fileName}</p>
			<div class="mt-2">
				<CopyLinkButton slug={lastSlug} />
			</div>
		</div>
	{/if}
</section>
