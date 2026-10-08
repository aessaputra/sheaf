import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const root = new URL('../src/routes/v/[slug]/', import.meta.url);
const viewer = readFileSync(new URL('HeadlessViewer.svelte', root), 'utf8');
assert.match(viewer, /locked: \{ type: LockModeType.All \}/);
assert.match(viewer, /autoOpenLinks: false/);
assert.match(viewer, /<AnnotationLayer/);
assert.match(viewer, /<PagePointerProvider/);
assert.match(viewer, /<GlobalPointerProvider/);
const link = readFileSync(new URL('PdfLink.svelte', root), 'utf8');
assert.match(link, /type="button"/);
assert.match(link, /popover="auto"/);
assert.match(link, /Go to link/);
assert.match(link, /hover:bg-blue-500\/15/);
const linkClass = link.match(/<button[\s\S]*?class="([\s\S]*?)"/)?.[1];
assert.ok(linkClass);
const classesFor = new Function(
	'selected',
	'return `' + linkClass.replace('{selected', '${selected') + '`;'
);
for (const selected of [false, true]) {
	const classes = classesFor(selected).split(/\s+/);
	assert.equal(classes.includes('bg-transparent'), !selected);
	assert.equal(classes.includes('bg-blue-500/15'), selected);
	for (const utility of ['hover:outline-2', 'hover:-outline-offset-2', 'hover:outline-blue-500']) {
		assert.ok(classes.includes(utility), utility);
	}
}
assert.match(link, /block h-full w-full/); // Small PDF hitboxes must not inherit inline baseline offsets.
assert.match(link, /aria-expanded=\{selected\}/);
assert.doesNotMatch(link, /aria-label="Open PDF link" onclick=\{navigate\}/);
assert.match(link, /capability\.provides\?\.forDocument/);
const source = readFileSync(new URL('PdfLinkNavigation.svelte', root), 'utf8');
const script = source
	.match(/<script lang="ts">([\s\S]*?)<\/script>/)[1]
	.replace(/import[^;]+;/g, '');
let navigate;
let cleanup;
let unsubscribed = false;
const opened = [];
vm.runInNewContext(script, {
	URL,
	useAnnotationCapability: () => ({
		provides: {
			onNavigate: (handler) => {
				navigate = handler;
				return () => {
					unsubscribed = true;
				};
			}
		}
	}),
	$effect: (effect) => {
		cleanup = effect();
	},
	window: { open: (...args) => opened.push(args) }
});
for (const uri of [
	'https://example.com/',
	'http://example.com/',
	'mailto:test@example.com',
	'tel:+123'
]) {
	navigate({ result: { outcome: 'uri', uri } });
}
assert.equal(opened.length, 4);
for (const args of opened) assert.deepEqual(args.slice(1), ['_blank', 'noopener,noreferrer']);
for (const uri of [
	'javascript:alert(1)',
	'data:text/html,test',
	'file:///etc/passwd',
	'not a url'
]) {
	navigate({ result: { outcome: 'uri', uri } });
}
navigate({ result: { outcome: 'destination' } });
assert.equal(opened.length, 4);
cleanup();
assert.ok(unsubscribed);
console.log('PASS: PDF link integration, safe protocols, blocked targets and navigation cleanup.');
