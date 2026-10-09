<script lang="ts">
	import { PdfAnnotationSubtype } from '@embedpdf/models';
	import { ArrowSquareOutIcon } from 'phosphor-svelte';
	import { positionPopover } from './position-popover';

	import {
		useAnnotationCapability,
		type AnnotationRendererProps
	} from '@embedpdf/plugin-annotation/svelte';

	let { annotation, documentId }: AnnotationRendererProps = $props();
	const id = $props.id();
	const capability = useAnnotationCapability();
	let selected = $state(false);
	let menu: HTMLDivElement;
	let trigger: HTMLButtonElement;

	$effect(() => {
		if (!selected) return;
		const close = (event: Event) => {
			const target = event.target;
			if (
				target === document ||
				target === window ||
				(target instanceof Node && target !== trigger && target.contains(trigger))
			)
				menu.hidePopover();
		};
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
	bind:this={trigger}
	type="button"
	class="pointer-events-auto block h-full w-full cursor-pointer border-0 p-0 hover:bg-blue-500/15 hover:outline-2 hover:-outline-offset-2 hover:outline-blue-500 focus-visible:bg-blue-500/15 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500 {selected
		? 'bg-blue-500/15 outline-2 -outline-offset-2 outline-blue-500'
		: 'bg-transparent'}"
	aria-label="PDF link options"
	aria-expanded={selected}
	popovertarget={id}
></button>
<div
	{id}
	bind:this={menu}
	popover="auto"
	class="pointer-events-auto fixed inset-auto m-0 w-max overflow-auto rounded-md border border-gray-200 bg-white p-1 shadow-[0_4px_16px_rgb(0_0_0/12%)]"
	ontoggle={(event) => {
		selected = event.newState === 'open';
		if (selected) positionPopover(event.currentTarget, trigger);
	}}
>
	<button
		type="button"
		class="inline-flex min-h-10 items-center gap-2 rounded border-0 bg-transparent px-3 text-sm text-gray-900 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-blue-500"
		onclick={navigate}
	>
		Go to link <ArrowSquareOutIcon size={16} aria-hidden="true" />
	</button>
</div>
