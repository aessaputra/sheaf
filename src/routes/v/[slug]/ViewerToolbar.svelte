<script lang="ts">
	import {
		CaretDownIcon,
		CaretLeftIcon,
		CaretRightIcon,
		MinusCircleIcon,
		PlusCircleIcon
	} from 'phosphor-svelte';
	import { useScroll } from '@embedpdf/plugin-scroll/svelte';
	import { useViewportScrollActivity } from '@embedpdf/plugin-viewport/svelte';
	import { useZoom, ZoomMode } from '@embedpdf/plugin-zoom/svelte';

	let {
		documentId,
		streamUrl,
		fileName
	}: { documentId: string; streamUrl: string; fileName: string } = $props();
	const scroll = useScroll(() => documentId);
	const zoom = useZoom(() => documentId);
	const scrollActivity = useViewportScrollActivity(() => documentId);

	let navVisible = $state(true);
	let hideTimer: ReturnType<typeof setTimeout> | null = null;

	function startHideTimer() {
		if (hideTimer) clearTimeout(hideTimer);
		hideTimer = setTimeout(() => {
			navVisible = false;
		}, 4000);
	}

	function showNav() {
		navVisible = true;
		startHideTimer();
	}

	function holdNav() {
		// Hovering or focusing the nav cancels the hide timer; it stays visible.
		navVisible = true;
		if (hideTimer) clearTimeout(hideTimer);
	}

	// Scroll activity reappears the nav and restarts the hide timer (v2 onScrollActivity).
	$effect(() => {
		if (scrollActivity.current.isScrolling) showNav();
	});

	$effect(() => {
		startHideTimer();
		return () => {
			if (hideTimer) clearTimeout(hideTimer);
		};
	});

	let pageDraft = $state<string | null>(null);
	let zoomDraft = $state<string | null>(null);
	let zoomEditing = false;
	// External zoom replaces an uncommitted blurred draft, never an active edit.
	$effect(() => {
		void zoom.state.currentZoomLevel;
		if (!zoomEditing) zoomDraft = null;
	});
	let isPresetOpen = $state(false);
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
		isPresetOpen = false;
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
	<nav
		aria-label="PDF controls"
		class="flex shrink-0 items-center gap-2 border-b border-gray-300 bg-white px-4 py-2 text-sm @max-[40rem]:gap-1 @max-[40rem]:px-3"
	>
		{#if zoom.provides}
			<div
				role="group"
				aria-label="Zoom controls"
				class="relative flex min-w-0 items-center gap-0.5 rounded-md bg-gray-100 pr-1 @max-[25rem]:bg-transparent @max-[25rem]:pr-0"
			>
				<div class="flex min-w-0 items-center @max-[25rem]:hidden">
					<input
						aria-label="Set zoom"
						inputmode="decimal"
						class="h-8 max-h-8 min-h-8 w-10 min-w-0 rounded-md border-0 bg-transparent px-1 text-right text-sm text-gray-900 hover:bg-gray-200 focus-visible:bg-white focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:-outline-offset-2"
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
					<span aria-hidden="true" class="text-gray-900">%</span>
				</div>
				<button
					type="button"
					aria-label="Zoom presets"
					aria-expanded={isPresetOpen}
					title="Zoom presets"
					class="inline-flex h-8 min-h-8 min-w-8 shrink-0 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent p-[5px] text-gray-900 hover:bg-gray-200 focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:outline-offset-2"
					onclick={() => (isPresetOpen = !isPresetOpen)}
				>
					<CaretDownIcon size={20} aria-hidden="true" />
				</button>
				{#if isPresetOpen}
					<div
						class="fixed inset-0 z-10"
						role="button"
						tabindex="-1"
						aria-label="Close zoom presets"
						onclick={() => (isPresetOpen = false)}
						onkeydown={(e) => e.key === 'Escape' && (isPresetOpen = false)}
					></div>
					<div
						role="group"
						aria-label="Zoom presets"
						class="absolute top-full left-0 z-20 mt-2 max-h-[calc(100dvh-5rem)] min-w-40 overflow-auto rounded-lg border border-gray-200 bg-white p-1 shadow-lg"
					>
						{#each percentages as percentage (percentage)}
							<button
								type="button"
								class="flex h-8 min-h-8 w-full min-w-8 shrink-0 cursor-pointer items-center justify-start rounded-md border-0 bg-transparent p-[5px] text-gray-900 hover:bg-gray-200 focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:outline-offset-2"
								onclick={() => chooseZoom(percentage / 100)}>{percentage}%</button
							>
						{/each}
						<button
							type="button"
							class="flex h-8 min-h-8 w-full min-w-8 shrink-0 cursor-pointer items-center justify-start rounded-md border-0 bg-transparent p-[5px] text-gray-900 hover:bg-gray-200 focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:outline-offset-2"
							onclick={() => chooseZoom(ZoomMode.FitPage)}>Fit page</button
						>
						<button
							type="button"
							aria-label="Fit width"
							title="Fit width"
							class="flex h-8 min-h-8 w-full min-w-8 shrink-0 cursor-pointer items-center justify-start rounded-md border-0 bg-transparent p-[5px] text-gray-900 hover:bg-gray-200 focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:outline-offset-2"
							onclick={() => chooseZoom(ZoomMode.FitWidth)}>Fit width</button
						>
					</div>
				{/if}
				<button
					type="button"
					aria-label="Zoom out"
					title="Zoom out (Ctrl+-)"
					aria-keyshortcuts="Control+-"
					class="inline-flex h-8 min-h-8 min-w-8 shrink-0 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent p-[5px] text-gray-900 hover:bg-gray-200 focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:outline-offset-2 disabled:cursor-default disabled:text-gray-400 disabled:opacity-50"
					onclick={() => zoom.provides?.zoomOut()}
				>
					<MinusCircleIcon size={20} aria-hidden="true" />
				</button>

				<button
					type="button"
					aria-label="Zoom in"
					title="Zoom in (Ctrl++ or Ctrl+=)"
					aria-keyshortcuts="Control++ Control+="
					class="inline-flex h-8 min-h-8 min-w-8 shrink-0 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent p-[5px] text-gray-900 hover:bg-gray-200 focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:outline-offset-2 disabled:cursor-default disabled:text-gray-400 disabled:opacity-50"
					onclick={() => zoom.provides?.zoomIn()}
				>
					<PlusCircleIcon size={20} aria-hidden="true" />
				</button>
			</div>
		{/if}
		<a
			href={streamUrl}
			download={fileName}
			class="ml-auto inline-flex min-h-8 shrink-0 items-center rounded-md px-3 text-sm whitespace-nowrap text-gray-900 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:outline-offset-2"
			>Download</a
		>
	</nav>
	{#if scroll.state.totalPages > 1}
		<div
			role="group"
			aria-label="Page navigation"
			class="absolute bottom-4 left-1/2 z-[1] flex max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-0.5 rounded-lg border border-gray-200 bg-white p-1 shadow-lg transition-opacity duration-300 {navVisible
				? ''
				: 'pointer-events-none opacity-0'}"
			onmouseenter={holdNav}
			onmouseleave={startHideTimer}
			onfocusin={holdNav}
			onfocusout={startHideTimer}
		>
			<button
				type="button"
				aria-label="Previous page"
				title="Previous page"
				class="inline-flex h-8 min-h-8 min-w-8 shrink-0 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent p-[5px] text-gray-900 hover:bg-gray-200 focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:outline-offset-2 disabled:cursor-default disabled:text-gray-400 disabled:opacity-50"
				disabled={scroll.state.currentPage <= 1}
				onclick={() => scroll.provides?.scrollToPreviousPage(pageScrollBehavior())}
			>
				<CaretLeftIcon size={20} aria-hidden="true" />
			</button>
			<input
				aria-label="Current page"
				inputmode="numeric"
				class="h-8 max-h-8 min-h-8 w-10 min-w-0 rounded-md border border-gray-200 bg-white px-1 text-center text-sm text-gray-900 focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:-outline-offset-2"
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
			<span class="px-1 whitespace-nowrap text-gray-600 tabular-nums" aria-label="Total pages">{scroll.state.totalPages}</span>
			<button
				type="button"
				aria-label="Next page"
				title="Next page"
				class="inline-flex h-8 min-h-8 min-w-8 shrink-0 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent p-[5px] text-gray-900 hover:bg-gray-200 focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:outline-offset-2 disabled:cursor-default disabled:text-gray-400 disabled:opacity-50"
				disabled={scroll.state.currentPage >= scroll.state.totalPages}
				onclick={() => scroll.provides?.scrollToNextPage(pageScrollBehavior())}
			>
				<CaretRightIcon size={20} aria-hidden="true" />
			</button>
		</div>
	{/if}
{/if}
