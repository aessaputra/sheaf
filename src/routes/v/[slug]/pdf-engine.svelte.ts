import type { PdfEngine } from '@embedpdf/models';

// EmbedPDF 2.15.1's Svelte hook publishes engines that finish after teardown.
// Keep its worker and version-matched CDN defaults, but own cancellation here.
export function usePdfiumEngine() {
	const state = $state<{ engine: PdfEngine | null; isLoading: boolean; error: unknown }>({
		engine: null,
		isLoading: true,
		error: null
	});
	$effect(() => {
		let cancelled = false;
		let engine: PdfEngine | null = null;
		const dispose = (owned: PdfEngine) => {
			owned.closeAllDocuments().wait(
				() => owned.destroy?.(),
				() => owned.destroy?.()
			);
		};
		void (async () => {
			try {
				const { createPdfiumEngine } = await import('@embedpdf/engines/pdfium-worker-engine');
				const created = await createPdfiumEngine(
					'https://cdn.jsdelivr.net/npm/@embedpdf/pdfium@2.15.1/dist/pdfium.wasm'
				);
				if (cancelled) {
					dispose(created);
					return;
				}
				engine = created;
				state.engine = created;
				state.isLoading = false;
			} catch (error) {
				if (!cancelled) {
					state.error = error;
					state.isLoading = false;
				}
			}
		})();
		return () => {
			cancelled = true;
			if (engine) dispose(engine);
			engine = null;
		};
	});
	return state;
}
