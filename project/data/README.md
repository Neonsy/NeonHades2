# NeonHades2 data tooling

This directory contains project-owned acquisition, normalization, and validation code for NeonHades2.
Game files and game-derived inputs or outputs belong under an ignored `.local` directory and must not be committed.

The acquisition contract maps every requirement in the product plan to an owning record field, source class, normalization rule, validation rule, publication status, spoiler level, and completion requirement.

The source snapshotter discovers the installed Hades II Steam build, verifies its versions, copies allowlisted Lua and SJSON files, hashes the evidence, and writes an immutable acquisition under `.local/acquisitions/`.
It does not launch or control the game.

The runtime pipeline adds a project-owned exporter under `/project/data/mod/neodes2-boon-exporter/`.
It reads processed game tables and English localization files after a save loads.
It writes a hashed, finalized runtime report to the mod profile's own data directory.

The boon importer writes deterministic normalized boons and coverage reports under `.local/boons/`.
Runtime sample version 2 separates processed trait values from static base-data values.
Weapon-dependent processed values are recorded as source variants selected by weapon name.
It records exact formulas and named inputs when player state affects a displayed value.
Element-scaled values use an explicit one-element context instead of the loaded save.
Official description references are checked against exported tooltip values and `TraitData` fields.

The weapon importer writes deterministic normalized weapons, aspects, ranks, Daedalus Hammers, and coverage reports under `.local/weapons/`.
It checks the runtime identifiers against a static source audit and preserves linked engine weapon identifiers that have no standalone `WeaponData` record.

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

## Audit and prepare the runtime exporter

Create a completed source snapshot first.
Use its absolute directory in the weapon source audit and exporter preflight.

```powershell
pnpm weapons:audit -- --source-acquisition "C:\absolute\project\data\.local\acquisitions\completed-run"
pnpm weapons:preflight -- --source-acquisition "C:\absolute\project\data\.local\acquisitions\completed-run"
```

Both commands must report `Complete: true` before runtime collection.
Their outputs remain under ignored `.local` directories.

Copy the exporter folder into the active ReturnOfModding profile and rename `config.example.lua` to `config.lua` in that installed copy.
Fill the config with the acquisition ID, source manifest hash, Steam build ID, executable version, and package version from one completed source snapshot.
Do not commit the installed config or any exporter output.

Launch Hades II with the same ReturnOfModding profile and load any save.
Keep the game window focused until the exporter reports completion in `LogOutput.log`.

The exporter runs once after a save loads.
It does not alter saves or add gameplay content.
Its output does not depend on save unlock progress.

Each attempt creates a new run directory under `ReturnOfModding/plugins_data/NeonHades2-BoonExporter/runs/`.
The finalized boon report is `runtime-report.json` in that run directory.
The finalized weapon report is `weapons/runtime-report.json`.
Import only reports whose directory also contains matching `manifest.json` and `complete.json` files.

## Import a runtime boon report

After the exporter creates `runtime-report.json` and its `complete.json` marker, run the importer with explicit absolute paths.

```powershell
pnpm runtime:import -- --report "C:\absolute\profile\path\runtime-report.json" --source-acquisition "C:\absolute\project\data\.local\acquisitions\completed-run"
```

The importer requires matching runtime manifest and completion markers.
It rejects mismatched hashes, build metadata, relationships, malformed values, and incomplete source snapshots.
It preserves failed runtime samples as coverage issues instead of treating them as verified facts.

## Import a runtime weapon report

Pass the finalized weapon report and the same completed source snapshot to the weapon importer.

```powershell
pnpm weapons:import -- --report "C:\absolute\profile\path\runs\run-id\weapons\runtime-report.json" --source-acquisition "C:\absolute\project\data\.local\acquisitions\completed-run"
```

The command must report complete coverage.
The generated acquisition remains under `.local/weapons/` and must not be committed.
