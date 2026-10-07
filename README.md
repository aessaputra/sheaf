# sheaf

Upload a PDF, share the link. A small, single-admin PDF sharing app on Cloudflare Workers.

[Live app](https://sheaf.aessaputra.workers.dev) · [Local setup](#local-setup) · [Deploy](#deploy)

## Features

- Password-protected admin: upload, list, copy links, and delete PDFs.
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
npm run dev
```

Open `/admin`, sign in, upload a PDF, and copy its `/v/[slug]` link. Local D1 and R2 data stay separate from production.

## Configuration

| Variable                 | Where                         | Purpose                                   |
| ------------------------ | ----------------------------- | ----------------------------------------- |
| `ADMIN_PASSWORD`         | `.dev.vars` / Worker secret   | Single admin password                     |
| `SESSION_SECRET`         | `.dev.vars` / Worker secret   | Signs seven-day admin sessions; 32+ chars |
| `CLOUDFLARE_ACCOUNT_ID`  | Local shell, Drizzle CLI only | Account containing the remote D1 database |
| `CLOUDFLARE_DATABASE_ID` | Local shell, Drizzle CLI only | Remote D1 database ID                     |
| `CLOUDFLARE_D1_TOKEN`    | Local shell, Drizzle CLI only | API token for remote D1 access            |

`wrangler.jsonc` binds `DB` to D1 and `PDFS` to R2. Uploads pass through the Worker directly into R2; no S3 credentials are needed. The app has no fixed upload-size cap, but Cloudflare request, memory, and R2 limits still apply.

The viewer fetches its pinned PDFium WASM from jsDelivr, so viewing requires access to that CDN.

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
```

`npm run gen` regenerates and formats the official Wrangler declarations. Run it before the first check/build, after changing `wrangler.jsonc`, and after the first build (or removing `.svelte-kit`): Wrangler includes the Worker entrypoint in its types only when that build output exists. The check/build scripts retain `wrangler types --check` and will reject stale declarations. These checks and builds do not need runtime secrets.

The focused checks cover PDF engine cleanup, full/range file responses, and build-time versus runtime secret validation. `npm run preview` serves the built Worker locally on port 4173.
