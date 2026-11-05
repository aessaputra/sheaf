export type LimitedBodyStream = { stream: ReadableStream<Uint8Array>; exceeded: () => boolean };

// Passes the request body through a byte-cap transform, so an undeclared or
// chunked body is rejected while streaming instead of being buffered in full.
export function limitBodyStream(request: Request, limit: number): LimitedBodyStream {
	let exceeded = false;
	let size = 0;
	const body = request.body ?? new Blob().stream();
	const stream = body.pipeThrough(
		new TransformStream<Uint8Array, Uint8Array>({
			transform(chunk, controller) {
				size += chunk.byteLength;
				if (size > limit) {
					exceeded = true;
					controller.error(new Error('Body exceeds limit'));
					return;
				}
				controller.enqueue(chunk);
			}
		})
	);
	return { stream, exceeded: () => exceeded };
}
