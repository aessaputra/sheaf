import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const server = await readFile(new URL('src/routes/admin/+page.server.ts', root), 'utf8');
const component = await readFile(new URL('src/routes/admin/+page.svelte', root), 'utf8');
const helper = await readFile(new URL('src/lib/server/admin-files.ts', root), 'utf8');
const api = await readFile(new URL('src/routes/api/files/+server.ts', root), 'utf8');

// Server load queries the file list for authed sessions and returns it inline.
assert.match(server, /initialFiles/);
assert.match(server, /locals\.session/);
// Shared query helper reused by the API route, not duplicated.
assert.match(helper, /export async function listFiles/);
assert.match(api, /listFiles/);
assert.match(server, /listFiles/);
// No duplicate client fetch of the initial list on mount when server data exists.
assert.doesNotMatch(component, /if \(authed\) void loadFiles\(\)/);
assert.match(component, /data\.initialFiles/);
// Private admin HTML must not be cached.
assert.doesNotMatch(server, /cache-control/i);
// Client keeps refresh/retry paths.
assert.match(component, /onuploaded=\{loadFiles\}/);
assert.match(component, /onclick=\{loadFiles\}/);
console.log('PASS: admin SSR initial list, shared query, no duplicate initial fetch.');
