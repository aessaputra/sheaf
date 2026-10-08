# sheaf

Upload a PDF, share the link. A small, single-admin PDF sharing app on Cloudflare Workers.

[Live app](https://sheaf.aessaputra.workers.dev) · [Local setup](#local-setup) · [Deploy](#deploy)

## Features

- Password-protected admin: upload, list, copy links, and delete PDFs; optional OIDC login via oauth4webapi.
- Public viewer with page navigation, zoom, fit-to-width, and downloads.
- PDFs stored in R2; file metadata stored in D1 with Drizzle ORM.
- SvelteKit 3, Svelte 5, Tailwind CSS 4, and EmbedPDF 2.15.1 (PDFium).

> [!WARNING]
> Anyone with a share link can view and download the PDF. Links are not private access controls. Files are publicly cached for up to a year; deleting a file does not recall downloaded or cached copies.

## Local setup

Use Node.js 22.17+ and npm. Deployment also requires a Cloudflare account with Workers, D1, and R2 enabled.

```sh
npm ci
npm run gen
cp .env.example .dev.vars
```

Set `ADMIN_PASSWORD` to a long random password and `SESSION_SECRET` to at least 32 random characters in `.dev.vars`. Never commit real values.

Initialize the local database, then start the app:

```sh
npx wrangler d1 execute sheaf-db --local --file drizzle/0000_good_liz_osborn.sql
npm run dev -- --port 5173 --strictPort
```

Open `/admin`, sign in, upload a PDF, and copy its `/v/[slug]` link. Local D1 and R2 data stay separate from production.

## Configuration

| Variable                          | Where                         | Purpose                                                                                                                                  |
| --------------------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `ADMIN_PASSWORD`                  | `.dev.vars` / Worker secret   | Required single-admin password, retained as fallback even with OIDC                                                                      |
| `SESSION_SECRET`                  | `.dev.vars` / Worker secret   | Required; signs seven-day admin sessions and OIDC transactions; 32+ chars                                                                |
| `OIDC_ISSUER`                     | `.dev.vars` / Worker secret   | Optional HTTPS OIDC issuer URL, e.g. `https://auth.example.com`; preserved exactly, including path trailing slashes; empty disables OIDC |
| `OIDC_CLIENT_ID`                  | `.dev.vars` / Worker secret   | Optional confidential client ID registered with the OIDC provider                                                                        |
| `OIDC_CLIENT_SECRET`              | `.dev.vars` / Worker secret   | Optional confidential client secret from the OIDC provider; server-only                                                                  |
| `OIDC_TOKEN_ENDPOINT_AUTH_METHOD` | `.dev.vars` / Worker secret   | Optional registered method: `client_secret_basic` (default) or `client_secret_post`                                                      |
| `OIDC_REDIRECT_URI`               | `.dev.vars` / Worker secret   | Optional exact registered callback URL ending in `/api/auth/oidc/callback`                                                               |
| `OIDC_ALLOWED_EMAILS`             | `.dev.vars` / Worker secret   | Optional comma-separated email allowlist, trimmed and case-insensitive; requires `email_verified: true`                                  |
| `OIDC_ALLOWED_SUBS`               | `.dev.vars` / Worker secret   | Optional comma-separated subject allowlist, trimmed with exact case-sensitive `sub` matching                                             |
| `CLOUDFLARE_ACCOUNT_ID`           | Local shell, Drizzle CLI only | Account containing the remote D1 database                                                                                                |
| `CLOUDFLARE_DATABASE_ID`          | Local shell, Drizzle CLI only | Remote D1 database ID                                                                                                                    |
| `CLOUDFLARE_D1_TOKEN`             | Local shell, Drizzle CLI only | API token for remote D1 access                                                                                                           |

`wrangler.jsonc` binds `DB` to D1 and `PDFS` to R2. Uploads pass through the Worker directly into R2; no S3 credentials are needed. The app has no fixed upload-size cap, but Cloudflare request, memory, and R2 limits still apply.

The viewer fetches its pinned PDFium WASM from jsDelivr, so viewing requires access to that CDN.

## Optional OIDC login

Password login remains available and `ADMIN_PASSWORD` and `SESSION_SECRET` remain required. To show the OIDC button, supply all four provider fields, a session secret, valid issuer/callback URLs and at least one nonempty entry in either allowlist. Both lists empty fail closed. A verified allowlisted email **or** an exact allowlisted subject authorizes the same admin session; subject authorization does not require a verified email. OIDC configuration and secrets stay server-side; the client receives only availability/error UI data.

Register a confidential client with your OIDC provider using Authorization Code with PKCE (S256), scopes `openid profile email`, and `client_secret_basic` or `client_secret_post` token authentication. Set `OIDC_TOKEN_ENDPOINT_AUTH_METHOD` to the method registered for this client (`client_secret_basic` or `client_secret_post`). If omitted, it defaults to Basic for backward compatibility; provider capabilities never override the client setting. An unsupported provider method fails without retrying the authorization code. Register the redirect URI exactly, without query or fragment:

- Production: `https://sheaf.aessaputra.workers.dev/api/auth/oidc/callback`
- Local development with the strict port command above: `http://localhost:5173/api/auth/oidc/callback`. If you choose another port, confirm Vite's actual listening URL and change both the registration and `OIDC_REDIRECT_URI` together. HTTP callbacks are allowed only for development loopback hosts; the issuer must use HTTPS.

Set the optional fields in `.dev.vars` locally (the unused allowlist may be empty). For production, use Wrangler's interactive prompts, never command-line secret values:

```sh
npx wrangler secret put OIDC_ISSUER
npx wrangler secret put OIDC_CLIENT_ID
npx wrangler secret put OIDC_CLIENT_SECRET
npx wrangler secret put OIDC_TOKEN_ENDPOINT_AUTH_METHOD
npx wrangler secret put OIDC_REDIRECT_URI
npx wrangler secret put OIDC_ALLOWED_EMAILS
npx wrangler secret put OIDC_ALLOWED_SUBS
```

An incomplete configuration hides the button; an absent configuration returns 503 from the OIDC endpoints. Nonallowlisted identities return to `/admin?error=forbidden` without a session. Discovery, token exchange (including response-body processing), and signature/JWKS verification each have a separate 10-second deadline (up to 30 seconds of remote phases on callback). Abort signals cancel stalled network/body reads; timers are cleared after each phase. Timeout/provider failures return controlled 502 responses. The signed login transaction expires after 600 seconds. After registration, manually verify a successful OIDC login, allowlist denial, a missing transaction cookie/wrong state, password fallback, logout, and logged-out public viewing. Local synthetic checks below do not establish live OIDC integration; that requires a registered client and real credentials.

## Deploy

Authenticate and provision your own resources:

```sh
npx wrangler login
npx wrangler d1 create sheaf-db
npx wrangler r2 bucket create sheaf-pdfs
```

Replace `database_id` in `wrangler.jsonc` with the ID returned by D1. If you change resource names, update the configuration and commands accordingly.

```sh
npx wrangler d1 execute sheaf-db --remote --file drizzle/0000_good_liz_osborn.sql
npx wrangler secret put ADMIN_PASSWORD
npx wrangler secret put SESSION_SECRET
npm run gen
npm run build
npm run gen
npx wrangler deploy
```

Enter secrets at Wrangler's prompts. Builds do not require application secrets; the running Worker does.

After deployment, verify login, upload, logged-out viewing and download, a missing link returning 404, and deletion using a disposable PDF.

## Development checks

From a fresh checkout, install dependencies with `npm ci`, then run:

```sh
npm run gen
npm run check
npm run build
npm run gen
npm run check
npm run lint
node scripts/engine-lifecycle.check.mjs
node scripts/file-response.check.mjs
node scripts/env-validation.check.mjs
node scripts/oidc-allowlist.check.mjs
node scripts/oidc-start.check.mjs
node scripts/oidc-callback.check.mjs
node scripts/auth-hooks.check.mjs
node scripts/admin-oidc.check.mjs
node scripts/pdf-links.check.mjs
node scripts/viewer-a11y.check.mjs
node scripts/viewer-toolbar.check.mjs
```

`npm run gen` regenerates and formats the official Wrangler declarations. Run it before the first check/build, after changing `wrangler.jsonc`, and after the first build (or removing `.svelte-kit`): Wrangler includes the Worker entrypoint in its types only when that build output exists. The check/build scripts retain `wrangler types --check` and will reject stale declarations. These checks and builds do not need runtime secrets.

The focused checks cover PDF engine cleanup, full/range file responses, build-time versus runtime secret validation, OIDC allowlists/start/transactions/callback (synthetic signed JWTs), authentication hooks and admin UI availability, PDF links, viewer accessibility, and toolbar behavior. `npm run preview` serves the built Worker locally on port 4173.
