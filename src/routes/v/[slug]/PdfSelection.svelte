<script lang="ts">
	import { useDocumentPermissions } from '@embedpdf/core/svelte';
	import { SelectionLayer, useSelectionCapability } from '@embedpdf/plugin-selection/svelte';
	import { useAnnotationCapability } from '@embedpdf/plugin-annotation/svelte';
	import { PdfAnnotationSubtype, PdfBlendMode, PdfPermissionFlag, uuidV4 } from '@embedpdf/models';
	import { CopyIcon, HighlighterIcon } from 'phosphor-svelte';
	import { toast } from 'svelte-sonner';

	let { documentId, pageIndex }: { documentId: string; pageIndex: number } = $props();
	const selection = useSelectionCapability();
	const annotation = useAnnotationCapability();
	const permissions = useDocumentPermissions(() => documentId);
	const selectionScope = $derived(selection.provides?.forDocument(documentId));
	const annotationScope = $derived(annotation.provides?.forDocument(documentId));
	let busy = $state(false);

	async function copySelection() {
		if (busy || !selectionScope || !permissions.hasPermission(PdfPermissionFlag.CopyContents))
			return;
		if (!selectionScope.getFormattedSelection().length) return;
		const scope = selectionScope;
		const range = scope.getState().selection;
		busy = true;
		try {
			const text = await scope.getSelectedText().toPromise();
			await navigator.clipboard.writeText(text.join('\n'));
			if (scope.getState().selection === range) scope.clear();
		} catch {
			toast.error('Could not copy text. Please try again.');
		} finally {
			busy = false;
		}
	}

	function keepMenuInViewport(menu: HTMLElement, position?: string) {
		// The wrapper position triggers action updates when the selection moves.
		void position;
		const viewport = menu.closest('[aria-label="PDF pages"]') as HTMLElement | null;
		if (!viewport) return;
		const reposition = () => {
			menu.style.left = '0px';
			const bounds = viewport.getBoundingClientRect();
			const rect = menu.getBoundingClientRect();
			const scale = rect.width / menu.offsetWidth;
			if (!scale) return;
			const left = Math.max(bounds.left + 8, Math.min(rect.left, bounds.right - 8 - rect.width));
			menu.style.left = `${(left - rect.left) / scale}px`;
		};
		const observer = new ResizeObserver(reposition);
		observer.observe(menu);
		observer.observe(viewport);
		viewport.addEventListener('scroll', reposition);
		return {
			update() {
				requestAnimationFrame(reposition);
			},
			destroy() {
				observer.disconnect();
				viewport.removeEventListener('scroll', reposition);
			}
		};
	}

	function highlightSelection() {
		if (
			busy ||
			!selectionScope ||
			!annotationScope ||
			!permissions.hasPermission(PdfPermissionFlag.ModifyAnnotations)
		)
			return;
		const selected = selectionScope.getFormattedSelection();
		if (!selected.length) return;
		for (const { pageIndex, rect, segmentRects } of selected) {
			annotationScope.createAnnotation(pageIndex, {
				id: uuidV4(),
				type: PdfAnnotationSubtype.HIGHLIGHT,
				pageIndex,
				rect,
				segmentRects,
				strokeColor: '#FFCD45',
				opacity: 1,
				blendMode: PdfBlendMode.Multiply,
				created: new Date()
			});
		}
		selectionScope.clear();
	}
</script>

<SelectionLayer {documentId} {pageIndex} textStyle={{ background: 'rgba(59, 130, 246, 0.25)' }}>
	{#snippet selectionMenuSnippet({ rect, menuWrapperProps, placement })}
		<span style={menuWrapperProps.style} use:menuWrapperProps.action>
			<div
				use:keepMenuInViewport={menuWrapperProps.style}
				role="group"
				aria-label="Text selection actions"
				class="pointer-events-auto absolute left-0 flex w-max cursor-default items-center gap-0.5 rounded-md border border-gray-200 bg-white p-1 text-sm text-gray-900 shadow-[0_2px_8px_rgb(0_0_0/4%)]"
				style:top={placement.suggestTop ? '-48px' : `${rect.size.height + 8}px`}
			>
				<button
					type="button"
					class="inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded border-0 bg-transparent px-2 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-blue-500 disabled:cursor-default disabled:text-gray-400"
					disabled={busy || !permissions.canCopyContents}
					onclick={copySelection}><CopyIcon size={16} aria-hidden="true" />Copy</button
				>
				<button
					type="button"
					class="inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded border-0 bg-transparent px-2 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-blue-500 disabled:cursor-default disabled:text-gray-400"
					disabled={busy || !annotationScope || !permissions.canModifyAnnotations}
					onclick={highlightSelection}
					><HighlighterIcon size={16} aria-hidden="true" />Highlight</button
				>
			</div>
		</span>
	{/snippet}
</SelectionLayer>
