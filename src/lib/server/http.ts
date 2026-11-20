export function jsonError(status: number, message: string, headers?: HeadersInit): Response {
	const merged = new Headers(headers);
	if (!merged.has('cache-control')) merged.set('cache-control', 'no-store');
	return Response.json({ status, message }, { status, headers: merged });
}
