# NeonHades2 data tooling

This directory contains project-owned acquisition, normalization, and validation code for NeonHades2.
Game files and game-derived inputs or outputs belong under an ignored `.local` directory and must not be committed.

The acquisition contract maps every requirement in the product plan to an owning record field, source class, normalization rule, validation rule, publication status, spoiler level, and completion requirement.

The source snapshotter discovers the installed Hades II Steam build, verifies its versions, copies allowlisted Lua and SJSON files, hashes the evidence, and writes an immutable acquisition under `.local/acquisitions/`.
It does not launch or control the game.

The boon pipeline adds a project-owned runtime exporter under `/project/data/mod/neodes2-boon-exporter/`.
It reads only processed boon tables and the English localization files after a save loads.
It writes a hashed, finalized runtime report to the mod profile's own data directory.
Runtime sample version 2 separates processed trait values from static base-data values.
Weapon-dependent processed values are recorded as source variants selected by weapon name.
It records exact formulas and named inputs when player state affects a displayed value.
Element-scaled values use an explicit one-element context instead of the loaded save.
Official description references are checked against exported tooltip values and `TraitData` fields.
The importer validates that finalized report against a completed source snapshot, then writes deterministic normalized boons and machine-readable and human-readable coverage reports under `.local/boons/`.

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

## Prepare the boon exporter

Copy the exporter folder into the active ReturnOfModding profile and rename `config.example.lua` to `config.lua` in that installed copy.
Fill the config with the acquisition ID, source manifest hash, Steam build ID, executable version, and package version from one completed source snapshot.
Do not commit the installed config or any exporter output.

The exporter runs once after the user loads a save in a modded game session.
It does not alter saves or add gameplay content.
The game must be launched and controlled by the user.

## Import a runtime boon report

After the exporter creates `runtime-report.json` and its `complete.json` marker, run the importer with explicit absolute paths.

```powershell
pnpm runtime:import -- --report "C:\absolute\profile\path\runtime-report.json" --source-acquisition "C:\absolute\project\data\.local\acquisitions\completed-run"
```

The importer requires matching runtime manifest and completion markers.
It rejects mismatched hashes, build metadata, relationships, malformed values, and incomplete source snapshots.
It preserves failed runtime samples as coverage issues instead of treating them as verified facts.
