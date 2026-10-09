import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { parse } from 'svelte/compiler';
import ts from 'typescript';

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
// Run the actual selected-only capture listener and its cleanup.
const linkAst = parse(link, { modern: true });
const linkScript = ts.createSourceFile(
	'link.ts',
	link.slice(linkAst.instance.content.start, linkAst.instance.content.end),
	ts.ScriptTarget.Latest,
	true
);
const scrollEffect = linkScript.statements.find(
	(node) =>
		ts.isExpressionStatement(node) &&
		ts.isCallExpression(node.expression) &&
		node.expression.expression.getText(linkScript) === '$effect'
);
assert.ok(scrollEffect);
class ScrollNode {
	constructor(parent = null) {
		this.parent = parent;
	}
	contains(node) {
		return node === this || (!!node?.parent && this.contains(node.parent));
	}
}
const ancestor = new ScrollNode();
const trigger = new ScrollNode(ancestor);
const menu = new ScrollNode(ancestor);
const descendant = new ScrollNode(menu);
const unrelated = new ScrollNode();
const document = {};
const listeners = [];
const removals = [];
const window = {
	addEventListener: (...args) => listeners.push(args),
	removeEventListener: (...args) => removals.push(args)
};
let closed = 0;
menu.hidePopover = () => closed++;
const runScrollEffect = new Function(
	'selected',
	'menu',
	'trigger',
	'window',
	'document',
	'Node',
	'$effect',
	ts.transpile(scrollEffect.getText(linkScript))
);
let scrollCleanup;
const effect = (callback) => {
	scrollCleanup = callback();
};
runScrollEffect(false, menu, trigger, window, document, ScrollNode, effect);
assert.equal(listeners.length, 0);
runScrollEffect(true, menu, trigger, window, document, ScrollNode, effect);
assert.equal(listeners.length, 1);
const [eventName, closeOnScroll, capture] = listeners[0];
assert.equal(eventName, 'scroll');
assert.equal(capture, true);
for (const target of [menu, descendant, trigger, unrelated]) closeOnScroll({ target });
assert.equal(closed, 0, 'Menu, descendant and unrelated scroll must leave the menu open');
for (const target of [ancestor, document, window]) closeOnScroll({ target });
assert.equal(closed, 3, 'Ancestor and document/window scroll must close the menu');
scrollCleanup();
assert.deepEqual(removals, listeners);
// The native toggle event must activate the selected-only listener state.
let toggleExpression;
let beforeToggleExpression;
function visitLink(node) {
	if (!node || typeof node !== 'object') return;
	if (node.type === 'RegularElement' && node.name === 'div') {
		toggleExpression = node.attributes.find((attr) => attr.name === 'ontoggle')?.value.expression;
		beforeToggleExpression = node.attributes.find((attr) => attr.name === 'onbeforetoggle')?.value
			.expression;
		assert.ok(beforeToggleExpression);
	}
	for (const value of Object.values(node)) {
		if (Array.isArray(value)) value.forEach(visitLink);
		else if (value && typeof value === 'object') visitLink(value);
	}
}
visitLink(linkAst.fragment);
assert.ok(toggleExpression);
const positions = [];
const toggle = new Function(
	'trigger',
	'positionPopover',
	ts.transpile(`let selected = false;
const toggle = ${link.slice(toggleExpression.start, toggleExpression.end)};
return (event) => { toggle(event); return selected; };`)
)(trigger, (...args) => positions.push(args));
assert.equal(toggle({ newState: 'open', currentTarget: menu }), true);
assert.equal(toggle({ newState: 'closed', currentTarget: menu }), false);
assert.deepEqual(positions, []);
const frames = [];
menu.matches = () => true;
const beforeToggle = new Function(
	'trigger',
	'positionPopover',
	'requestAnimationFrame',
	ts.transpile(`return ${link.slice(beforeToggleExpression.start, beforeToggleExpression.end)};`)
)(
	trigger,
	(...args) => positions.push(args),
	(callback) => frames.push(callback)
);
beforeToggle({ newState: 'open', currentTarget: menu });
assert.deepEqual(positions, [], 'Positioning waits until the menu has measurable dimensions');
frames.shift()();
assert.deepEqual(positions, [[menu, trigger]]);
beforeToggle({ newState: 'closed', currentTarget: menu });
assert.equal(frames.length, 0);
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
