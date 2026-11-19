const failed = (status: number) => ({
	ok: false,
	status,
	arrayBuffer: async () => new ArrayBuffer(0)
});

// The v3 local engine always downloads the whole PDF before opening it, so the server's range
// support goes unused. Reading the body here adds progress; revisit if EmbedPDF reads ranges.
export async function readPdfResponse(response: Response, onProgress: (percent: number) => void) {
	const total = Number(response.headers.get('content-length'));
	if (!response.ok || !response.body || !(total > 0)) return response;
	const reader = response.body.getReader();
	const bytes = new Uint8Array(total);
	let loaded = 0;
	let reported = 0;
	onProgress(0);
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		if (loaded + value.byteLength > bytes.byteLength) {
			await reader.cancel().catch(() => {});
			return failed(502);
		}
		bytes.set(value, loaded);
		loaded += value.byteLength;
		const percent = Math.floor((loaded / total) * 100);
		if (percent !== reported) {
			reported = percent;
			onProgress(percent);
		}
	}
	if (loaded === 0) return failed(502);
	const fileBytes = loaded === bytes.byteLength ? bytes : bytes.slice(0, loaded);
	return { ok: true, status: response.status, arrayBuffer: async () => fileBytes.buffer };
}
