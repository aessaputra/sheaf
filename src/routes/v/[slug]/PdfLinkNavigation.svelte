<script lang="ts">
	import { useAnnotationCapability } from '@embedpdf/plugin-annotation/svelte';

	const capability = useAnnotationCapability();
	$effect(() =>
		capability.provides?.onNavigate(({ result }) => {
			if (result.outcome !== 'uri') return;
			try {
				const url = new URL(result.uri);
				if (['https:', 'http:', 'mailto:', 'tel:'].includes(url.protocol)) {
					window.open(url.href, '_blank', 'noopener,noreferrer');
				}
			} catch {
				// Ignore malformed PDF link targets.
			}
		})
	);
</script>
