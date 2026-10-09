import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parse, compile } from 'svelte/compiler';
import ts from 'typescript';

const root = new URL('../', import.meta.url);
const component = await readFile(new URL('src/routes/admin/+page.svelte', root), 'utf8');
function scriptBody(component) {
	const { content } = parse(component, { modern: true }).instance;
	const source = ts.createSourceFile(
		'component.ts',
		component.slice(content.start, content.end),
		ts.ScriptTarget.Latest,
		true
	);
	return ts.transpileModule(
		source.statements
			.filter((node) => !ts.isImportDeclaration(node))
			.map((node) => node.getText(source))
			.join('\n'),
		{ compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }
	).outputText;
}
function deferred() {
	let resolve, reject;
	const promise = new Promise((yes, no) => {
		resolve = yes;
		reject = no;
	});
	return { promise, resolve, reject };
}
function admin(goto = async () => {}) {
	const calls = [],
		errors = [],
		successes = [],
		navigation = [],
		confirmations = [];
	const run = new Function(
		'fetch',
		'toast',
		'goto',
		'confirm',
		'$state',
		'$props',
		'onMount',
		scriptBody(component) +
			'\nreturn { loadFiles, logout, goToLogin, handleDelete, handleLogin, setPassword(value) { password = value; }, snapshot: () => ({ files, authed, loading, loadError, loggingOut, password }) };'
	);
	const handlers = run(
		(url, options) => {
			const pending = deferred();
			calls.push({ url, options, ...pending });
			return pending.promise;
		},
		Object.assign(
			(message, options) => {
				confirmations.push({ message, ...options });
			},
			{ error: (message) => errors.push(message), success: (message) => successes.push(message) }
		),
		async (url) => {
			navigation.push(url);
			await goto(url);
		},
		() => true,
		(value) => value,
		() => ({ data: { authed: true } }),
		() => {}
	);
	return { ...handlers, calls, errors, successes, navigation, confirmations };
}
const response = (files) => Response.json({ files });
const oldFile = { slug: 'old', fileName: 'old.pdf' };
const newFile = { slug: 'new', fileName: 'new.pdf' };

// Latest fetch wins; an older finally must not stop the newer loading state.
let a = admin();
let old = a.loadFiles(),
	latest = a.loadFiles();
a.calls[0].resolve(response([oldFile]));
await old;
assert.equal(a.snapshot().loading, true);
a.calls[1].resolve(response([newFile]));
await latest;
assert.deepEqual(a.snapshot().files, [newFile]);
assert.equal(a.snapshot().loading, false);
a = admin();
old = a.loadFiles();
latest = a.loadFiles();
a.calls[1].resolve(response([newFile]));
await latest;
a.calls[0].resolve(response([oldFile]));
await old;
assert.deepEqual(a.snapshot().files, [newFile]);

// JSON completion is asynchronous too, including rejection.
for (const reject of [false, true]) {
	a = admin();
	const json = deferred();
	old = a.loadFiles();
	a.calls[0].resolve({ ok: true, status: 200, json: () => json.promise });
	await Promise.resolve();
	latest = a.loadFiles();
	a.calls[1].resolve(response([newFile]));
	await latest;
	if (reject) json.reject(new Error('stale JSON'));
	else json.resolve({ files: [oldFile] });
	await old;
	assert.deepEqual(a.snapshot().files, [newFile]);
	assert.equal(a.snapshot().loadError, null);
}
// Stale HTTP/auth/network errors cannot replace a newer result.
for (const status of [401, 500, 'network']) {
	a = admin();
	old = a.loadFiles();
	latest = a.loadFiles();
	a.calls[1].resolve(response([newFile]));
	await latest;
	if (status === 'network') a.calls[0].reject(new Error('offline'));
	else a.calls[0].resolve(new Response(null, { status }));
	await old;
	assert.equal(a.snapshot().authed, true);
	assert.equal(a.snapshot().loadError, null);
	assert.deepEqual(a.errors, []);
}
a = admin();
latest = a.loadFiles();
a.calls[0].reject(new Error('offline'));
await latest;
assert.equal(a.snapshot().loading, false);
assert.equal(a.snapshot().loadError, 'offline');
a = admin();
old = a.loadFiles();
latest = a.loadFiles();
a.calls[1].resolve(new Response(null, { status: 401 }));
await latest;
a.calls[0].resolve(response([oldFile]));
await old;
assert.equal(a.snapshot().authed, false);
assert.deepEqual(a.snapshot().files, []);
assert.equal(a.snapshot().loading, false);
assert.equal(a.errors.length, 1);

for (const choice of ['cancel', 'onDismiss']) {
	const state = admin();
	const pending = state.handleDelete('old');
	assert.equal(state.calls.length, 0);
	const confirmation = state.confirmations[0];
	if (choice === 'cancel') confirmation.cancel.onClick();
	else confirmation.onDismiss();
	await pending;
	assert.equal(state.calls.length, 0, 'Cancel/dismiss never deletes');
}

// Successful delete invalidates every older refresh, even a pending JSON body.
a = admin();
latest = a.loadFiles();
a.calls[0].resolve(response([oldFile]));
await latest;
const json = deferred();
old = a.loadFiles();
a.calls[1].resolve({ ok: true, status: 200, json: () => json.promise });
await Promise.resolve();
const deletion = a.handleDelete('old');
assert.equal(a.calls.length, 2, 'No DELETE before explicit confirmation');
assert.equal(a.confirmations[0].duration, Infinity);
a.confirmations[0].action.onClick();
await Promise.resolve();
a.calls[2].resolve(new Response());
await deletion;
json.resolve({ files: [oldFile] });
await old;
assert.deepEqual(a.snapshot().files, []);
assert.equal(a.snapshot().loading, false);

for (const outcome of ['http', 'network', 'success', 'navigation']) {
	a = admin(
		outcome === 'navigation'
			? async () => {
					throw new Error('navigation');
				}
			: undefined
	);
	a.setPassword('password');
	old = a.loadFiles();
	const logout = a.logout();
	await a.logout();
	assert.equal(a.calls.length, 2, 'duplicate sign out is ignored');
	assert.equal(a.snapshot().loggingOut, true);
	a.calls[0].resolve(new Response(null, { status: 401 }));
	await old;
	assert.equal(a.snapshot().authed, true, 'stale 401 during sign out is ignored');
	if (outcome === 'network') a.calls[1].reject(new Error('offline'));
	else a.calls[1].resolve(new Response(null, { status: outcome === 'http' ? 500 : 200 }));
	await logout;
	assert.equal(a.snapshot().loggingOut, false);
	assert.equal(a.snapshot().loading, false);
	assert.equal(a.snapshot().authed, outcome === 'http' || outcome === 'network');
	assert.equal(a.errors.length, outcome === 'success' ? 0 : 1);
	assert.deepEqual(a.navigation, outcome === 'http' || outcome === 'network' ? [] : ['/']);
	if (outcome === 'navigation') assert.match(a.errors[0], /Signed out/);
}
a = admin();
old = a.loadFiles();
const logout = a.logout();
a.calls[1].resolve(new Response());
await logout;
a.calls[0].resolve(response([oldFile]));
await old;
assert.deepEqual(a.snapshot().files, []);
assert.equal(a.snapshot().password, '');

for (const [status, message] of [
	[429, /Too many attempts/],
	[503, /unavailable/],
	[401, /Invalid credentials/]
]) {
	a = admin();
	a.setPassword('password');
	const login = a.handleLogin({ preventDefault() {} });
	a.calls[0].resolve(new Response(null, { status }));
	await login;
	assert.match(a.errors[0], message);
}
const upload = await readFile(new URL('src/lib/components/UploadCard.svelte', root), 'utf8');
assert.match(upload, /focus-within:outline-2/);
assert.doesNotMatch(upload, /Nothing was saved/);
const errors = [];
const runUpload = new Function(
	'fetch',
	'toast',
	'$state',
	'$props',
	scriptBody(upload) +
		'\nfileInput = { files: [{ name: "file.pdf", type: "application/pdf" }], value: "file.pdf" }; return handleChange().then(() => ({ uploading, value: fileInput.value }));'
);
const result = await runUpload(
	async () => {
		throw new Error('Network error');
	},
	{ error: (message) => errors.push(message) },
	(value) => value,
	() => ({ onuploaded() {} })
);
assert.match(errors[0], /Check the file list before retrying/);
assert.deepEqual(result, { uploading: false, value: '' });
for (const source of [component, upload]) {
	for (const generate of ['client', 'server']) {
		assert.deepEqual(compile(source, { generate }).warnings, []);
	}
}
console.log(
	'PASS: actual admin handlers, refresh/JSON races, deletion/logout invalidation, sign-out failures/pending, login feedback and upload network/focus guards.'
);
