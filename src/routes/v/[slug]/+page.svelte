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
</svelte:head>

<div class="viewer">
	<main>
		<h1 class="name">{data.fileName}</h1>
		{#if importFailed}
			<a href={data.streamUrl} download={data.fileName}>Download</a>
			<p class="loading" role="alert">Could not load the PDF viewer.</p>
		{:else if HeadlessViewer}
			{#key data.streamUrl}
				<HeadlessViewer streamUrl={data.streamUrl} fileName={data.fileName} />
			{/key}
		{:else}
			<a href={data.streamUrl} download={data.fileName}>Download</a>
			<p class="loading" role="status">Loading…</p>
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
	a {
		display: inline-flex;
		align-items: center;
		min-height: 44px;
		color: #1a1a1a;
		flex-shrink: 0;
		margin: 0.5rem;
	}
	a:focus-visible {
		outline: 2px solid #1a1a1a;
		outline-offset: 2px;
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
