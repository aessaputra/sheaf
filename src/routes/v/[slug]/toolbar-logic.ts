type ZoomShortcutEvent = Pick<
	KeyboardEvent,
	'ctrlKey' | 'altKey' | 'metaKey' | 'isComposing' | 'defaultPrevented' | 'key' | 'target'
>;

export function validZoom(draft: string | null): boolean {
	const value = Number(draft);
	// Stage zoom range is 5..6400%; the toolbar keeps its narrower 20..6000% entry range.
	return (
		draft !== null &&
		/^\d+(\.\d+)?$/.test(draft.trim()) &&
		Number.isFinite(value) &&
		value >= 20 &&
		value <= 6000
	);
}

export function zoomLevel(draft: string | null): number | null {
	return validZoom(draft) ? Number(draft) / 100 : null;
}

export function pageIndex(draft: string | null, pageCount: number): number | null {
	const value = Number(draft);
	if (
		draft === null ||
		!/^\d+$/.test(draft.trim()) ||
		!Number.isInteger(value) ||
		value < 1 ||
		value > pageCount
	)
		return null;
	return value - 1;
}

export function zoomShortcut(event: ZoomShortcutEvent, pageCount: number): 'in' | 'out' | null {
	if (
		!event.ctrlKey ||
		event.altKey ||
		event.metaKey ||
		event.isComposing ||
		event.defaultPrevented ||
		pageCount <= 0
	)
		return null;
	const target = event.target;
	if (
		target instanceof HTMLElement &&
		(target.isContentEditable || target.closest('input, textarea, select'))
	)
		return null;
	if (event.key === '-') return 'out';
	if (event.key === '+' || event.key === '=') return 'in';
	return null;
}
