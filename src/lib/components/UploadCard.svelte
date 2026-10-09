<script lang="ts">
	import { UploadSimpleIcon, SpinnerGapIcon } from 'phosphor-svelte';
	import { toast } from 'svelte-sonner';
	import CopyLinkButton from './CopyLinkButton.svelte';
	import OpenLinkButton from './OpenLinkButton.svelte';

	let { onuploaded, onunauthorized }: { onuploaded: () => void; onunauthorized?: () => void } =
		$props();

	let uploading = $state(false);
	let lastSlug = $state<string | null>(null);
	let fileName = $state<string | null>(null);
	let fileInput: HTMLInputElement | undefined = $state();

	async function handleChange() {
		const file = fileInput?.files?.[0];
		if (!file) return;
		if (
			!file.name.toLowerCase().endsWith('.pdf') ||
			(file.type !== '' && file.type !== 'application/pdf')
		) {
			toast.error('Only PDF files are accepted.');
			fileInput!.value = '';
			return;
		}
		uploading = true;
		try {
			const formData = new FormData();
			formData.append('file', file);
			const res = await fetch('/api/files', {
				method: 'POST',
				body: formData
			});
			if (res.status === 401) {
				onunauthorized?.();
				return;
			}
			if (!res.ok) {
				const body = (await res.json().catch(() => null)) as { message?: string } | null;
				throw new Error(body?.message ?? `Upload failed (${res.status}).`);
			}
			const { slug } = (await res.json()) as { slug: string };

			lastSlug = slug;
			fileName = file.name;
			toast.success('File uploaded.');
			onuploaded();
		} catch (err) {
			toast.error(
				err instanceof Error
					? `${err.message} Check the file list before retrying.`
					: 'Could not confirm the upload. Check the file list before retrying.'
			);
		} finally {
			uploading = false;
			if (fileInput) fileInput.value = '';
		}
	}
</script>

<section class="rounded-xl border border-[#EAEAEA] bg-white p-6 sm:p-8">
	<h2 class="text-lg font-semibold text-[#111111]">Upload a PDF</h2>
	<p class="mt-1 text-sm leading-[1.6] text-[#787774]">Pick a file. A share link appears here.</p>

	<label
		class="mt-6 flex cursor-pointer flex-col items-center gap-3 rounded-lg border border-dashed border-[#EAEAEA] bg-[#F7F6F3] px-6 py-10 text-center transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#787774] hover:bg-[#EFEDE9]"
	>
		{#if uploading}
			<SpinnerGapIcon size={28} class="animate-spin text-[#787774]" />
			<span class="text-sm text-[#787774]">Uploading…</span>
		{:else}
			<UploadSimpleIcon size={28} weight="bold" class="text-[#2F3437]" />
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
			<div class="mt-2 flex items-center gap-2">
				<CopyLinkButton slug={lastSlug} />
				<OpenLinkButton slug={lastSlug} />
			</div>
		</div>
	{/if}
</section>
