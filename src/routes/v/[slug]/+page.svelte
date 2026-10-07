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
	<header>
		<h1 class="name" title={data.fileName}>{data.fileName}</h1>
		<a href={data.streamUrl} download={data.fileName}>Download</a>
	</header>
	<main>
		{#if importFailed}
			<p class="loading" role="alert">Could not load the PDF viewer.</p>
		{:else if HeadlessViewer}
			{#key data.streamUrl}
				<HeadlessViewer streamUrl={data.streamUrl} />
			{/key}
		{:else}
			<p class="loading" role="status">Loading…</p>
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
		margin: 0;
		font-size: inherit;
		font-weight: inherit;
		font-family: monospace;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	a {
		display: inline-flex;
		align-items: center;
		min-height: 44px;
		color: #1a1a1a;
		flex-shrink: 0;
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
