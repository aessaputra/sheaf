<script lang="ts">
	import { CaretLeftIcon, CaretRightIcon, MinusCircleIcon, PlusCircleIcon } from 'phosphor-svelte';
	import { useScroll } from '@embedpdf/plugin-scroll/svelte';
	import { useZoom, ZoomMode } from '@embedpdf/plugin-zoom/svelte';

	let {
		documentId,
		streamUrl,
		fileName
	}: { documentId: string; streamUrl: string; fileName: string } = $props();
	const scroll = useScroll(() => documentId);
	const zoom = useZoom(() => documentId);

	let pageDraft = $state<string | null>(null);
	let zoomDraft = $state<string | null>(null);
	let zoomEditing = false;
	// External zoom replaces an uncommitted blurred draft, never an active edit.
	$effect(() => {
		void zoom.state.currentZoomLevel;
		if (!zoomEditing) zoomDraft = null;
	});
	let presetMenu = $state<HTMLDivElement>();
	let presetButton = $state<HTMLButtonElement>();
	const percentages = [25, 50, 100, 125, 150, 200, 400, 800, 1600];

	function commitPage() {
		const value = Number(pageDraft);
		if (
			pageDraft !== null &&
			/^\d+$/.test(pageDraft.trim()) &&
			Number.isInteger(value) &&
			value >= 1 &&
			value <= scroll.state.totalPages
		) {
			scroll.provides?.scrollToPage({ pageNumber: value, behavior: pageScrollBehavior() });
		}
		pageDraft = null;
	}

	function validZoom() {
		const value = Number(zoomDraft);
		// Registered 2.15.1 manifest limits (scale 0.2..60).
		return (
			zoomDraft !== null &&
			/^\d+(\.\d+)?$/.test(zoomDraft.trim()) &&
			Number.isFinite(value) &&
			value >= 20 &&
			value <= 6000
		);
	}

	function commitZoom() {
		if (validZoom()) zoom.provides?.requestZoom(Number(zoomDraft) / 100);
		zoomDraft = null;
	}

	function chooseZoom(value: number | ZoomMode) {
		zoom.provides?.requestZoom(value);
		zoomDraft = null;
		presetMenu?.hidePopover();
		presetButton?.focus();
	}

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
		{#if zoom.provides}
			<div class="controls zoom" role="group" aria-label="Zoom controls">
				<div class="percentage">
					<input
						aria-label="Set zoom"
						inputmode="decimal"
						value={zoomDraft ?? Math.round(zoom.state.currentZoomLevel * 100)}
						onfocus={(event) => {
							zoomEditing = true;
							zoomDraft = event.currentTarget.value;
							event.currentTarget.select();
						}}
						oninput={(event) => (zoomDraft = event.currentTarget.value)}
						onblur={() => {
							zoomEditing = false;
							if (!validZoom()) zoomDraft = null;
						}}
						onkeydown={(event) => {
							if (event.isComposing) return;
							if (event.key === 'Enter') {
								event.preventDefault();
								commitZoom();
							} else if (event.key === 'Escape') {
								zoomDraft = null;
								event.currentTarget.blur();
							}
						}}
					/>
					<span aria-hidden="true">%</span>
				</div>
				<button
					bind:this={presetButton}
					type="button"
					aria-label="Zoom presets"
					title="Zoom presets"
					popovertarget="zoom-presets">⌄</button
				>
				<div
					bind:this={presetMenu}
					id="zoom-presets"
					class="presets"
					popover="auto"
					role="group"
					aria-label="Zoom presets"
				>
					{#each percentages as percentage (percentage)}
						<button type="button" onclick={() => chooseZoom(percentage / 100)}>{percentage}%</button
						>
					{/each}
					<button type="button" onclick={() => chooseZoom(ZoomMode.FitPage)}>Fit page</button>
					<button
						type="button"
						aria-label="Fit width"
						title="Fit width"
						onclick={() => chooseZoom(ZoomMode.FitWidth)}>Fit width</button
					>
				</div>
				<button
					type="button"
					aria-label="Zoom out"
					title="Zoom out (Ctrl+-)"
					aria-keyshortcuts="Control+-"
					onclick={() => zoom.provides?.zoomOut()}
				>
					<MinusCircleIcon size={20} aria-hidden="true" />
				</button>

				<button
					type="button"
					aria-label="Zoom in"
					title="Zoom in (Ctrl++ or Ctrl+=)"
					aria-keyshortcuts="Control++ Control+="
					onclick={() => zoom.provides?.zoomIn()}
				>
					<PlusCircleIcon size={20} aria-hidden="true" />
				</button>
			</div>
		{/if}
		<a href={streamUrl} download={fileName}>Download</a>
	</nav>
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
		<input
			class="page-input"
			aria-label="Current page"
			inputmode="numeric"
			value={pageDraft ?? scroll.state.currentPage}
			onfocus={(event) => {
				pageDraft = event.currentTarget.value;
				event.currentTarget.select();
			}}
			oninput={(event) => (pageDraft = event.currentTarget.value)}
			onblur={commitPage}
			onkeydown={(event) => {
				if (event.isComposing) return;
				if (event.key === 'Enter') {
					event.preventDefault();
					event.currentTarget.blur();
				} else if (event.key === 'Escape') {
					pageDraft = null;
					event.currentTarget.blur();
				}
			}}
		/>
		<span class="indicator" aria-label="Total pages">{scroll.state.totalPages}</span>
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
{/if}

<style>
	.toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-shrink: 0;
		gap: 0.25rem;
		padding: 0.5rem;
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
		position: absolute;
		bottom: 1rem;
		left: 50%;
		transform: translateX(-50%);
		z-index: 1;
		padding: 0.25rem;
		background: #ffffff;
		border: 1px solid #eaeaea;
		box-shadow: 0 1px 3px #0000000d;
	}
	.zoom {
		background: #f3f4f7;
	}
	.indicator {
		padding: 0 0.25rem;
		color: #595959;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}
	.percentage {
		display: flex;
		align-items: center;
		padding-left: 0.5rem;
	}
	input {
		width: 3rem;
		min-height: 44px;
		min-width: 0;
		font: inherit;
		color: #1a1a1a;
		background: transparent;
		border: 0;
		text-align: right;
		padding: 0 0.25rem;
	}
	.page-input {
		width: 2.5rem;
		min-height: 32px;
		text-align: center;
		border: 1px solid #eaeaea;
		border-radius: 4px;
	}
	input:focus-visible {
		outline: 2px solid #1a1a1a;
		outline-offset: -2px;
	}
	.presets {
		inset: 4rem auto auto 0.5rem;
		margin: 0;
		max-height: calc(100dvh - 5rem);
		overflow: auto;
		min-width: 10rem;
		padding: 0.25rem;
		border: 1px solid #eaeaea;
		border-radius: 8px;
		background: white;
		box-shadow: 0 2px 8px #0000001a;
	}
	.presets button {
		display: flex;
		width: 100%;
		justify-content: flex-start;
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
