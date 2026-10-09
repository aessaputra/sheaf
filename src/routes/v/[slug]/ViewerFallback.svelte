<script lang="ts">
	import { SpinnerGapIcon } from 'phosphor-svelte';

	let {
		message,
		failed,
		streamUrl,
		fileName
	}: {
		message: string;
		failed: boolean;
		streamUrl: string;
		fileName: string;
	} = $props();
</script>

<div class="flex h-full min-h-0 flex-col items-center justify-center gap-4 p-8 text-center">
	{#if !failed}
		<SpinnerGapIcon size={28} class="animate-spin text-gray-900" aria-hidden="true" />
	{/if}
	<p role={failed ? 'alert' : 'status'}>{message}</p>
	{#if failed}
		<a
			href={streamUrl}
			download={fileName}
			class="inline-flex min-h-8 items-center rounded-md px-3 text-sm text-gray-900 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-blue-500"
			>Download</a
		>
	{/if}
</div>
