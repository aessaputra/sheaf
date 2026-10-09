<script lang="ts">
	import { usePdfiumEngine } from './pdf-engine.svelte';
	import { EmbedPDF } from '@embedpdf/core/svelte';
	import { createPluginRegistration } from '@embedpdf/core';
	import { ViewportPluginPackage, Viewport } from '@embedpdf/plugin-viewport/svelte';
	import { Scroller, ScrollPluginPackage, ScrollStrategy } from '@embedpdf/plugin-scroll/svelte';
	import type { RenderPageProps } from '@embedpdf/plugin-scroll/svelte';
	import {
		DocumentManagerPluginPackage,
		DocumentContent
	} from '@embedpdf/plugin-document-manager/svelte';
	import { RenderLayer, RenderPluginPackage } from '@embedpdf/plugin-render/svelte';
	import { TilingLayer, TilingPluginPackage } from '@embedpdf/plugin-tiling/svelte';
	import { ZoomGestureWrapper, ZoomPluginPackage, ZoomMode } from '@embedpdf/plugin-zoom/svelte';
	import { PanPluginPackage } from '@embedpdf/plugin-pan/svelte';
	import { SelectionPluginPackage } from '@embedpdf/plugin-selection/svelte';

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
	import { PdfAnnotationSubtype, type PdfAnnotationObject } from '@embedpdf/models';
	import PdfLink from './PdfLink.svelte';
	import PdfLinkNavigation from './PdfLinkNavigation.svelte';
	import ViewerToolbar from './ViewerToolbar.svelte';

	const linkRenderers = [
		{
			id: 'link',
			matches: (annotation: PdfAnnotationObject) => annotation.type === PdfAnnotationSubtype.LINK,
			component: PdfLink,
			renderLocked: PdfLink
		}
	];

	let { streamUrl, fileName }: { streamUrl: string; fileName: string } = $props();

	const pdfEngine = usePdfiumEngine();
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

{#snippet fallback(message: string, failed: boolean)}
	<div class="flex flex-col items-center gap-4 p-8 text-center">
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
{/snippet}

<div class="@container relative flex h-full min-h-0 flex-col bg-white">
	{#if pdfEngine.error}
		{@render fallback('Could not load the PDF engine.', true)}
	{:else if pdfEngine.isLoading || !pdfEngine.engine}
		{@render fallback('Loading…', false)}
	{:else}
		<EmbedPDF engine={pdfEngine.engine} {plugins}>
			{#snippet children({ activeDocumentId })}
				{#if activeDocumentId}
					{@const documentId = activeDocumentId}
					<DocumentContent {documentId}>
						{#snippet children(documentContent)}
							{#if documentContent.isLoaded}
								{#snippet renderPage(page: RenderPageProps)}
									<PagePointerProvider {documentId} pageIndex={page.pageIndex}>
										<RenderLayer
											{documentId}
											pageIndex={page.pageIndex}
											scale={1}
											dpr={1}
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
								<div class="relative min-h-0 flex-1 overscroll-none">
									<GlobalPointerProvider {documentId}>
										<Viewport
											{documentId}
											tabindex={0}
											role="region"
											aria-label="PDF pages"
											class="box-border h-full w-full bg-gray-100 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-neutral-900"
										>
											<ZoomGestureWrapper {documentId}>
												<Scroller {documentId} {renderPage} />
											</ZoomGestureWrapper>
										</Viewport>
									</GlobalPointerProvider>
								</div>
							{:else}
								{@render fallback(
									documentContent.isError ? 'Could not open this PDF.' : 'Loading…',
									documentContent.isError
								)}
							{/if}
						{/snippet}
					</DocumentContent>
				{:else}
					{@render fallback('Loading…', false)}
				{/if}
			{/snippet}
		</EmbedPDF>
	{/if}
</div>
