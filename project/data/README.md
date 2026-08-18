# NeonHades2 data tooling

This directory contains project-owned acquisition, normalization, and validation code for NeonHades2.
Game files and game-derived inputs or outputs belong under an ignored `.local` directory and must not be committed.

The acquisition contract maps every requirement in the product plan to an owning record field, source class, normalization rule, validation rule, publication status, spoiler level, and completion requirement.

The source snapshotter discovers the installed Hades II Steam build, verifies its versions, copies allowlisted Lua and SJSON files, hashes the evidence, and writes an immutable acquisition under `.local/acquisitions/`.
It does not launch or control the game.

## Requirements

- Node.js 24 or newer
- pnpm 11

## Validate the contract

Run these commands from this directory.

```powershell
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm contract:check
pnpm build
```

The contract check prints the complete product-to-field coverage report.
It exits with a failure when a requirement is uncovered or a field lacks its required ownership, evidence, normalization, validation, publication, spoiler, or completion metadata.

## Create a source snapshot

Close Hades II and allow Steam to finish any pending update before running the snapshotter.

```powershell
pnpm snapshot
```

Steam discovery reads the local Steam registry and `libraryfolders.vdf`.
If more than one Hades II installation is found, select one app manifest explicitly.

```powershell
pnpm snapshot -- --manifest "C:\path\to\your\SteamLibrary\steamapps\appmanifest_1145350.acf"
```

The command writes only inside `.local/acquisitions/` by default.
Each successful run has a deterministic `manifest.json` and a `complete.json` marker.
Failed and earlier runs are retained rather than overwritten or deleted.
