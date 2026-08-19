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

The Arcana importer writes deterministic normalized Cards, ranks, automatic activation rules, the default layout, reveal adjacency, and Grasp progression under `.local/arcana/`.
It checks runtime identifiers, layout, and Grasp progression against a static source audit.
It does not read a player's unlocked Cards, active loadout, or save progress.

The loadout importer writes deterministic keepsakes, Familiars, Familiar upgrades, Hexes, Path of Stars talents, and incantations under `.local/loadouts/`.
It preserves player-dependent tooltip values as formulas with named inputs instead of reading the loaded save's build.

The guide importer writes routes, regions, rooms, encounters, enemies, resources, status effects, elemental traits, Oath conditions, Testaments, relationships, prophecies, narrative records, ending and postgame outros, achievements, and named requirements under `.local/guide/`.
It checks the exported achievement set against Steam's local Hades II achievement schema.

## Requirements

- Node.js 24 or newer
- pnpm 11 installed globally

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
Use its absolute directory in the source audits and exporter preflights.

```powershell
pnpm weapons:audit -- --source-acquisition "C:\absolute\project\data\.local\acquisitions\completed-run"
pnpm weapons:preflight -- --source-acquisition "C:\absolute\project\data\.local\acquisitions\completed-run"
pnpm arcana:audit -- --source-acquisition "C:\absolute\project\data\.local\acquisitions\completed-run"
pnpm arcana:preflight -- --source-acquisition "C:\absolute\project\data\.local\acquisitions\completed-run"
pnpm loadouts:audit -- --source-acquisition "C:\absolute\project\data\.local\acquisitions\completed-run"
pnpm loadouts:preflight -- --source-acquisition "C:\absolute\project\data\.local\acquisitions\completed-run"
pnpm guide:audit -- --source-acquisition "C:\absolute\project\data\.local\acquisitions\completed-run" --achievement-schema "C:\absolute\Steam\appcache\stats\UserGameStatsSchema_1145350.bin"
pnpm guide:preflight -- --source-acquisition "C:\absolute\project\data\.local\acquisitions\completed-run" --achievement-schema "C:\absolute\Steam\appcache\stats\UserGameStatsSchema_1145350.bin"
```

Every audit and preflight must report `Complete: true` before runtime collection.
Commands that write audit artifacts keep them under ignored `.local` directories.

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
The finalized Arcana report is `arcana/runtime-report.json`.
The finalized loadout report is `loadouts/runtime-report.json`.
The finalized guide report is `guide/runtime-report.json`.
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

## Import a runtime Arcana report

Pass the finalized Arcana report and the same completed source snapshot to the Arcana importer.

```powershell
pnpm arcana:import -- --report "C:\absolute\profile\path\runs\run-id\arcana\runtime-report.json" --source-acquisition "C:\absolute\project\data\.local\acquisitions\completed-run"
```

The command must report complete coverage.
The generated acquisition remains under `.local/arcana/` and must not be committed.

## Import a runtime loadout report

Pass the finalized loadout report and the same completed source snapshot to the loadout importer.

```powershell
pnpm loadouts:import -- --report "C:\absolute\profile\path\runs\run-id\loadouts\runtime-report.json" --source-acquisition "C:\absolute\project\data\.local\acquisitions\completed-run"
```

The command must report complete coverage.
The generated acquisition remains under `.local/loadouts/` and must not be committed.

## Import a runtime guide report

Pass the finalized guide report, the same completed source snapshot, and Steam's local Hades II achievement schema to the guide importer.

```powershell
pnpm guide:import -- --report "C:\absolute\profile\path\runs\run-id\guide\runtime-report.json" --source-acquisition "C:\absolute\project\data\.local\acquisitions\completed-run" --achievement-schema "C:\absolute\Steam\appcache\stats\UserGameStatsSchema_1145350.bin"
```

The Steam achievement schema is normally stored under the Steam client directory at `appcache/stats/UserGameStatsSchema_1145350.bin` after Steam has cached Hades II metadata.
The command must report complete coverage.
The generated acquisition remains under `.local/guide/` and must not be committed.

## Build the combined dataset

Pass one completed acquisition directory for each domain to the dataset builder.

```powershell
pnpm dataset:build -- --boons "C:\absolute\project\data\.local\boons\completed-run" --weapons "C:\absolute\project\data\.local\weapons\completed-run" --arcana "C:\absolute\project\data\.local\arcana\completed-run" --loadouts "C:\absolute\project\data\.local\loadouts\completed-run" --guide "C:\absolute\project\data\.local\guide\completed-run"
```

The builder verifies every domain manifest, completion marker, declared file hash, coverage report, source acquisition identifier, exporter version, and game build field.
It rejects mixed provenance, incomplete coverage, record-count drift, duplicate identifiers, missing required names, dangling resolvable references, invalid costs or ranges, unknown enums, and excluded dialogue presentation data.

Successful builds write `dataset.json`, `validation.json`, `manifest.json`, and `complete.json` under `.local/datasets/`.
The dataset and acquisition identities depend only on verified content and provenance.
Repeated builds from the same inputs produce the same identities.
The timestamp and random directory suffix are not part of either identity.

## Build automated verification evidence

Pass one completed combined dataset and its completed source acquisition to the verification builder.

```powershell
pnpm verification:build -- --dataset "C:\absolute\project\data\.local\datasets\completed-run" --source-acquisition "C:\absolute\project\data\.local\acquisitions\completed-run"
```

The verifier independently recalculates exported numeric values and resolves the named-requirement graph.
It rejects calculation or graph issues and writes a content-addressed artifact under `.local/verification/`.
The artifact includes `observation-plan.json`, which assigns every manual check to a focused session and an exact target set from the combined dataset.
Its `sourceDatasetAcquisitionId` is the exact combined dataset acquisition, not only the underlying source snapshot.

Phase 5 includes manual checks only for factual or derived fields that require direct observation or spoiler review.
It excludes editorial fields because Phase 7 validates authored guide records.
The processed runtime state supplies resolved bulk facts, and the source snapshot binds them to one game build.
Manual observation remains required for player controls and weapon behavior that the exported data cannot prove.
Sessions marked `profile2-mutation-permission-required` must not begin until the owner grants separate permission to change the dedicated test copy.

## Record passive game observations

The project-owned observer under `/project/data/mod/neodes2-observer/` records append-only combat event traces after a save loads.
It reads current room, equipment, trait, health, Magick, weapon, projectile, hit, effect, and control identifiers.
It does not select equipment, add or remove traits, spawn objects, change progression, or write save state.

Generate a config bound to one completed combined dataset.

```powershell
pnpm observer:config -- --dataset "C:\absolute\project\data\.local\datasets\completed-run"
```

The command writes `.local/observer/config.lua` and refuses to overwrite an existing config.
Copy `/project/data/mod/neodes2-observer/` into the active ReturnOfModding profile, then copy the generated `config.lua` into that installed mod folder.
Do not commit the installed config or observer output.

Launch Hades II with the same profile and load the dedicated test save.
Perform only the actions assigned by `observation-plan.json` and permitted by the save policy.
Each load creates `trace.ndjson` under `ReturnOfModding/plugins_data/NeonHades2-Observer/runs/`.
Each event is flushed and closed before play continues, so an interrupted game leaves the last complete line readable.

Close Hades II before importing a trace.

```powershell
pnpm observation:import -- --dataset "C:\absolute\project\data\.local\datasets\completed-run" --trace "C:\absolute\profile\path\plugins_data\NeonHades2-Observer\runs\run-id\trace.ndjson"
```

The importer rejects partial lines, noncontiguous sequences, unsupported fields, oversized input, non-finite values, and trace or dataset identity mismatches.
It writes the raw trace, a normalized candidate report, a manifest, and a completion marker under `.local/observations/`.
Candidate coverage points reviewers to relevant events but does not mark a manual check complete.
Review the observed behavior against the normalized records before adding a passing ledger entry.
If a game restart splits one observation task across several traces, import each trace separately.
Reference every report needed to cover the task in its ledger entry.

## Prepare controlled aspect observations

The project-owned training harness under `/project/data/mod/neodes2-training-harness/` applies one dataset-bound weapon and aspect command to a dedicated test save.
It does not call save, progression, quest, achievement, or map-transition functions.
It must never be used with a primary save.

Prepare the complete aspect command set from one combined dataset.

```powershell
pnpm aspect-session:prepare -- --dataset "C:\absolute\project\data\.local\datasets\completed-run"
```

The command writes a plan, a harness config, 24 aspect commands, a restore command, and hash manifests under `.local/training/`.
Copy `/project/data/mod/neodes2-training-harness/` into the active ReturnOfModding profile.
Copy the generated `config.lua` into that installed mod folder.
Copy one generated aspect command to `ReturnOfModding/plugins_data/NeonHades2-TrainingHarness/command.txt`.

Back up the dedicated test save before launching Hades II.
Each loaded save writes a new `ready.txt` with a runtime nonce while the harness remains disarmed.
Confirm from the new game log that the dedicated test profile is active.
Then create `arm.txt` beside `ready.txt` with the same nonce and dataset acquisition identifier.

```text
schema=neodes2-training-arm-1
session_nonce=value-from-ready.txt
dataset_acquisition_id=value-from-ready.txt
end=neodes2-training-arm-1
```

The harness ignores stale arm files from earlier loads.
After it reports that a command was applied, perform the action sequence in the generated plan while the passive observer records the trace.
Replace `command.txt` with the next generated command only after the previous result reports `status=ok`.
If a command reports `status=error`, stop the session and restore the test-save backup before retrying it.
Apply `commands/restore-original.txt` before closing the final session.
Close Hades II before importing traces and remove both deployed project mods afterward.

Manual evidence belongs beside its source files under an ignored `.local` directory.
Each ledger entry names one task and check, lists the covered target identifiers from `observation-plan.json`, records a pass or fail result, and references at least one nonempty evidence file by relative path and lowercase SHA-256 hash.
The ledger schema is `neodes2-manual-evidence-1` and its `sourceDatasetAcquisitionId` must match the observation plan.

Pass the completed ledger back to the verifier.

```powershell
pnpm verification:build -- --dataset "C:\absolute\project\data\.local\datasets\completed-run" --source-acquisition "C:\absolute\project\data\.local\acquisitions\completed-run" --manual-evidence "C:\absolute\project\data\.local\manual-verification\ledger.json"
```

The verifier rejects unknown tasks, checks, or targets, repeated target coverage, paths outside the ledger directory, symbolic-link evidence, empty evidence, changed hashes, and evidence from another dataset.
One task is complete only when passing entries cover every planned target for every required check.
Automated verification does not mark Phase 5 complete while any manual task remains pending.
