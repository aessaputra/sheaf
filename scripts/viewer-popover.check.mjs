import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { moduleUrl } from './check-source.mjs';

const { positionPopover } = await import(
	moduleUrl(
		readFileSync(new URL('../src/routes/v/[slug]/position-popover.ts', import.meta.url), 'utf8')
	)
);
for (const viewport of [
	{ width: 360, height: 640, offsetLeft: 0, offsetTop: 0 },
	{ width: 240, height: 180, offsetLeft: 20, offsetTop: 50 }
]) {
	globalThis.window = { visualViewport: viewport };
	for (const anchor of [
		{
			left: viewport.offsetLeft + 10,
			top: viewport.offsetTop + 10,
			bottom: viewport.offsetTop + 42
		},
		{
			left: viewport.offsetLeft + viewport.width - 20,
			top: viewport.offsetTop + viewport.height - 42,
			bottom: viewport.offsetTop + viewport.height - 10
		}
	]) {
		for (const naturalSize of [
			{ width: 160, height: 360 },
			{ width: 400, height: 80 }
		]) {
			const style = {};
			const menu = {
				style,
				getBoundingClientRect: () => ({
					width: Math.min(naturalSize.width, parseFloat(style.maxWidth)),
					height: Math.min(naturalSize.height, parseFloat(style.maxHeight))
				})
			};
			positionPopover(menu, { getBoundingClientRect: () => anchor });
			const size = menu.getBoundingClientRect();
			assert.ok(parseFloat(style.left) >= viewport.offsetLeft + 8);
			assert.ok(parseFloat(style.top) >= viewport.offsetTop + 8);
			assert.ok(parseFloat(style.left) + size.width <= viewport.offsetLeft + viewport.width - 8);
			assert.ok(parseFloat(style.top) + size.height <= viewport.offsetTop + viewport.height - 8);
		}
	}
}
// Position on the first animation frame, not the deferred toggle event.
for (const name of ['ViewerToolbar', 'PdfLink']) {
	const source = readFileSync(
		new URL(`../src/routes/v/[slug]/${name}.svelte`, import.meta.url),
		'utf8'
	);
	assert.match(source, /onbeforetoggle=/, `${name} prepares positioning before opening`);
	assert.match(source, /requestAnimationFrame\(/, `${name} positions before the first paint`);
}
delete globalThis.window;
console.log('PASS: measured popovers fit narrow/short/offset viewports and both anchor edges.');
