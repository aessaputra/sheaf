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

<div class="viewer">
	<main>
		<h1 class="name">{data.fileName}</h1>
		{#if HeadlessViewer}
			{#key data.streamUrl}
				<HeadlessViewer streamUrl={data.streamUrl} fileName={data.fileName} />
			{/key}
		{:else}
			<div class="fallback">
				<p role={importFailed ? 'alert' : 'status'}>
					{importFailed ? 'Could not load the PDF viewer.' : 'Loading…'}
				</p>
				<a href={data.streamUrl} download={data.fileName}>Download</a>
			</div>
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
	.fallback {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		padding: 2rem;
		text-align: center;
	}
	.fallback a {
		display: inline-flex;
		align-items: center;
		min-height: 2rem;
		padding: 0 0.75rem;
		font-size: 0.875rem;
		color: #111827;
		border-radius: 6px;
	}
</style>
