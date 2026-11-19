import { execFileSync } from 'node:child_process';

// EmbedPDF engine-core pins zod 3, which has no patched 3.x; upstream zod 4 support is open.
// https://github.com/embedpdf/embed-pdf-viewer/issues/1078
export const ALLOWED = new Set(['https://github.com/advisories/GHSA-mrhx-c7xc-m3w5']);

export function unapprovedAdvisories(report, allowed = ALLOWED) {
	const blocking = new Map();
	for (const vuln of Object.values(report?.vulnerabilities ?? {})) {
		for (const via of vuln?.via ?? []) {
			if (typeof via !== 'object' || !via.url) continue;
			if (via.severity !== 'high' && via.severity !== 'critical') continue;
			if (allowed.has(via.url)) continue;
			blocking.set(via.url, via.title ?? 'unknown advisory');
		}
	}
	return blocking;
}

function runAudit() {
	try {
		return JSON.parse(
			execFileSync('npm', ['audit', '--include=dev', '--json'], { encoding: 'utf8' })
		);
	} catch (e) {
		if (!e.stdout) {
			console.error('Security audit could not run.');
			process.exit(1);
		}
		return JSON.parse(e.stdout);
	}
}

if (import.meta.url === `file://${process.argv[1]}`) {
	const blocking = unapprovedAdvisories(runAudit());
	if (blocking.size) {
		console.error('Unapproved high/critical advisories:');
		for (const [url, title] of blocking) console.error(`- ${title} ${url}`);
		process.exit(1);
	}
	console.log(
		`Security audit passed: ${ALLOWED.size} known exception(s), no other high/critical advisories.`
	);
}
