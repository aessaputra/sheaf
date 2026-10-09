<script lang="ts">
	import { onDestroy } from 'svelte';
	import { CopyIcon, CheckIcon } from 'phosphor-svelte';
	import { toast } from 'svelte-sonner';

	let { slug }: { slug: string } = $props();

	let copied = $state(false);
	const link = $derived(`/v/${slug}`);
	let timer: ReturnType<typeof setTimeout> | null = null;

	onDestroy(() => {
		if (timer) clearTimeout(timer);
	});

	async function copy() {
		const href = new URL(link, location.origin).href;
		try {
			await navigator.clipboard.writeText(href);
		} catch {
			toast.error('Copy failed. Copy the link manually.');
			return;
		}
		copied = true;
		if (timer) clearTimeout(timer);
		timer = setTimeout(() => (copied = false), 1500);
	}
</script>

<button
	type="button"
	onclick={copy}
	class="inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-md border border-[#EAEAEA] bg-[#F7F6F3] px-2.5 py-1.5 font-mono text-xs text-[#2F3437] transition-colors hover:bg-[#EFEDE9] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#787774]"
	title="Copy link"
>
	{#if copied}
		<CheckIcon size={14} />
		<span>Copied</span>
	{:else}
		<CopyIcon size={14} />
		<span>{link}</span>
	{/if}
</button>
