<script lang="ts">
	import { usePanCapability } from '@embedpdf/plugin-pan/svelte';

	let { documentId }: { documentId: string } = $props();

	const capability = usePanCapability();
	const supportsTouch =
		typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

	$effect(() => {
		if (!supportsTouch) return;
		const scope = capability.provides?.forDocument(documentId);
		if (!scope) return;
		if (!scope.isPanMode()) scope.enablePan();
	});
</script>
