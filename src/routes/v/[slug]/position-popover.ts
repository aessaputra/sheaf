// Call after the native popover opens so its actual dimensions can be measured.
export function positionPopover(menu: HTMLElement, anchor: HTMLElement) {
	const margin = 8;
	const gap = 8;
	const viewport = window.visualViewport;
	const left = viewport?.offsetLeft ?? 0;
	const top = viewport?.offsetTop ?? 0;
	const width = viewport?.width ?? window.innerWidth;
	const height = viewport?.height ?? window.innerHeight;
	const rect = anchor.getBoundingClientRect();
	menu.style.minWidth = '0';
	menu.style.maxWidth = `${Math.max(0, width - margin * 2)}px`;
	menu.style.maxHeight = `${Math.max(0, height - margin * 2)}px`;
	const size = menu.getBoundingClientRect();
	const below = Math.max(0, top + height - margin - rect.bottom - gap);
	const above = Math.max(0, rect.top - gap - top - margin);
	const placeBelow = size.height <= below || below >= above;
	const available = Math.min(height - margin * 2, placeBelow ? below : above);
	menu.style.maxHeight = `${Math.max(0, available)}px`;
	const menuHeight = Math.min(size.height, Math.max(0, available));
	menu.style.left = `${Math.max(left + margin, Math.min(rect.left, left + width - margin - size.width))}px`;
	menu.style.top = `${Math.max(top + margin, Math.min(placeBelow ? rect.bottom + gap : rect.top - gap - menuHeight, top + height - margin - menuHeight))}px`;
}
