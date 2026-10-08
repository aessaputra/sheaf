<script lang="ts">
	import { onMount } from 'svelte';
	import type { createPdfiumEngine } from '@embedpdf/engines/pdfium-worker-engine';
	import { EmbedPDF } from '@embedpdf/core/svelte';
	import { createPluginRegistration } from '@embedpdf/core';
	import { ViewportPluginPackage, Viewport } from '@embedpdf/plugin-viewport/svelte';
	import { Scroller, ScrollPluginPackage, ScrollStrategy } from '@embedpdf/plugin-scroll/svelte';
	import type { PageLayout } from '@embedpdf/plugin-scroll';
	import {
		DocumentManagerPluginPackage,
		DocumentContent
	} from '@embedpdf/plugin-document-manager/svelte';
	import { RenderLayer, RenderPluginPackage } from '@embedpdf/plugin-render/svelte';
	import { TilingLayer, TilingPluginPackage } from '@embedpdf/plugin-tiling/svelte';
	import { ZoomGestureWrapper, ZoomPluginPackage, ZoomMode } from '@embedpdf/plugin-zoom/svelte';
	import { PanPluginPackage } from '@embedpdf/plugin-pan/svelte';
	import {
		AnnotationPluginPackage,
		AnnotationLayer,
		LockModeType
	} from '@embedpdf/plugin-annotation/svelte';
	import {
		InteractionManagerPluginPackage,
		GlobalPointerProvider,
		PagePointerProvider
	} from '@embedpdf/plugin-interaction-manager/svelte';
	import { SelectionPluginPackage } from '@embedpdf/plugin-selection/svelte';
	import { PdfAnnotationSubtype, type PdfAnnotationObject } from '@embedpdf/models';
	import PdfLink from './PdfLink.svelte';
	import PdfLinkNavigation from './PdfLinkNavigation.svelte';
	import ViewerToolbar from './ViewerToolbar.svelte';
	import ViewerFallback from './ViewerFallback.svelte';

	const linkRenderers = [
		{
			id: 'link',
			matches: (annotation: PdfAnnotationObject) => annotation.type === PdfAnnotationSubtype.LINK,
			component: PdfLink,
			renderLocked: PdfLink
		}
	];

	let { streamUrl, fileName }: { streamUrl: string; fileName: string } = $props();

	let engine = $state<ReturnType<typeof createPdfiumEngine>>();
	let engineFailed = $state(false);

	onMount(() => {
		let cancelled = false;
		let ownedEngine: ReturnType<typeof createPdfiumEngine> | undefined;
		import('@embedpdf/engines/pdfium-worker-engine')
			.then(async ({ createPdfiumEngine }) => {
				const initialized = await createPdfiumEngine(
					// Blob workers cannot resolve root-relative URLs.
					new URL('/pdfium.wasm', window.location.href).href
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
		createPluginRegistration(ViewportPluginPackage, { viewportGap: 10 }),
		createPluginRegistration(ScrollPluginPackage, { defaultStrategy: ScrollStrategy.Vertical }),
		createPluginRegistration(RenderPluginPackage),
		createPluginRegistration(TilingPluginPackage, {
			tileSize: 768,
			overlapPx: 2.5,
			extraRings: 0
		}),
		createPluginRegistration(InteractionManagerPluginPackage),
		createPluginRegistration(SelectionPluginPackage),
		createPluginRegistration(AnnotationPluginPackage, {
			locked: { type: LockModeType.All },
			autoOpenLinks: false
		}),
		createPluginRegistration(ZoomPluginPackage, { defaultZoomLevel: ZoomMode.FitPage }),
		createPluginRegistration(PanPluginPackage)
	]);
</script>

<div class="pdf">
	{#if !engine}
		<ViewerFallback
			{streamUrl}
			{fileName}
			errorMessage={engineFailed ? 'Could not load the PDF engine.' : undefined}
		/>
	{:else}
		<EmbedPDF {engine} {plugins}>
			{#snippet children({ activeDocumentId })}
				{#if activeDocumentId}
					{@const documentId = activeDocumentId}
					<DocumentContent {documentId}>
						{#snippet children(documentContent)}
							{#if documentContent.isLoaded}
								{#snippet renderPage(page: PageLayout)}
									<PagePointerProvider {documentId} pageIndex={page.pageIndex}>
										<RenderLayer
											{documentId}
											pageIndex={page.pageIndex}
											scale={1}
											style="pointer-events: none"
										/>
										<TilingLayer
											{documentId}
											pageIndex={page.pageIndex}
											style="pointer-events: none"
										/>
										<AnnotationLayer
											{documentId}
											pageIndex={page.pageIndex}
											annotationRenderers={linkRenderers}
										/>
									</PagePointerProvider>
								{/snippet}
								<PdfLinkNavigation />
								<ViewerToolbar {documentId} {streamUrl} {fileName} />
								<div class="viewport">
									<GlobalPointerProvider {documentId}>
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
									</GlobalPointerProvider>
								</div>
							{:else}
								<ViewerFallback
									{streamUrl}
									{fileName}
									errorMessage={documentContent.isError ? 'Could not open this PDF.' : undefined}
								/>
							{/if}
						{/snippet}
					</DocumentContent>
				{:else}
					<ViewerFallback {streamUrl} {fileName} />
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
		container-type: inline-size;
		background: #ffffff;
	}
	.viewport {
		flex: 1;
		min-height: 0;
		position: relative;
		overscroll-behavior: none;
	}
	.viewport :global([aria-label='PDF pages']:focus-visible) {
		outline: 2px solid #1a1a1a;
		outline-offset: -2px;
	}
</style>
