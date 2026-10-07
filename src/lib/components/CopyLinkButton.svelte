<script lang="ts">
	import { Copy, Check } from 'phosphor-svelte';

	let { slug }: { slug: string } = $props();

	let copied = $state(false);
	const link = $derived(`/v/${slug}`);

	async function copy() {
		try {
			await navigator.clipboard.writeText(new URL(link, location.origin).href);
		} catch {
			const input = document.createElement('input');
			input.value = new URL(link, location.origin).href;
			document.body.appendChild(input);
			input.select();
			document.execCommand('copy');
			input.remove();
		}
		copied = true;
		setTimeout(() => (copied = false), 1500);
	}
</script>

<button
	type="button"
	onclick={copy}
	class="inline-flex items-center gap-1.5 rounded-[5px] border border-[#EAEAEA] bg-[#F7F6F3] px-2.5 py-1.5 font-mono text-xs text-[#2F3437] transition-colors hover:bg-[#EFEDE9]"
	title="Copy link"
>
	{#if copied}
		<Check size={14} />
		<span>Copied</span>
	{:else}
		<Copy size={14} />
		<span>{link}</span>
	{/if}
</button>
