# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.1.0] - 2026-11-21

### Added

- Root 404/error page and a static fallback for fatal render errors.
- `MAINTENANCE` flag that returns HTML 503 pages with `Retry-After` and JSON 503 for API routes.

### Changed

- API errors now return JSON `{ status, message }` through a shared helper.

## [1.0.0] - 2026-11-20

### Added

- Password-protected admin for uploading, listing, copying links, and deleting PDFs.
- Optional OIDC login with issuer, client, redirect, and allowlist configuration.
- Public PDF viewer with page navigation, zoom presets, text selection, and downloads.
- PDF storage in R2 and file metadata in D1 through Drizzle ORM.
- Rate-limited password login and regression checks for auth, upload, and viewer flows.

### Changed

- PDF rendering uses EmbedPDF 3.3.0 through `@embedpdf/engine` and `@embedpdf/svelte`.

### Security

- CI rejects high-severity advisories except the documented zod advisory.
