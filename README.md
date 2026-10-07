# sheaf

Minimal PDF sharing on Cloudflare. Admin uploads PDFs, anyone with the link views them.

## Setup

```sh
npm install
cp .env.example .dev.vars
# fill in ADMIN_PASSWORD and SESSION_SECRET in .dev.vars
npm run dev
```

Requires Node 20+ and a Cloudflare account for deploy.

## Environment variables

| Name                   | Where             | Purpose                                    |
| ---------------------- | ----------------- | ------------------------------------------ |
| `ADMIN_PASSWORD`       | wrangler secret   | Single admin password for `/admin` login   |
| `SESSION_SECRET`       | wrangler secret   | Signs the admin session cookie             |
| `CLOUDFLARE_ACCOUNT_ID`  | local shell only  | drizzle-kit access to remote D1            |
| `CLOUDFLARE_DATABASE_ID` | local shell only  | drizzle-kit access to remote D1            |
| `CLOUDFLARE_D1_TOKEN`    | local shell only  | drizzle-kit access to remote D1            |

Local dev reads `ADMIN_PASSWORD`/`SESSION_SECRET` from `.dev.vars`.
Production reads them from worker secrets — never commit real values.

Uploads go through the Worker (`POST /api/files`, multipart, 10 MB cap)
straight into the `PDFS` R2 binding. No S3 credentials needed.

## Deploy

One-time provisioning:

```sh
npx wrangler d1 create sheaf-db
# put the returned database_id into wrangler.jsonc
npx wrangler d1 execute sheaf-db --remote --file drizzle/0000_good_liz_osborn.sql
npx wrangler r2 bucket create sheaf-pdfs
echo -n "<password>" | npx wrangler secret put ADMIN_PASSWORD
echo -n "<secret>" | npx wrangler secret put SESSION_SECRET
```

Every deploy:

```sh
npm run build
npx wrangler deploy
```

Live checklist after deploy: log in at `/admin`, upload a PDF, open
`/v/[slug]` logged out, check a bogus slug returns 404, delete the file.
