# sheaf

Upload a PDF, share the link. A small, single-admin PDF sharing app on Cloudflare Workers.

[Live app](https://sheaf.aessaputra.workers.dev) · [Local setup](#local-setup) · [Configuration](#configuration) · [Deploy](#deploy)

## Features

- Password-protected admin: upload, list, copy links, and delete PDFs; optional OIDC login.
- Public viewer with page navigation, zoom presets, text selection, and downloads.
- PDFs stored in R2; file metadata stored in D1 with Drizzle ORM.
- SvelteKit 3, Svelte 5, Tailwind CSS 4, and EmbedPDF 2.15.1 (PDFium).

> [!WARNING]
> Anyone with a share link can view and download the PDF. Links are not private access controls. Files are publicly cached for up to a year; deleting a file does not recall downloaded or cached copies.

## Local setup

Requires Node.js 22.17+ and npm. Deployment needs a Cloudflare account with Workers, D1, and R2.

```sh
npm ci
npm run gen
cp .env.example .dev.vars
```

Set `ADMIN_PASSWORD` (long random password) and `SESSION_SECRET` (32+ random characters) in `.dev.vars`. Never commit real values.

```sh
npx wrangler d1 execute sheaf-db --local --file drizzle/0000_good_liz_osborn.sql
npm run dev -- --port 5173 --strictPort
```

Open `/admin`, sign in, upload a PDF, and copy its `/v/[slug]` link. Local D1 and R2 data stay separate from production.

## Configuration

| Variable                                                                   | Purpose                                                    |
| -------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `ADMIN_PASSWORD`                                                           | Required admin password (also works as fallback with OIDC) |
| `SESSION_SECRET`                                                           | Required; signs seven-day admin sessions (32+ chars)       |
| `OIDC_ISSUER`                                                              | Optional HTTPS issuer URL; empty disables OIDC             |
| `OIDC_CLIENT_ID` / `OIDC_CLIENT_SECRET`                                    | Optional confidential client credentials (server-only)     |
| `OIDC_TOKEN_ENDPOINT_AUTH_METHOD`                                          | `client_secret_basic` (default) or `client_secret_post`    |
| `OIDC_REDIRECT_URI`                                                        | Exact callback URL ending in `/api/auth/oidc/callback`     |
| `OIDC_ALLOWED_EMAILS` / `OIDC_ALLOWED_SUBS`                                | Optional allowlists; at least one entry required for OIDC  |
| `CLOUDFLARE_ACCOUNT_ID` / `CLOUDFLARE_DATABASE_ID` / `CLOUDFLARE_D1_TOKEN` | Local shell only, for remote D1 via Drizzle CLI            |

`wrangler.jsonc` binds `DB` to D1 and `PDFS` to R2. Uploads stream through the Worker into R2; no S3 credentials needed. Password login is rate-limited to 3 attempts per client IP per 60 seconds. The viewer fetches its pinned PDFium WASM from jsDelivr.

For OIDC, register a confidential client (Authorization Code + PKCE S256, scopes `openid profile email`), set the fields above via `npx wrangler secret put <NAME>`, and verify login, allowlist denial, password fallback, logout, and logged-out viewing.

## Deploy

```sh
npx wrangler login
npx wrangler d1 create sheaf-db
npx wrangler r2 bucket create sheaf-pdfs
```

Put the returned `database_id` in `wrangler.jsonc`, then:

```sh
npx wrangler d1 execute sheaf-db --remote --file drizzle/0000_good_liz_osborn.sql
npx wrangler secret put ADMIN_PASSWORD
npx wrangler secret put SESSION_SECRET
npm run gen
npm run build
npm run gen
npx wrangler deploy
```

Enter secrets at Wrangler's prompts. After deployment, verify login, upload, logged-out viewing and download, a missing link returning 404, and deletion with a disposable PDF.

## Development checks

```sh
npm run gen
npm run check
npm run build
npm run gen
npm run check
npm run lint
npm run check:regression
```

Run `npm run gen` before the first check/build, after changing `wrangler.jsonc`, and after the first build: Wrangler adds the Worker entrypoint to its types only when build output exists. Checks and builds need no runtime secrets. `npm run preview` serves the built Worker locally on port 4173.
