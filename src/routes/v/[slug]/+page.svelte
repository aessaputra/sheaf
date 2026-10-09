<script lang="ts">
	import { onMount } from 'svelte';
	import ViewerFallback from './ViewerFallback.svelte';
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
			<ViewerFallback
				message={importFailed ? 'Could not load the PDF viewer.' : 'Loading…'}
				failed={importFailed}
				streamUrl={data.streamUrl}
				fileName={data.fileName}
			/>
		{/if}
	</main>
</div>
