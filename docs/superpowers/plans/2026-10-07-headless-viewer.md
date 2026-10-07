# Headless Viewer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Ready-made `<PDFViewer>` on `/v/[slug]` with a minimal EmbedPDF v2 headless viewer (render + zoom + page nav + download).

**Architecture:** Keep the existing route and server load untouched. Rewrite only `src/routes/v/[slug]/+page.svelte` around `EmbedPDF` + four minimal plugins (document-manager, viewport, scroll, render), add one `ViewerToolbar.svelte` for Prev/Next and zoom buttons, and swap the npm dependency from `@embedpdf/svelte-pdf-viewer` to the headless v2 packages.

**Tech Stack:** SvelteKit 3, Svelte 5 (runes, snippets), TypeScript, EmbedPDF v2 `2.15.1` headless (`core`, `engines`, `plugin-document-manager`, `plugin-viewport`, `plugin-scroll`, `plugin-render`, `plugin-zoom`), scoped CSS only.

**Spec:** `docs/superpowers/specs/2026-10-07-sheaf-design.md`

## Global Constraints

- English for code, comments, UI copy, and docs; chat in Indonesian (spec header).
- EmbedPDF branch `v2` stable only (`2.15.1`). Never `main`/v3 (spec line 6 + upstream warning).
- Single-uploader design preserved: public `/v/[slug]` opens without login and never leaks the file list.
- Files live in R2, metadata in D1; nothing else stores state.
- Viewer stays fast on mobile: zoom, page jump, flick scroll, pinch zoom.
- Minimalist UI: canvas `#FFFFFF`, dividers `#EAEAEA`, charcoal text, no new UI libs, no Lucide/Feather/Heroicons.
- No new test libs (spec section 7): verification is manual + `npm run check` + `npm run lint`.
- `+page.server.ts` (slug lookup, `fileName` + `streamUrl`) is out of scope and must not change.

## Karpathy Assumptions (explicit)

1. `data.streamUrl` (`/v/[slug]/file`, range-capable) works as-is with the document-manager `url` source; no server change needed.
2. `usePdfiumEngine()` + conditional `<EmbedPDF>` render is SSR-safe when gated on `mounted` (existing page already lazy-loads for the same reason).
3. `Scroller` snippet param infers `PageLayout` (`pageIndex`, `width`, `height`) with no type import needed.
4. `scroll.state.currentPage` / `totalPages` display verbatim per docs; no off-by-one correction without evidence.
5. Tiling is deliberately skipped; add `@embedpdf/plugin-tiling` only if zoomed pages look visibly blurry (evidence required).

---

### Task 1: Add headless v2 dependencies (keep old viewer installed)

**Files:**
- Modify: `package.json`

**Interfaces:**
- Consumes: nothing (npm registry, EmbedPDF v2 `2.15.1`).
- Produces: installed packages ` @embedpdf/core`, `@embedpdf/engines`, `@embedpdf/plugin-document-manager`, `@embedpdf/plugin-viewport`, `@embedpdf/plugin-scroll`, `@embedpdf/plugin-render`, `@embedpdf/plugin-zoom` at `2.15.1`. Old `@embedpdf/svelte-pdf-viewer` stays until Task 5 so the current page keeps compiling.

- [ ] **Step 1: Install the headless packages**

Run:

```bash
npm install @embedpdf/core@2.15.1 @embedpdf/engines@2.15.1 @embedpdf/plugin-document-manager@2.15.1 @embedpdf/plugin-viewport@2.15.1 @embedpdf/plugin-scroll@2.15.1 @embedpdf/plugin-render@2.15.1 @embedpdf/plugin-zoom@2.15.1
```

- [ ] **Step 2: Verify installed versions**

Run:

```bash
npm ls @embedpdf/core @embedpdf/engines @embedpdf/plugin-document-manager @embedpdf/plugin-viewport @embedpdf/plugin-scroll @embedpdf/plugin-render @embedpdf/plugin-zoom
```

Expected: every listed package shows `2.15.1`. Old `@embedpdf/svelte-pdf-viewer` still present.

- [ ] **Step 3: Verify nothing broke yet**

Run:

```bash
npm run check
```

Expected: PASS (no source file touched, so the current viewer still compiles).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json && git commit -m "chore: add EmbedPDF v2 headless viewer dependencies"
```

---

### Task 2: Minimal headless shell (render + loading/error + download)

**Files:**
- Modify: `src/routes/v/[slug]/+page.svelte`

**Interfaces:**
- Consumes: `data.fileName`, `data.streamUrl` from `+page.server.ts`; packages from Task 1.
- Produces: working headless render pipeline (`pdfEngine` store, `plugins` array, `EmbedPDF > DocumentContent > Viewport > Scroller > RenderLayer`); `documentId`snippet scope consumed by Tasks 3-4.

- [ ] **Step 1: Rewrite `+page.svelte` with the minimal headless shell**

Replace the full file content with:

```svelte
<script lang="ts">
	import { onMount } from 'svelte';
	import type { PageProps } from './$types';
	import { usePdfiumEngine } from '@embedpdf/engines/svelte';
	import { EmbedPDF } from '@embedpdf/core/svelte';
	import { createPluginRegistration } from '@embedpdf/core';
	import { ViewportPluginPackage, Viewport } from '@embedpdf/plugin-viewport/svelte';
	import { Scroller, ScrollPluginPackage } from '@embedpdf/plugin-scroll/svelte';
	import {
		DocumentManagerPluginPackage,
		DocumentContent
	} from '@embedpdf/plugin-document-manager/svelte';
	import { RenderLayer, RenderPluginPackage } from '@embedpdf/plugin-render/svelte';

	let { data }: PageProps = $props();
	let mounted = $state(false);

	const pdfEngine = usePdfiumEngine();

	const plugins = [
		createPluginRegistration(DocumentManagerPluginPackage, {
			initialDocuments: [{ url: data.streamUrl }]
		}),
		createPluginRegistration(ViewportPluginPackage),
		createPluginRegistration(ScrollPluginPackage),
		createPluginRegistration(RenderPluginPackage)
	];

	onMount(() => {
		mounted = true;
	});
</script>

<svelte:head>
	<title>{data.fileName} — sheaf</title>
</svelte:head>

<div class="viewer">
	<header>
		<span class="name" title={data.fileName}>{data.fileName}</span>
		<a href={data.streamUrl} download={data.fileName}>Download</a>
	</header>
	<main>
		{#if !mounted || pdfEngine.isLoading || !pdfEngine.engine}
			<p class="loading">Loading…</p>
		{:else if pdfEngine.error}
			<p class="loading">Could not load the PDF engine.</p>
		{:else}
			<div class="pdf">
				<EmbedPDF engine={pdfEngine.engine} {plugins}>
					{#snippet children({ activeDocumentId })}
						{#if activeDocumentId}
							{@const documentId = activeDocumentId}
							<DocumentContent {documentId}>
								{#snippet children(documentContent)}
									{#if documentContent.isLoaded}
										{#snippet renderPage(page)}
											<div
												style:width={`${page.width}px`}
												style:height={`${page.height}px`}
												style:position="relative"
											>
												<RenderLayer {documentId} pageIndex={page.pageIndex} />
											</div>
										{/snippet}
										<Viewport
											{documentId}
											style="background-color: #ffffff; width: 100%; height: 100%;"
										>
											<Scroller {documentId} {renderPage} />
										</Viewport>
									{:else if documentContent.isError}
										<p class="loading">Could not open this PDF.</p>
									{:else}
										<p class="loading">Loading…</p>
									{/if}
								{/snippet}
							</DocumentContent>
						{/if}
					{/snippet}
				</EmbedPDF>
			</div>
		{/if}
	</main>
</div>

<style>
	.viewer {
		display: flex;
		flex-direction: column;
		height: 100vh;
		background: #ffffff;
		color: #1a1a1a;
	}
	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.6rem 1rem;
		border-bottom: 1px solid #eaeaea;
	}
	.name {
		font-family: monospace;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	a {
		color: #1a1a1a;
		flex-shrink: 0;
	}
	main {
		flex: 1;
		min-height: 0;
	}
	.pdf {
		height: 100%;
	}
	.loading {
		padding: 2rem;
		text-align: center;
	}
</style>
```

Notes (deliberate, not placeholders): no zoom plugin yet (Task 4); no tiling (see assumption 5); header + Download link preserved verbatim; existing colors and layout preserved.

- [ ] **Step 2: Run type check**

Run:

```bash
npm run check
```

Expected: PASS with no errors in `src/routes/v/[slug]/+page.svelte`.

- [ ] **Step 3: Run lint**

Run:

```bash
npm run lint
```

Expected: PASS (`prettier --check` + `eslint` clean for the touched file).

- [ ] **Step 4: Manual verify — document renders**

Run `npm run dev`, open a real `/v/[slug]` link (upload via `/admin` first if needed). Confirm: PDF pages render on scroll, header shows file name, Download link works, invalid slug still 404s. If the page area collapses to zero height, stop and fix `.pdf`/Viewport sizing before committing (do not proceed blind).

- [ ] **Step 5: Commit**

```bash
git add src/routes/v/[slug]/+page.svelte && git commit -m "feat: replace ready-made viewer with minimal headless PDF render"
```

---

### Task 3: Page navigation toolbar (Prev/Next + indicator)

**Files:**
- Create: `src/routes/v/[slug]/ViewerToolbar.svelte`
- Modify: `src/routes/v/[slug]/+page.svelte` (import + render toolbar above `Viewport`)

**Interfaces:**
- Consumes: `documentId: string` prop (from Task 2 `{@const documentId}` scope); `useScroll(() => documentId)` from `@embedpdf/plugin-scroll/svelte`.
- Produces: `<ViewerToolbar {documentId} />` component; extended in Task 4 with zoom controls (same prop, no signature change).

- [ ] **Step 1: Create `ViewerToolbar.svelte` with page nav only**

```svelte
<script lang="ts">
	import { useScroll } from '@embedpdf/plugin-scroll/svelte';

	let { documentId }: { documentId: string } = $props();
	const scroll = useScroll(() => documentId);
</script>

{#if scroll.provides}
	<div class="toolbar">
		<button onclick={() => scroll.provides?.scrollToPreviousPage()}>Prev</button>
		<span>Page {scroll.state.currentPage} of {scroll.state.totalPages}</span>
		<button onclick={() => scroll.provides?.scrollToNextPage()}>Next</button>
	</div>
{/if}

<style>
	.toolbar {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.4rem 1rem;
		border-bottom: 1px solid #eaeaea;
		background: #ffffff;
	}
	button {
		background: none;
		border: 1px solid #eaeaea;
		border-radius: 4px;
		padding: 0.25rem 0.6rem;
		cursor: pointer;
	}
	span {
		font-size: 0.85rem;
	}
</style>
```

- [ ] **Step 2: Wire the toolbar into `+page.svelte`**

Two edits in `src/routes/v/[slug]/+page.svelte`, nothing else:

1. Add to the import block:

```svelte
	import ViewerToolbar from './ViewerToolbar.svelte';
```

2. Inside the `{#if documentContent.isLoaded}` block, directly above `<Viewport`, insert:

```svelte
										<ViewerToolbar {documentId} />
```

- [ ] **Step 3: Run type check**

Run:

```bash
npm run check
```

Expected: PASS.

- [ ] **Step 4: Run lint**

Run:

```bash
npm run lint
```

Expected: PASS.

- [ ] **Step 5: Manual verify — page nav**

Open a multi-page PDF at `/v/[slug]`. Confirm: indicator shows `Page X of Y`, Prev/Next move pages, single-page PDF shows `Page 1 of 1` without errors.

- [ ] **Step 6: Commit**

```bash
git add src/routes/v/[slug]/ViewerToolbar.svelte src/routes/v/[slug]/+page.svelte && git commit -m "feat: add minimal page navigation toolbar to headless viewer"
```

---

### Task 4: Zoom controls + pinch/wheel gestures

**Files:**
- Modify: `src/routes/v/[slug]/+page.svelte` (register `ZoomPluginPackage`, wrap `Scroller` in `ZoomGestureWrapper`)
- Modify: `src/routes/v/[slug]/ViewerToolbar.svelte` (add zoom buttons + readout)

**Interfaces:**
- Consumes: `documentId` prop (unchanged); `useZoom(() => documentId)`, `ZoomMode.FitWidth` from `@embedpdf/plugin-zoom/svelte`.
- Produces: full 4-feature viewer (render + zoom + page nav + download). No new files.

- [ ] **Step 1: Register the zoom plugin and gesture wrapper in `+page.svelte`**

Three edits, nothing else:

1. Add to the import block:

```svelte
	import { ZoomGestureWrapper, ZoomPluginPackage } from '@embedpdf/plugin-zoom/svelte';
```

2. Append to the `plugins` array (after the render registration):

```ts
		createPluginRegistration(ZoomPluginPackage),
```

So the array reads:

```ts
	const plugins = [
		createPluginRegistration(DocumentManagerPluginPackage, {
			initialDocuments: [{ url: data.streamUrl }]
		}),
		createPluginRegistration(ViewportPluginPackage),
		createPluginRegistration(ScrollPluginPackage),
		createPluginRegistration(RenderPluginPackage),
		createPluginRegistration(ZoomPluginPackage)
	];
```

3. Wrap the scroller with gestures:

```svelte
										<Viewport
											{documentId}
											style="background-color: #ffffff; width: 100%; height: 100%;"
										>
											<ZoomGestureWrapper {documentId}>
												<Scroller {documentId} {renderPage} />
											</ZoomGestureWrapper>
										</Viewport>
```

- [ ] **Step 2: Add zoom controls to `ViewerToolbar.svelte`**

Replace the `<script>` block with:

```svelte
<script lang="ts">
	import { useScroll } from '@embedpdf/plugin-scroll/svelte';
	import { useZoom, ZoomMode } from '@embedpdf/plugin-zoom/svelte';

	let { documentId }: { documentId: string } = $props();
	const scroll = useScroll(() => documentId);
	const zoom = useZoom(() => documentId);
</script>
```

Replace the toolbar `<div>` content with:

```svelte
	<div class="toolbar">
		<button onclick={() => scroll.provides?.scrollToPreviousPage()}>Prev</button>
		<span>Page {scroll.state.currentPage} of {scroll.state.totalPages}</span>
		<button onclick={() => scroll.provides?.scrollToNextPage()}>Next</button>
		{#if zoom.provides}
			<button onclick={() => zoom.provides?.zoomOut()}>-</button>
			<span>{Math.round(zoom.state.currentZoomLevel * 100)}%</span>
			<button onclick={() => zoom.provides?.zoomIn()}>+</button>
			<button onclick={() => zoom.provides?.requestZoom(ZoomMode.FitWidth)}>Fit width</button>
		{/if}
	</div>
```

Wrap the whole `{#if scroll.provides}` as before (unchanged outer guard). No marquee zoom, no rotate, no extra modes (YAGNI).

- [ ] **Step 3: Run type check**

Run:

```bash
npm run check
```

Expected: PASS.

- [ ] **Step 4: Run lint**

Run:

```bash
npm run lint
```

Expected: PASS.

- [ ] **Step 5: Manual verify — zoom**

Open a PDF at `/v/[slug]`. Confirm: `-`/`+` change the `%` readout and visibly rescale, `Fit width` refills the viewport, Ctrl/Cmd+wheel zooms on desktop, pinch zooms on a phone without breaking vertical scroll. If `ZoomGestureWrapper` fights vertical scroll on mobile, set `enableWheel={false}` first (keep pinch), re-verify, and note it in the commit message.

- [ ] **Step 6: Commit**

```bash
git add src/routes/v/[slug]/+page.svelte src/routes/v/[slug]/ViewerToolbar.svelte && git commit -m "feat: add zoom controls and gestures to headless viewer"
```

---

### Task 5: Remove Ready-made viewer + final verification

**Files:**
- Modify: `package.json` (remove `@embedpdf/svelte-pdf-viewer`)

**Interfaces:**
- Consumes: completed Tasks 1-4 (no source file may import `@embedpdf/svelte-pdf-viewer` anymore).
- Produces: lean dependency set; final verified 4-feature viewer.

- [ ] **Step 1: Confirm no source references the old viewer**

Run:

```bash
grep -rn "svelte-pdf-viewer" src/ || true
```

Expected: no output (empty). If any line appears, stop and remove that reference before continuing.

- [ ] **Step 2: Remove the old package**

Run:

```bash
npm remove @embedpdf/svelte-pdf-viewer
```

- [ ] **Step 3: Final type check + lint**

Run:

```bash
npm run check && npm run lint
```

Expected: both PASS.

- [ ] **Step 4: Final manual pass (all four features + mobile)**

Open a real `/v/[slug]` link on desktop and on a narrow phone viewport. Confirm each: (1) pages render while scrolling, (2) `-`/`+`/`Fit width` + pinch work, (3) Prev/Next + `Page X of Y` work, (4) header Download works, (5) engine-failure and bad-document states show the plain messages from Task 2, (6) invalid slug still 404s.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json && git commit -m "chore: remove ready-made svelte-pdf-viewer after headless migration"
```

---

## Self-Review (run before execution)

- [x] Spec coverage: render/zoom/page-jump (spec: "viewer stays fast: zoom, search, page jump") — search deliberately dropped per user decision (minimal: render + zoom + page nav + download); single-uploader/D1/R2 untouched; minimalist UI kept; v2 pinned.
- [x] Placeholder scan: no TBD/TODO; every code step shows exact imports, props, and method names verified against installed `2.15.1` `.d.ts` files and find-docs v2 snippets.
- [x] Type consistency: `documentId: string` flows from `{@const documentId}` into `ViewerToolbar`, `useScroll`/`useZoom` getters (`() => string | null` accepts `() => string`), `renderPage(page)` uses inferred `PageLayout` fields (`width`, `height`, `pageIndex`), `ZoomMode.FitWidth` matches the v2 enum.
