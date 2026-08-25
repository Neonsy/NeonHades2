# NeonHades2 website

NeonHades2 is an English-only, static Hades II guide for new and experienced players.
The website has two reader paths.
The A-Z guide gives a milestone-based progression route from a fresh save.
The knowledge area provides search, reference records, contextual tier lists, aspect builds, unlock conditions, and relationships between game systems.

The site builds from a versioned public snapshot created by the project-owned data pipeline.
The artifact binds every published fact and recommendation to one Hades II Steam build.
Page footers display that build identifier so readers can see which game version the guide covers.

The repository contains the website, the acquisition and normalization tools, the authored guide content, and optimized public artwork. Raw game files, saves, exports, and normalized game-derived datasets remain outside version control. Artwork tooling uses OpenCV, VTracer, and Inkscape to prepare approved one-subject artwork from local game references for delivery as bounded WebP files.

## Refresh the public snapshot

You do not need Hades II or a local data artifact to install, develop, build, or preview the website.
The committed snapshot under `src/content/publication.json` contains the reader-facing records used by normal website commands.

Maintainers need a locally installed copy of Hades II only when refreshing factual data.
Follow the [data tooling guide](/project/data/README.md) to acquire, normalize, verify, and publish the local data.

The data pipeline writes completed publication artifacts under `project/data/.local/publication/`.
Run `pnpm refresh:publication` to replace the committed public snapshot with the newest completed artifact.
Set `NEONHADES2_PUBLICATION_PATH` to a completed publication directory or its `publication.json` file to select another artifact.

All `.local` directories are ignored at every repository level.
Keep game-derived inputs and outputs there.

## Run the website

The exact pnpm and Node.js development versions are declared in `package.json`.
Run these commands from `project/web`:

```powershell
pnpm install --frozen-lockfile
pnpm dev
```

Open `http://localhost:4321` unless Astro reports another local port.

Build and preview a production bundle locally without extra environment variables:

```powershell
pnpm build
pnpm preview
```

Run the complete website check before publishing a change:

```powershell
$env:PUBLIC_SITE_URL = 'https://hades2.guide.neonspace.dev'
pnpm check
```

The check verifies formatting, lint rules, Astro and TypeScript diagnostics, and the static production build.
`pnpm dev` and `pnpm build` consume committed generated assets. Run `pnpm verify:generated` to confirm that generated artwork, platform icons, and public asset metadata are current without rewriting them. Run `pnpm generate:art` or `pnpm generate:seo-images` only when intentionally refreshing those tracked outputs.
After building, `pnpm test:e2e` runs the focused browser suite with one worker and an isolated browser profile. Install Playwright Chromium first, or set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to a Chromium-compatible browser such as Helium. The suite does not select Edge or reuse your personal browser profile. Screenshot baselines are platform-specific; review changes before accepting new baselines.

The tested Helium installation closes the browser after its last isolated context closes. Run one test per invocation with `pnpm test:e2e --grep "test title"` on that installation; use Playwright Chromium for a batched suite. A browser-context failure is not evidence that the page failed.
Local builds default to `http://127.0.0.1:4321`.
Set `PUBLIC_SITE_URL` to the deployed HTTPS origin without a path before producing a bundle for publication.
It is the single source for canonical URLs, structured data, social metadata, and the generated sitemap.
Cloudflare owns the production `robots.txt` response, so the static bundle must not generate one.
Only the generated static output under `project/web/dist/` may be deployed.
Do not send the private publication input or any other `.local` content to a host.

## Search appearance

The production origin is `https://hades2.guide.neonspace.dev/`. Keep the origin in `PUBLIC_SITE_URL` so local and future deployments do not require template changes.

Every indexable page publishes a unique title and description, a canonical URL, Open Graph and Twitter metadata, structured WebPage data, and breadcrumb data when applicable. Astro generates the sitemap from the same route set. The build audit checks that these surfaces agree and that every canonical route is present in the sitemap.

Google Search receives a stable 192 by 192 PNG favicon at `/icon-192.png`, with the project SVG retained for capable browsers. The favicon is square, crawlable, referenced from every page, and also listed in the web app manifest.

## Styles and artwork

The visual direction is a Crossroads entrance with a readable codex inside. Cinzel is reserved for display headings; Bricolage carries the reading text. The large fluid type scale is intentional, including on 4K displays. Bone text, bronze rules, witchfire, and existing game artwork establish the setting without changing game facts or spoiler policy.

`src/styles/tokens.css` owns shared values. `src/styles/routes/` selects each page family's CSS; `src/styles/pages/home.css` owns the home composition, and the numbered `theatre-pages` files own the other families. `src/styles/components/subject-art.css` owns artwork containment. Keep page-specific fixes out of the base imports.

Keyboard focus uses a steady high-contrast outline, not a displaced target. Hover may brighten a control or move its directional arrow. Ambient particles and mist sit behind content; reduced motion removes loops and transitions without hiding information. The homepage shader is capped at approximately 0.92 million rendered pixels and 30 frames per second. Hidden tabs pause the atmosphere.

Components mount their own runtime: collection filtering, sorting, artwork fitting, and virtualization live under `src/scripts/collections/`; guide progress stays with the checklist; disclosure behavior is shared in `exclusive-details-runtime.ts`. `presentation.ts` remains the public export surface for reader text, value formatting, and record-family presentation.

Tailwind utilities handle generic layout and alignment when they make the markup clearer. Project CSS owns tokens, page-family compositions, cut-paper geometry, interaction states, and motion. This division avoids duplicating basic layout rules without flattening the authored design system.

Run `pnpm generate:codex-art` after the local Codex portrait extraction changes. The command rebuilds source-derived enemy and region artwork, registers accepted deliveries, refreshes the production artwork manifest, and updates public raster metadata. Missing game sources stay explicit in `scripts/artwork/codex-derived-subjects.json` instead of receiving invented replacement art.

The Krita workflow is retired, and its editable masters are no longer available. Existing master paths and route labels remain in artwork metadata as historical records, not evidence that those sources are available. Normal website builds use the committed artwork and verify the Crossroads WebP against its delivery hash and dimensions. Rebuilding the production artwork manifest still requires the local inventory, mapping, and source masters.

Run `pnpm optimize:raster-art` to resize registered character WebP deliveries whose longest edge exceeds 1600 pixels. Selection uses the public delivery path, not a master file or authoring tool.

## Generate god symbols

`pnpm generate:god-symbols` needs the ignored files created by the local artwork extraction. Copy the installed game's `GUI` package to `project/web/.local/reference/game-assets/GUI` without changing its package layout. The extraction supplies the symbol inputs at `GUI/textures/GUI/Screens/BoonSelectSymbols/<God>.png` and the shared icon at `GUI/textures/GUI/Icons/Boon.png`.

From `project/web`, run:

```powershell
pnpm generate:god-symbols
```

The command writes the tracked god-symbol WebP deliveries, `scripts/artwork/god-symbols.json`, and `src/content/public-asset-metadata.json`. Do not commit `.local/reference/game-assets/`.

NeonHades2 is an independent passion project.
It is not affiliated with Supergiant Games.
