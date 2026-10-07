<script lang="ts">
	import { CaretLeftIcon, CaretRightIcon, MinusCircleIcon, PlusCircleIcon } from 'phosphor-svelte';
	import { useScroll } from '@embedpdf/plugin-scroll/svelte';
	import { useZoom, ZoomMode } from '@embedpdf/plugin-zoom/svelte';

	let { documentId }: { documentId: string } = $props();
	const scroll = useScroll(() => documentId);
	const zoom = useZoom(() => documentId);

	function pageScrollBehavior() {
		return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth';
	}

	function handleZoomKeydown(event: KeyboardEvent) {
		if (
			!event.ctrlKey ||
			event.altKey ||
			event.metaKey ||
			event.isComposing ||
			event.defaultPrevented ||
			!zoom.provides ||
			!scroll.provides ||
			scroll.state.totalPages <= 0
		)
			return;
		const target = event.target;
		if (
			target instanceof HTMLElement &&
			(target.isContentEditable || target.closest('input, textarea, select'))
		)
			return;
		if (event.key !== '-' && event.key !== '+' && event.key !== '=') return;
		event.preventDefault();
		if (event.key === '-') zoom.provides.zoomOut();
		else zoom.provides.zoomIn();
	}
</script>

<svelte:window onkeydown={handleZoomKeydown} />

{#if scroll.provides && scroll.state.totalPages > 0}
	<nav class="toolbar" aria-label="PDF controls">
		<div class="controls navigation" role="group" aria-label="Page navigation">
			<button
				type="button"
				aria-label="Previous page"
				title="Previous page"
				disabled={scroll.state.currentPage <= 1}
				onclick={() => scroll.provides?.scrollToPreviousPage(pageScrollBehavior())}
			>
				<CaretLeftIcon size={20} aria-hidden="true" />
			</button>
			<button
				type="button"
				aria-label="Next page"
				title="Next page"
				disabled={scroll.state.currentPage >= scroll.state.totalPages}
				onclick={() => scroll.provides?.scrollToNextPage(pageScrollBehavior())}
			>
				<CaretRightIcon size={20} aria-hidden="true" />
			</button>
		</div>
		{#if zoom.provides}
			<div class="controls zoom" role="group" aria-label="Zoom controls">
				<button
					type="button"
					aria-label="Zoom out"
					title="Zoom out (Ctrl+-)"
					aria-keyshortcuts="Control+-"
					onclick={() => zoom.provides?.zoomOut()}
				>
					<MinusCircleIcon size={20} aria-hidden="true" />
				</button>
				<span class="indicator zoom-level" role="status" aria-label="Zoom level">
					{Math.round(zoom.state.currentZoomLevel * 100)}%
				</span>
				<button
					type="button"
					aria-label="Zoom in"
					title="Zoom in (Ctrl++ or Ctrl+=)"
					aria-keyshortcuts="Control++ Control+="
					onclick={() => zoom.provides?.zoomIn()}
				>
					<PlusCircleIcon size={20} aria-hidden="true" />
				</button>
				<button
					type="button"
					aria-label="Fit width"
					title="Fit width"
					onclick={() => zoom.provides?.requestZoom(ZoomMode.FitWidth)}>Fit width</button
				>
			</div>
		{/if}
	</nav>
{/if}

<style>
	.toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-shrink: 0;
		flex-wrap: wrap;
		gap: 0.5rem 1rem;
		padding: 0.5rem 0.75rem;
		border-bottom: 1px solid #eaeaea;
		background: #ffffff;
		font-size: 0.85rem;
	}
	.controls {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		border-radius: 8px;
	}
	.navigation {
		border: 1px solid #eaeaea;
		box-shadow: 0 1px 3px #0000000d;
	}
	.zoom {
		background: #f3f4f7;
	}
	.indicator {
		padding: 0 0.5rem;
		color: #595959;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}
	.zoom-level {
		min-width: 3.5rem;
		text-align: center;
	}
	button {
		min-width: 44px;
		min-height: 44px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border: 0;
		border-radius: 8px;
		padding: 0.5rem 0.65rem;
		font: inherit;
		white-space: nowrap;
		background: transparent;
		color: #1a1a1a;
		cursor: pointer;
	}
	button:hover:not(:disabled) {
		background: #f7f7f5;
	}
	button:focus-visible {
		outline: 2px solid #1a1a1a;
		outline-offset: 2px;
	}
	button:disabled {
		cursor: default;
		color: #a3a3a3;
	}
</style>
