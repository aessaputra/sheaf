# sheaf — Design Spec

- Date: 2026-10-07
- Status: draft for user review
- Language: English (code, comments, UI copy, docs)
- Viewer: EmbedPDF branch `v2` (stable). Never `main` (v3, not production ready).
- Auth: single admin password + signed session cookie. No Better Auth.

## 1. Problem

One person uploads PDFs. Anyone with a random link views them. No sign-up, no multi-user, no per-link passwords in v1.

What must stay true:

- Only the owner can open `/admin` and call `/api/*`.
- Public links (`/v/[slug]`) open without login and never leak the full file list.
- Files live in R2. Metadata lives in D1. Nothing else stores state.
- The viewer stays fast on mobile: zoom, search, page jump.

## 2. Architecture

Single SvelteKit 3 app on Cloudflare Workers (Static Assets via `@sveltejs/adapter-cloudflare` v8). One D1 database (`sheaf-db`). One R2 bucket (`sheaf-pdfs`).

```text
browser --HTTPS--> SvelteKit (Workers)
  |-- /            static landing, no DB fetch
  |-- /admin       password gate, upload + list + delete
  |-- /v/[slug]    public, slug lookup in D1, range stream from R2
  |-- /api/*       session gate: presigned PUT URL, metadata write, delete
SvelteKit --> D1 (table pdf_files) : metadata only
SvelteKit --> R2 (sheaf-pdfs)      : file bytes, presigned PUT + range GET
```

Routes:

- `/` — static landing. Name, one sentence, admin login entry. No D1 query. Prerenderable.
- `/admin` — login form, then upload list. Session required.
- `/v/[slug]` — public viewer. Slug lookup, 404 on miss, range stream on hit.
- `/api/login`, `/api/logout` — password check, session cookie set/clear.
- `/api/upload-url` — session required. Returns `{ slug, url }` presigned PUT to `pdfs/[slug].pdf`.
- `/api/files` (POST) — session required. Writes D1 row after the browser confirms the R2 PUT.
- `/api/files/[slug]` (DELETE) — session required. Deletes the R2 object first, then the D1 row.

## 3. Components and dependencies

Base (already scaffolded): SvelteKit 3.0.x, Svelte 5 (runes), TypeScript, Tailwind 4, `drizzle-orm` + `drizzle-kit` (sqlite/D1), `@sveltejs/adapter-cloudflare`, `wrangler`.

Added for v1:

| Package                                              | Job                                                                                                           |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| EmbedPDF (`v2` branch)                               | PDF viewer: render, zoom, search, page jump                                                                   |
| `shadcn-svelte`                                      | UI components only, copy-paste as needed                                                                      |
| Phosphor icons (Svelte port, e.g. `phosphor-svelte`) | Icons. Replaces the earlier `lucide-svelte` pick to satisfy the minimalist-ui ban on Lucide/Feather/Heroicons |
| `Superforms` + `zod`                                 | Login form and upload validation only                                                                         |
| `svelte-sonner`                                      | Toasts for upload / delete feedback                                                                           |
| `@aws-sdk/client-s3` (+ presigner)                   | Presigned PUT URLs for direct browser-to-R2 upload                                                            |

Skipped in v1: table libs (plain `each` is enough), state libs (Svelte 5 runes cover it), query libs, drag-and-drop libs, charts, calendars, maps, test runners. Add only on evidence: 100+ files needing sort/filter, repeated upload breakage, or a device-specific viewer failure.

## 4. Data flow

Schema — one table, no auth tables:

```sql
pdf_files (
  slug       TEXT PRIMARY KEY,   -- 8-char random, also the public path
  r2_key     TEXT NOT NULL,      -- pdfs/[slug].pdf
  file_name  TEXT NOT NULL,      -- original name for display/download
  size_bytes INTEGER NOT NULL,
  created_at INTEGER NOT NULL    -- unix ms
)
```

Login: POST password to `/api/login`. Server compares against `ADMIN_PASSWORD` using a timing-safe compare. On success sets an httpOnly, Secure, SameSite=Lax session cookie signed with `SESSION_SECRET`. On failure returns a generic error (never which part was wrong).

Upload: admin picks a PDF. Server generates the slug, returns a presigned PUT (5-minute expiry) for `pdfs/[slug].pdf`. The browser PUTs bytes straight to R2. On success the browser calls `POST /api/files` and the server writes the D1 row. The link is `/v/[slug]`.

View: `GET /v/[slug]` looks up the slug in D1. Miss renders a plain 404. Hit streams the R2 object with HTTP range support so page jumps stay fast, rendered by EmbedPDF V2.

Delete: admin deletes from `/admin`. Server deletes the R2 object first, then the D1 row, so no orphan files remain.

No upload size cap in app code. The only ceiling is the platform single-PUT limit. The only file validation is: it must be a PDF.

## 5. UI design (minimalist-ui rules)

Warm monochrome editorial style. No gradients, no heavy shadows, no emojis, no pill containers, no placeholder names, no AI-cliche copy.

- Canvas `#FFFFFF` / `#F7F6F3`. Cards `#FFFFFF` with `1px solid #EAEAEA`, radius 8-12px, padding 24-40px.
- Body text charcoal `#111111`-`#2F3437`, line-height 1.6. Secondary `#787774`. Never pure black.
- Type: sans stack for UI (`SF Pro Display`, `Geist Sans`, `Helvetica Neue`, system fallback). Serif stack for hero headings only. Mono stack for slugs, sizes, dates.
- Primary button: solid `#111111`, white text, radius 4-6px, no shadow, hover `#333333` or `scale(0.98)`.
- Status via muted pastel badges only (pale red/blue/green/yellow with dark text).
- Content width `max-w-5xl`. Section spacing `py-24`+.
- Motion: fade + `translateY(12px)` over 600ms on scroll entry, staggered 80ms in lists. Transform/opacity only.
- Pages: landing (name, one line, admin entry), admin (login card, upload card, file list with copy-link + delete), viewer (EmbedPDF V2 chrome, file name, minimal toolbar).

## 6. Error handling

- Unknown slug: plain 404. Same response whether the slug never existed or was deleted.
- Non-PDF upload: rejected server-side before any D1 write.
- Expired presigned URL or failed R2 PUT: no metadata written; user retries.
- `/admin` or `/api/*` without a valid session: redirect to login (pages) or 401 (API).
- R2/D1 failures: generic 500 to the client, details in server logs only. Never leak SDK messages.

## 7. Testing (no new test libs)

From awesome-svelte the Test section offers only legacy Jest-era runners (`svelte-jester`, `jest-transform-svelte`, `@testing-library/svelte`). None fits this app, and the minimal scaffold ships no runner. So v1 stays manual plus existing checks:

1. Login, upload, open the link logged-out, delete. All pass.
2. Random slug opens a 404.
3. A large PDF on a phone still jumps pages and zooms fast (range requests).
4. `npm run check` and `npm run lint` pass.

Add `vitest` (slug/session units) or one e2e upload-view flow only if uploads break repeatedly or the viewer fails on a specific device.

## 8. Deploy and env

- Target: Cloudflare Workers + Static Assets. `npm run build`, then `npx wrangler deploy`. Git integration optional with build `npm run build`, output `.svelte-kit/cloudflare`. `nodejs_als` compatibility flag required.
- `wrangler.jsonc` bindings: D1 `sheaf-db` as `DB`, R2 `sheaf-pdfs` as `PDFS`, `ASSETS` for static output.
- Secrets (Cloudflare dashboard, never in repo): `ADMIN_PASSWORD`, `SESSION_SECRET`.
- Local-only `.env` (never committed): dev values for the two secrets above.
- Migration-only vars (local shell, never runtime): `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_DATABASE_ID`, `CLOUDFLARE_D1_TOKEN`.
- First-time order: create D1 + R2, set bindings, set the two secrets, run the `pdf_files` migration, deploy, run the section 7 checklist.

Out of scope for v1: custom titles, per-link passwords, link expiry, view counts, multi-user, custom domain, CDN tuning, analytics. Each gets added only on a real request, never speculatively.
