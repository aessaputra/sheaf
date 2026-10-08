<script lang="ts">
	import { PdfAnnotationSubtype } from '@embedpdf/models';
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
	class="link"
	class:selected
	aria-label="PDF link options"
	aria-expanded={selected}
	popovertarget={id}
	onclick={positionMenu}
></button>
<div
	{id}
	bind:this={menu}
	popover="auto"
	class="menu"
	style:left={`${left}px`}
	style:top={`${top}px`}
	ontoggle={(event) => (selected = event.newState === 'open')}
>
	<button type="button" onclick={navigate}>Go to link ↗</button>
</div>

<style>
	.link {
		width: 100%;
		height: 100%;
		padding: 0;
		border: 0;
		background: transparent;
		cursor: pointer;
		pointer-events: auto;
	}
	.link:hover,
	.link:focus-visible,
	.link.selected {
		background: rgb(59 130 246 / 15%);
		outline: 2px solid #3b82f6;
		outline-offset: -2px;
	}
	.menu {
		pointer-events: auto;
		position: fixed;
		inset: auto;
		margin: 0;
		padding: 4px;
		border: 1px solid #e5e7eb;
		border-radius: 6px;
		background: white;
		box-shadow: 0 4px 16px rgb(0 0 0 / 12%);
		max-width: calc(100vw - 16px);
	}
	.menu button {
		min-height: 40px;
		padding: 0 12px;
		border: 0;
		border-radius: 4px;
		background: transparent;
		color: #111827;
		font-size: 0.875rem;
		cursor: pointer;
	}
	.menu button:hover {
		background: #f3f4f6;
	}
	.menu button:focus-visible {
		outline: 2px solid #3b82f6;
	}
</style>
