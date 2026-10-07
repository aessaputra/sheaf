<script lang="ts">
	import { useScroll } from '@embedpdf/plugin-scroll/svelte';
	import { useZoom, ZoomMode } from '@embedpdf/plugin-zoom/svelte';

	let { documentId }: { documentId: string } = $props();
	const scroll = useScroll(() => documentId);
	const zoom = useZoom(() => documentId);

	function jumpToPage(event: SubmitEvent & { currentTarget: HTMLFormElement }) {
		event.preventDefault();
		const input = event.currentTarget.elements.namedItem('page') as HTMLInputElement;
		const pageNumber = input.valueAsNumber;
		if (Number.isInteger(pageNumber) && pageNumber >= 1 && pageNumber <= scroll.state.totalPages) {
			scroll.provides?.scrollToPage({ pageNumber });
		}
	}
</script>

{#if scroll.provides && scroll.state.totalPages > 0}
	<nav class="toolbar" aria-label="PDF controls">
		<button
			type="button"
			disabled={scroll.state.currentPage <= 1}
			onclick={() => scroll.provides?.scrollToPreviousPage()}>Prev</button
		>
		<span>Page {scroll.state.currentPage} of {scroll.state.totalPages}</span>
		<button
			type="button"
			disabled={scroll.state.currentPage >= scroll.state.totalPages}
			onclick={() => scroll.provides?.scrollToNextPage()}>Next</button
		>
		<form onsubmit={jumpToPage}>
			<label>
				Jump to page
				<input
					name="page"
					type="number"
					min="1"
					max={scroll.state.totalPages}
					step="1"
					required
					value={scroll.state.currentPage}
				/>
			</label>
			<button type="submit">Go</button>
		</form>
		{#if zoom.provides}
			<button type="button" aria-label="Zoom out" onclick={() => zoom.provides?.zoomOut()}>−</button
			>
			<span aria-label="Zoom level">{Math.round(zoom.state.currentZoomLevel * 100)}%</span>
			<button type="button" aria-label="Zoom in" onclick={() => zoom.provides?.zoomIn()}>+</button>
			<button type="button" onclick={() => zoom.provides?.requestZoom(ZoomMode.FitWidth)}
				>Fit width</button
			>
		{/if}
	</nav>
{/if}

<style>
	.toolbar,
	form,
	label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.toolbar {
		flex-shrink: 0;
		flex-wrap: wrap;
		padding: 0.4rem 0.75rem;
		border-bottom: 1px solid #eaeaea;
		background: #ffffff;
		font-size: 0.85rem;
	}
	button,
	input {
		border: 1px solid #eaeaea;
		border-radius: 4px;
		padding: 0.35rem 0.6rem;
		font: inherit;
		background: #ffffff;
	}
	button {
		cursor: pointer;
	}
	button:disabled {
		cursor: default;
		opacity: 0.45;
	}
	input {
		width: 4rem;
	}
</style>
