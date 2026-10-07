<script lang="ts">
	import { onMount } from 'svelte';
	import type { createPdfiumEngine } from '@embedpdf/engines/pdfium-worker-engine';
	import { EmbedPDF } from '@embedpdf/core/svelte';
	import { createPluginRegistration } from '@embedpdf/core';
	import { ViewportPluginPackage, Viewport } from '@embedpdf/plugin-viewport/svelte';
	import { Scroller, ScrollPluginPackage } from '@embedpdf/plugin-scroll/svelte';
	import type { PageLayout } from '@embedpdf/plugin-scroll';
	import {
		DocumentManagerPluginPackage,
		DocumentContent
	} from '@embedpdf/plugin-document-manager/svelte';
	import { RenderLayer, RenderPluginPackage } from '@embedpdf/plugin-render/svelte';
	import { ZoomGestureWrapper, ZoomPluginPackage, ZoomMode } from '@embedpdf/plugin-zoom/svelte';
	import ViewerToolbar from './ViewerToolbar.svelte';

	let { streamUrl, fileName }: { streamUrl: string; fileName: string } = $props();
	let engine = $state<ReturnType<typeof createPdfiumEngine>>();
	let engineFailed = $state(false);

	onMount(() => {
		let cancelled = false;
		let ownedEngine: ReturnType<typeof createPdfiumEngine> | undefined;
		import('@embedpdf/engines/pdfium-worker-engine')
			.then(async ({ createPdfiumEngine }) => {
				const initialized = await createPdfiumEngine(
					'https://cdn.jsdelivr.net/npm/@embedpdf/pdfium@2.15.1/dist/pdfium.wasm'
				);
				// The installed hook publishes late successes after its cleanup has already run.
				if (cancelled) {
					initialized.destroy();
					return;
				}
				ownedEngine = initialized;
				engine = initialized;
			})
			.catch(() => {
				if (!cancelled) engineFailed = true;
			});
		return () => {
			cancelled = true;
			if (ownedEngine) {
				const initialized = ownedEngine;
				const destroy = () => initialized.destroy();
				initialized.closeAllDocuments().wait(destroy, destroy);
			}
		};
	});
	const plugins = $derived([
		createPluginRegistration(DocumentManagerPluginPackage, {
			initialDocuments: [{ url: streamUrl }]
		}),
		createPluginRegistration(ViewportPluginPackage),
		createPluginRegistration(ScrollPluginPackage),
		createPluginRegistration(RenderPluginPackage),
		createPluginRegistration(ZoomPluginPackage, { defaultZoomLevel: ZoomMode.FitWidth })
	]);
</script>

<div class="pdf">
	{#if engineFailed}
		<a class="download" href={streamUrl} download={fileName}>Download</a>
		<p class="loading" role="alert">Could not load the PDF engine.</p>
	{:else if !engine}
		<a class="download" href={streamUrl} download={fileName}>Download</a>
		<p class="loading" role="status">Loading…</p>
	{:else}
		<EmbedPDF {engine} {plugins}>
			{#snippet children({ activeDocumentId })}
				{#if activeDocumentId}
					{@const documentId = activeDocumentId}
					<DocumentContent {documentId}>
						{#snippet children(documentContent)}
							{#if documentContent.isError}
								<a class="download" href={streamUrl} download={fileName}>Download</a>
								<p class="loading" role="alert">Could not open this PDF.</p>
							{:else if documentContent.isLoaded}
								{#snippet renderPage(page: PageLayout)}
									<div
										style:width={`${page.width}px`}
										style:height={`${page.height}px`}
										style:position="relative"
									>
										<RenderLayer {documentId} pageIndex={page.pageIndex} />
									</div>
								{/snippet}
								<ViewerToolbar {documentId} {streamUrl} {fileName} />
								<div class="viewport">
									<Viewport
										{documentId}
										tabindex={0}
										role="region"
										aria-label="PDF pages"
										style="background-color: #f3f4f6; width: 100%; height: 100%; box-sizing: border-box;"
									>
										<ZoomGestureWrapper {documentId}>
											<Scroller {documentId} {renderPage} />
										</ZoomGestureWrapper>
									</Viewport>
								</div>
							{:else}
								<a class="download" href={streamUrl} download={fileName}>Download</a>
								<p class="loading" role="status">Loading…</p>
							{/if}
						{/snippet}
					</DocumentContent>
				{:else}
					<a class="download" href={streamUrl} download={fileName}>Download</a>
					<p class="loading" role="status">Loading…</p>
				{/if}
			{/snippet}
		</EmbedPDF>
	{/if}
</div>

<style>
	.pdf {
		position: relative;
		display: flex;
		flex-direction: column;
		height: 100%;
		min-height: 0;
	}
	.viewport {
		flex: 1;
		min-height: 0;
	}
	.viewport :global([aria-label='PDF pages']:focus-visible) {
		outline: 2px solid #1a1a1a;
		outline-offset: -2px;
	}
	.download {
		display: inline-flex;
		align-items: center;
		align-self: flex-end;
		min-height: 44px;
		margin: 0.5rem;
		color: #1a1a1a;
	}
	.download:focus-visible {
		outline: 2px solid #1a1a1a;
		outline-offset: 2px;
	}
	.loading {
		padding: 2rem;
		text-align: center;
	}
</style>
