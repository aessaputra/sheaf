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

<div class="viewer">
	<main>
		<h1 class="name">{data.fileName}</h1>
		{#if HeadlessViewer}
			{#key data.streamUrl}
				<HeadlessViewer streamUrl={data.streamUrl} fileName={data.fileName} />
			{/key}
		{:else}
			<ViewerFallback
				streamUrl={data.streamUrl}
				fileName={data.fileName}
				errorMessage={importFailed ? 'Could not load the PDF viewer.' : undefined}
			/>
		{/if}
	</main>
</div>

<style>
	.viewer {
		display: flex;
		flex-direction: column;
		height: 100dvh;
		background: #ffffff;
		color: #1a1a1a;
	}
	.name {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
	main {
		position: relative;
		flex: 1;
		min-height: 0;
	}
</style>
