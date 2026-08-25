# NeonHades2 data tooling

This directory contains the acquisition, normalization, validation, verification, and publication code used by NeonHades2.
It lets a game owner create the complete guide dataset from an installed Steam copy of _Hades II_ without relying on another person's game files or exports.

## Pick the result you need

Follow [Acquire the complete dataset](/project/data/ACQUIRE-DATA.md) to produce `dataset.json` from your own game installation.
That tutorial covers the source snapshot, the complete raw runtime archive, the private evidence archive, all five normalized domain acquisitions, and the combined dataset.

Follow [Verify and publish the dataset](/project/data/VERIFY-AND-PUBLISH.md) when you also need independent checks, manual observation evidence, editorial validation, a publication artifact, or a refreshed website snapshot.

## Understand the data levels

| Result                | What it contains                                                               | Default location                                                                             |
| --------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| Source snapshot       | Every Lua and SJSON game definition plus version and hash evidence             | `.local/acquisitions/`                                                                       |
| Runtime staging run   | Temporary processed game tables and English localization after a save loads    | The active ReturnOfModding profile                                                           |
| Raw runtime archive   | Unchanged, hash-listed copy of every finalized mod output                       | `.local/runtime-exports/`                                                                    |
| Evidence archive      | One shared graph for processed static tables, with unsupported values recorded | `.local/evidence/`                                                                           |
| Domain acquisition    | Verified and normalized data for one subject group                             | `.local/boons/`, `.local/weapons/`, `.local/arcana/`, `.local/loadouts/`, or `.local/guide/` |
| Combined dataset      | The complete normalized NeonHades2 data contract                               | `.local/datasets/`                                                                           |
| Verification artifact | Automated results, the manual observation plan, and accepted manual evidence   | `.local/verification/`                                                                       |
| Data-ready artifact   | Reproduction proof and the publication allowlist                               | `.local/data-ready/`                                                                         |
| Editorial artifact    | Authored recommendations and progression content bound to one dataset          | `.local/editorial/`                                                                          |
| Publication artifact  | Sanitized public records, pages, search terms, relationships, and conditions   | `.local/publication/`                                                                        |
| Website snapshot      | The committed public input used by normal website builds                       | `/project/web/src/content/publication.json`                                                  |

Every completed local artifact directory contains `manifest.json` and `complete.json`.
Commands reject missing markers, changed hashes, mixed game builds, and incompatible inputs.
Failed attempts remain local with failure information and never become completed inputs.

## Requirements

The complete acquisition requires:

- Windows.
- The current Steam version of _Hades II_ installed locally.
- Node.js 24 or newer.
- pnpm 11.
- [r2modman](https://thunderstore.io/package/ebkr/r2modman/) with a Hades II profile.
- The current Hell2Modding dependencies listed in `/project/data/mod/neodes2-boon-exporter/manifest.json`.

The source snapshotter uses the Windows executable metadata API and Steam's app manifest.
The current acquisition does not support the Epic Games edition or another operating system.

## Protect the game and the repository

The source snapshotter only reads Lua, SJSON, version, and executable metadata from the installation and writes to `.local/acquisitions/`.
The runtime exporter reads processed game tables and localization after a save loads.
It does not change the loaded save or add gameplay content.
The evidence exporter refuses player-state and runtime-cache roots such as `GameState`, `CurrentRun`, `PrevRun`, `SessionState`, active screens, and the hero object.
It also excludes Lua, ReturnOfModding, and ModUtil runtime namespaces; those are tooling internals rather than game definitions.
Shared node identities are retained across table files, so aliased game data is serialized once rather than repeatedly.
Functions, userdata, metatables, and unsupported keys are counted as explicit omissions because their defining Lua source is already present in the source snapshot.

The passive observer does not change save state.
The training harness does change the equipped test loadout.
Use the training harness only with a backed-up test save.

All `.local` directories are ignored.
Keep exporter reports, normalized datasets, manual evidence, installed mod configs, and save backups outside Git.

## Validate the tooling

Run these commands from `project/data`:

```powershell
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm contract:check
pnpm build
```

`pnpm contract:check` fails when a required product field lacks an owner, evidence class, normalization rule, validation rule, publication class, spoiler level, or completion rule.

## Look up a command

Most commands expose their accepted options through `--help`.

```powershell
pnpm snapshot -- --help
pnpm runtime-export:import -- --help
pnpm evidence:import -- --help
pnpm dataset:build -- --help
pnpm verification:build -- --help
pnpm publication:build -- --help
```

The command names follow the artifact order:

1. `snapshot`
2. `weapons:audit`, `arcana:audit`, `loadouts:audit`, and `guide:audit`
3. `evidence:preflight`, `weapons:preflight`, `arcana:preflight`, `loadouts:preflight`, and `guide:preflight`
4. `runtime-export:import`
5. `evidence:import`
6. `runtime:import`, `weapons:import`, `arcana:import`, `loadouts:import`, and `guide:import`
7. `dataset:build`
8. `verification:build`
9. `data-ready:build`
10. `editorial:build`
11. `publication:build`

Do not skip a failed command.
Later stages require the exact completed artifacts produced by earlier stages.
