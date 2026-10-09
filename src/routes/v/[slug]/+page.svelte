<script lang="ts">
	import { onMount } from 'svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	let HeadlessViewer: typeof import('./HeadlessViewer.svelte').default | undefined = $state();
	let importFailed = $state(false);

	onMount(() => {
		import('./HeadlessViewer.svelte').then(
			(module) => (HeadlessViewer = module.default),
			() => (importFailed = true)
		);
	});
</script>

<svelte:head>
	<title>{data.fileName} — sheaf</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="flex h-dvh flex-col bg-white text-[#1a1a1a]">
	<main class="relative min-h-0 flex-1">
		<h1 class="sr-only">{data.fileName}</h1>
		{#if HeadlessViewer}
			{#key data.streamUrl}
				<HeadlessViewer streamUrl={data.streamUrl} fileName={data.fileName} />
			{/key}
		{:else}
			<div class="flex flex-col items-center gap-4 p-8 text-center">
				<p role={importFailed ? 'alert' : 'status'}>
					{importFailed ? 'Could not load the PDF viewer.' : 'Loading…'}
				</p>
				{#if importFailed}
					<a
						href={data.streamUrl}
						download={data.fileName}
						class="inline-flex min-h-8 items-center rounded-md px-3 text-sm text-gray-900 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-blue-500"
						>Download</a
					>
				{/if}
			</div>
		{/if}
	</main>
</div>
