<script lang="ts">
	import { ArrowSquareOutIcon } from 'phosphor-svelte';

	let { slug }: { slug: string } = $props();

	const link = $derived(`/v/${slug}`);
</script>

<a
	href={link}
	target="_blank"
	rel="noopener"
	class="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-[#EAEAEA] bg-[#F7F6F3] px-2.5 py-1.5 text-xs text-[#2F3437] transition-colors hover:bg-[#EFEDE9] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#787774]"
	title="Open link"
	aria-label="Open link in new tab"
>
	<ArrowSquareOutIcon size={14} />
</a>
