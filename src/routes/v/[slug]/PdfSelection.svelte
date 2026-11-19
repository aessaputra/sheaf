<script lang="ts">
	import { copySelection, SelectionMenu, useSelection } from '@embedpdf/svelte/selection';
	import { useAnnotation } from '@embedpdf/svelte/annotation';
	import { CopyIcon, HighlighterIcon } from 'phosphor-svelte';
	import { toast } from 'svelte-sonner';
	import { copySelectedText } from './selection-actions';

	const selection = useSelection();
	const annotation = useAnnotation();
	let busy = $state(false);

	async function copyText() {
		if (busy) return;
		busy = true;
		try {
			await copySelectedText(
				selection,
				(scope) => copySelection(scope),
				() => toast.error('Could not copy text. Please try again.')
			);
		} finally {
			busy = false;
		}
	}

	async function highlightSelection() {
		if (busy || !annotation.canCreate()) return;
		busy = true;
		try {
			await annotation.createFromSelection('highlight');
		} catch {
			toast.error('Could not add highlight. Please try again.');
		} finally {
			busy = false;
		}
	}
</script>

<SelectionMenu placement="top" gap={8}>
	<div
		role="group"
		aria-label="Text selection actions"
		class="flex w-max cursor-default items-center gap-0.5 rounded-md border border-gray-200 bg-white p-1 text-sm text-gray-900 shadow-[0_2px_8px_rgb(0_0_0/4%)]"
	>
		<button
			type="button"
			class="inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded border-0 bg-transparent px-2 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-blue-500 disabled:cursor-default disabled:text-gray-400"
			disabled={busy || !selection.canCopy()}
			onclick={copyText}><CopyIcon size={16} aria-hidden="true" />Copy</button
		>
		<button
			type="button"
			class="inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded border-0 bg-transparent px-2 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-blue-500 disabled:cursor-default disabled:text-gray-400"
			disabled={busy || !annotation.canCreate()}
			onclick={highlightSelection}><HighlighterIcon size={16} aria-hidden="true" />Highlight</button
		>
	</div>
</SelectionMenu>
