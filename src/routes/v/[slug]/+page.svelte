<script lang="ts">
	import { onMount } from 'svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let PDFViewer: typeof import('@embedpdf/svelte-pdf-viewer').PDFViewer | undefined =
		$state(undefined);

	onMount(async () => {
		PDFViewer = (await import('@embedpdf/svelte-pdf-viewer')).PDFViewer;
	});
</script>

<svelte:head>
	<title>{data.fileName} — sheaf</title>
</svelte:head>

<div class="viewer">
	<header>
		<span class="name" title={data.fileName}>{data.fileName}</span>
		<a href={data.streamUrl} download={data.fileName}>Download</a>
	</header>
	<main>
		{#if PDFViewer}
			<PDFViewer config={{ src: data.streamUrl }} style="width: 100%; height: 100%;" />
		{:else}
			<p class="loading">Loading…</p>
		{/if}
	</main>
</div>

<style>
	.viewer {
		display: flex;
		flex-direction: column;
		height: 100vh;
		background: #ffffff;
		color: #1a1a1a;
	}
	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.6rem 1rem;
		border-bottom: 1px solid #eaeaea;
	}
	.name {
		font-family: monospace;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	a {
		color: #1a1a1a;
		flex-shrink: 0;
	}
	main {
		flex: 1;
		min-height: 0;
	}
	.loading {
		padding: 2rem;
		text-align: center;
	}
</style>
