<script lang="ts">
	import { PdfAnnotationSubtype } from '@embedpdf/models';
	import { ArrowSquareOutIcon } from 'phosphor-svelte';

	import {
		useAnnotationCapability,
		type AnnotationRendererProps
	} from '@embedpdf/plugin-annotation/svelte';

	let { annotation, documentId }: AnnotationRendererProps = $props();
	const id = $props.id();
	const capability = useAnnotationCapability();
	let selected = $state(false);
	let menu: HTMLDivElement;
	let left = $state(0);
	let top = $state(0);

	function positionMenu(event: MouseEvent) {
		const rect = (event.currentTarget as HTMLButtonElement).getBoundingClientRect();
		left = Math.max(8, Math.min(rect.left, window.innerWidth - 160));
		top = rect.bottom + 6;
		if (top + 48 > window.innerHeight) top = Math.max(8, rect.top - 54);
	}

	$effect(() => {
		if (!selected) return;
		const close = () => menu.hidePopover();
		window.addEventListener('scroll', close, true);
		return () => window.removeEventListener('scroll', close, true);
	});

	function navigate() {
		if (annotation.object.type !== PdfAnnotationSubtype.LINK || !annotation.object.target) return;
		capability.provides?.forDocument(documentId).navigateTarget(annotation.object.target);
		menu.hidePopover();
	}
</script>

<svelte:window onresize={() => menu?.hidePopover()} />
<button
	type="button"
	class="pointer-events-auto block h-full w-full cursor-pointer border-0 p-0 hover:bg-blue-500/15 hover:outline-2 hover:-outline-offset-2 hover:outline-blue-500 focus-visible:bg-blue-500/15 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500 {selected
		? 'bg-blue-500/15 outline-2 -outline-offset-2 outline-blue-500'
		: 'bg-transparent'}"
	aria-label="PDF link options"
	aria-expanded={selected}
	popovertarget={id}
	onclick={positionMenu}
></button>
<div
	{id}
	bind:this={menu}
	popover="auto"
	class="pointer-events-auto fixed inset-auto m-0 max-w-[calc(100vw-16px)] rounded-md border border-gray-200 bg-white p-1 shadow-[0_4px_16px_rgb(0_0_0/12%)]"
	style:left={`${left}px`}
	style:top={`${top}px`}
	ontoggle={(event) => (selected = event.newState === 'open')}
>
	<button
		type="button"
		class="inline-flex min-h-10 items-center gap-2 rounded border-0 bg-transparent px-3 text-sm text-gray-900 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-blue-500"
		onclick={navigate}
	>
		Go to link <ArrowSquareOutIcon size={16} aria-hidden="true" />
	</button>
</div>
