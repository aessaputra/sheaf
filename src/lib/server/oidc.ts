export function parseAllowlist(value: string | undefined): string[] {
	if (!value) return [];
	const seen = new Set<string>();
	for (const part of value.split(',')) {
		const v = part.trim().toLowerCase();
		if (v && !seen.has(v)) seen.add(v);
	}
	return [...seen];
}

export function isOidcAllowed(args: {
	email?: unknown;
	sub?: unknown;
	allowedEmails?: string;
	allowedSubs?: string;
}): boolean {
	const emails = parseAllowlist(args.allowedEmails);
	const subs = parseAllowlist(args.allowedSubs);
	if (emails.length === 0 && subs.length === 0) return false; // fail closed
	if (typeof args.email === 'string' && emails.includes(args.email.toLowerCase())) return true;
	if (typeof args.sub === 'string' && subs.includes(args.sub.toLowerCase())) return true;
	return false;
}

export function normalizeIssuer(issuer: string): string {
	return issuer.replace(/\/+$/, '');
}
