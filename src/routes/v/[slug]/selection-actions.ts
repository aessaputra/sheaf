interface CopyableSelection {
	canCopy(): boolean;
	getRange(): unknown;
	clear(): void;
}

export async function copySelectedText<T extends CopyableSelection>(
	selection: T,
	copy: (selection: T) => Promise<unknown>,
	onError: () => void
): Promise<void> {
	if (!selection.canCopy()) return;
	try {
		const range = selection.getRange();
		await copy(selection);
		if (selection.getRange() === range) selection.clear();
	} catch {
		onError();
	}
}
