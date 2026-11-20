import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

const errorHtml = await read('src/error.html');
assert.match(errorHtml, /%sveltekit\.status%/, 'fallback page renders the status');
assert.match(errorHtml, /%sveltekit\.error\.message%/, 'fallback page renders the message');

const errorPage = await read('src/routes/+error.svelte');
assert.match(errorPage, /from '\$app\/state'/, 'error page reads page state');
assert.match(errorPage, /page\.status/, 'error page renders the status');
assert.match(errorPage, /page\.error/, 'error page renders the message');

console.log('PASS: root error page and static fallback exist');
