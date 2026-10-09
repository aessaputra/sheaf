<script lang="ts">
	import type { Tile } from '@embedpdf/plugin-tiling';
	import { TileImg, useTilingCapability } from '@embedpdf/plugin-tiling/svelte';
	import { useDocumentState } from '@embedpdf/core/svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import { SvelteMap } from 'svelte/reactivity';

	type SafeTilingLayoutProps = HTMLAttributes<HTMLDivElement> & {
		documentId: string;
		pageIndex: number;
		scale?: number;
		class?: string;
	};

	let {
		documentId,
		pageIndex,
		scale: scaleOverride,
		class: propsClass,
		...restProps
	}: SafeTilingLayoutProps = $props();

	const tilingCapability = useTilingCapability();
	const documentState = useDocumentState(() => documentId);

	let tiles = $state<Tile[]>([]);

	const actualScale = $derived(
		scaleOverride !== undefined ? scaleOverride : (documentState.current?.scale ?? 1)
	);

	// Same subscription as the upstream TilingLayer, except the list is
	// de-duplicated on tile.id before it reaches the keyed {#each}. Under
	// rapid zoom oscillation the tiling store can hold a stale fallback tile
	// and a fresh tile under one id; feeding both to {#each (tile.id)} throws
	// each_key_duplicate and kills the viewer. On a clash the fresh
	// (non-fallback) tile wins so it mounts, renders, and drives the store
	// back to a clean state via MARK_TILE_STATUS.
	const uniqueTiles = $derived.by(() => {
		const byId = new SvelteMap<string, Tile>();
		for (const tile of tiles) {
			const kept = byId.get(tile.id);
			if (!kept || (kept.isFallback && !tile.isFallback)) byId.set(tile.id, tile);
		}
		return [...byId.values()];
	});

	$effect(() => {
		if (!tilingCapability.provides) return;
		return tilingCapability.provides.onTileRendering((event) => {
			if (event.documentId === documentId) {
				tiles = event.tiles[pageIndex] ?? [];
			}
		});
	});
</script>

<div class={propsClass} {...restProps}>
	{#each uniqueTiles as tile (tile.id)}
		<TileImg {documentId} {pageIndex} {tile} dpr={window.devicePixelRatio} scale={actualScale} />
	{/each}
</div>
