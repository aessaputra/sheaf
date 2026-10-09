export const COOKIE_NAME = 'sheaf_session';
export const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function b64url(bytes: Uint8Array): string {
	let s = '';
	for (const b of bytes) s += String.fromCharCode(b);
	return btoa(s).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function unb64url(s: string): Uint8Array {
	const b = s.replaceAll('-', '+').replaceAll('_', '/');
	const bin = atob(b + '='.repeat((4 - (b.length % 4)) % 4));
	return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function sign(value: string, secret: string): Promise<string> {
	const key = await crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
	return `${value}.${b64url(new Uint8Array(sig))}`;
}

export function timingSafeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return diff === 0;
}

export async function createSessionToken(secret: string): Promise<string> {
	const payload = b64url(new TextEncoder().encode(`authed:${Date.now()}`));
	return sign(payload, secret);
}

export async function verifySessionToken(
	token: string | undefined,
	secret: string
): Promise<boolean> {
	if (!token) return false;
	const dot = token.lastIndexOf('.');
	if (dot < 1) return false;
	const payload = token.slice(0, dot);
	const expected = await sign(payload, secret);
	if (!timingSafeEqual(expected, token)) return false;
	let raw: string;
	try {
		raw = new TextDecoder().decode(unb64url(payload));
	} catch {
		return false;
	}
	if (!raw.startsWith('authed:')) return false;
	const ts = Number(raw.slice(7));
	return Number.isFinite(ts) && ts <= Date.now() && Date.now() - ts < MAX_AGE * 1000;
}
