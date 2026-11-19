<script lang="ts">
	import { Viewer, DocumentGate } from '@embedpdf/svelte/runtime';
	import { Stage, stagePlugin } from '@embedpdf/svelte/stage';
	import { RenderLayer, renderPlugin } from '@embedpdf/svelte/render';
	import { SelectionLayer, selectionPlugin } from '@embedpdf/svelte/selection';
	import { AnnotationLayer, annotationPlugin } from '@embedpdf/svelte/annotation';
	import { interactionPlugin } from '@embedpdf/svelte/interaction';
	import { LinkLayer, linkPlugin } from '@embedpdf/svelte/link';
	import { localEngine } from '@embedpdf/engine';
	import type { HostFetch } from '@embedpdf/svelte/runtime';
	import type { ResolvedPathname } from '$app/types';

	import PdfSelection from './PdfSelection.svelte';
	import ViewerFallback from './ViewerFallback.svelte';
	import ViewerToolbar from './ViewerToolbar.svelte';
	import { readPdfResponse } from './viewer-fetch';

	let { streamUrl, fileName }: { streamUrl: ResolvedPathname; fileName: string } = $props();

	const supportsTouch =
		typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

	let downloadPercent = $state<number | null>(null);
	const loadingMessage = $derived(
		downloadPercent === null ? 'Loading…' : `Loading… ${downloadPercent}%`
	);

	const fetchWithProgress: HostFetch = async (url, { signal }) =>
		readPdfResponse(await fetch(url, { signal }), (percent) => {
			downloadPercent = percent;
		});

	const plugins = [
		stagePlugin(),
		renderPlugin(),
		interactionPlugin({ defaultTool: supportsTouch ? 'pan' : 'pointer' }),
		selectionPlugin(),
		annotationPlugin({
			editable: false,
			tools: [{ id: 'highlight', defaults: { color: '#FFCD45' } }]
		}),
		linkPlugin()
	];
</script>

<div class="@container relative flex h-full min-h-0 flex-col bg-white select-none">
	<Viewer
		engine={() => localEngine()}
		{plugins}
		fetch={fetchWithProgress}
		initialDocuments={[{ source: { kind: 'url', url: streamUrl } }]}
	>
		{#snippet fallback()}
			<ViewerFallback message="Loading…" failed={false} {streamUrl} {fileName} />
		{/snippet}
		{#snippet error()}
			<ViewerFallback
				message="Could not load the PDF engine."
				failed={true}
				{streamUrl}
				{fileName}
			/>
		{/snippet}
		<DocumentGate>
			{#snippet fallback()}
				<ViewerFallback message={loadingMessage} failed={false} {streamUrl} {fileName} />
			{/snippet}
			{#snippet error()}
				<ViewerFallback message="Could not open this PDF." failed={true} {streamUrl} {fileName} />
			{/snippet}
			<ViewerToolbar {streamUrl} {fileName} />
			<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
			<div
				role="region"
				aria-label="PDF pages"
				tabindex="0"
				class="relative min-h-0 flex-1 overscroll-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-neutral-900"
			>
				<Stage class="box-border h-full w-full bg-gray-100">
					<RenderLayer />
					<SelectionLayer />
					<AnnotationLayer />
					<LinkLayer />
					{#snippet overlay()}
						<PdfSelection />
					{/snippet}
				</Stage>
			</div>
		</DocumentGate>
	</Viewer>
</div>
