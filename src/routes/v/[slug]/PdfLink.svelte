<script lang="ts">
	import { PdfAnnotationSubtype } from '@embedpdf/models';
	import {
		useAnnotationCapability,
		type AnnotationRendererProps
	} from '@embedpdf/plugin-annotation/svelte';
	let { annotation, documentId }: AnnotationRendererProps = $props();
	const capability = useAnnotationCapability();
	function navigate() {
		if (annotation.object.type !== PdfAnnotationSubtype.LINK || !annotation.object.target) return;
		capability.provides?.forDocument(documentId).navigateTarget(annotation.object.target);
	}
</script>

<button type="button" class="link" aria-label="Open PDF link" onclick={navigate}></button>

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
	.link:focus-visible {
		outline: 2px solid #3b82f6;
	}
</style>
