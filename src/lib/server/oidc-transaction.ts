export const OIDC_TRANSACTION_COOKIE = 'sheaf_oidc';
export const OIDC_TRANSACTION_MAX_AGE = 600;

export type OidcTransaction = {
	state: string;
	nonce: string;
	verifier: string;
	iat: number;
};

const DOMAIN = 'sheaf:oidc-transaction:v1:';
const encoder = new TextEncoder();

function b64url(bytes: Uint8Array): string {
	let value = '';
	for (const byte of bytes) value += String.fromCharCode(byte);
	return btoa(value).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function unb64url(value: string): Uint8Array<ArrayBuffer> {
	if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('Invalid base64url');
	const raw = atob(
		value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - (value.length % 4)) % 4)
	);
	const bytes = Uint8Array.from(raw, (char) => char.charCodeAt(0));
	if (b64url(bytes) !== value) throw new Error('Noncanonical base64url');
	return bytes;
}

function isTransaction(value: unknown): value is OidcTransaction {
	if (!value || typeof value !== 'object') return false;
	return (
		'state' in value &&
		typeof value.state === 'string' &&
		/^[A-Za-z0-9_-]{32,128}$/.test(value.state) &&
		'nonce' in value &&
		typeof value.nonce === 'string' &&
		/^[A-Za-z0-9_-]{32,128}$/.test(value.nonce) &&
		'verifier' in value &&
		typeof value.verifier === 'string' &&
		/^[A-Za-z0-9._~-]{43,128}$/.test(value.verifier) &&
		'iat' in value &&
		typeof value.iat === 'number' &&
		Number.isSafeInteger(value.iat) &&
		value.iat >= 0
	);
}

async function transactionKey(secret: string): Promise<CryptoKey> {
	if (!secret) throw new Error('SESSION_SECRET is required');
	return crypto.subtle.importKey(
		'raw',
		encoder.encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign', 'verify']
	);
}

export async function encodeOidcTransaction(
	values: Omit<OidcTransaction, 'iat'>,
	secret: string,
	now = Date.now()
): Promise<string> {
	const transaction = { ...values, iat: now };
	if (!isTransaction(transaction)) throw new Error('Invalid OIDC transaction');
	const payload = b64url(encoder.encode(JSON.stringify(transaction)));
	const signature = await crypto.subtle.sign(
		'HMAC',
		await transactionKey(secret),
		encoder.encode(DOMAIN + payload)
	);
	return `${payload}.${b64url(new Uint8Array(signature))}`;
}

export async function verifyOidcTransaction(
	token: string | undefined,
	secret: string,
	now = Date.now()
): Promise<OidcTransaction | null> {
	if (!token || token.length > 2048 || !secret || !Number.isSafeInteger(now)) return null;
	try {
		const parts = token.split('.');
		if (parts.length !== 2) return null;
		const [payload, signature] = parts;
		const bytes = unb64url(payload);
		const mac = unb64url(signature);
		if (
			mac.length !== 32 ||
			!(await crypto.subtle.verify(
				'HMAC',
				await transactionKey(secret),
				mac,
				encoder.encode(DOMAIN + payload)
			))
		)
			return null;
		const transaction: unknown = JSON.parse(
			new TextDecoder('utf-8', { fatal: true }).decode(bytes)
		);
		if (
			!isTransaction(transaction) ||
			transaction.iat > now ||
			now - transaction.iat >= OIDC_TRANSACTION_MAX_AGE * 1000
		)
			return null;
		return transaction;
	} catch {
		return null;
	}
}
