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
		createPluginRegistration(InteractionManagerPluginPackage),
		createPluginRegistration(SelectionPluginPackage),
		createPluginRegistration(AnnotationPluginPackage, {
			locked: { type: LockModeType.All },
			autoOpenLinks: false
		}),
		createPluginRegistration(ZoomPluginPackage, { defaultZoomLevel: ZoomMode.FitPage }),
		createPluginRegistration(PanPluginPackage, { defaultMode: 'always' })
	]);
</script>

<div class="@container relative flex h-full min-h-0 flex-col bg-white">
	{#if !engine}
		<div class="flex flex-col items-center gap-4 p-8 text-center">
			<p role={engineFailed ? 'alert' : 'status'}>
				{engineFailed ? 'Could not load the PDF engine.' : 'Loading…'}
			</p>
			<a
				href={streamUrl}
				download={fileName}
				class="inline-flex min-h-8 items-center rounded-md px-3 text-sm text-gray-900 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-blue-500"
				>Download</a
			>
		</div>
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
								<div class="flex flex-col items-center gap-4 p-8 text-center">
									<p role={documentContent.isError ? 'alert' : 'status'}>
										{documentContent.isError ? 'Could not open this PDF.' : 'Loading…'}
									</p>
									<a
										href={streamUrl}
										download={fileName}
										class="inline-flex min-h-8 items-center rounded-md px-3 text-sm text-gray-900 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-blue-500"
										>Download</a
									>
								</div>
							{/if}
						{/snippet}
					</DocumentContent>
				{:else}
					<div class="flex flex-col items-center gap-4 p-8 text-center">
						<p role="status">Loading…</p>
						<a
							href={streamUrl}
							download={fileName}
							class="inline-flex min-h-8 items-center rounded-md px-3 text-sm text-gray-900 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-blue-500"
							>Download</a
						>
					</div>
				{/if}
			{/snippet}
		</EmbedPDF>
	{/if}
</div>
