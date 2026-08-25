# Verify and publish the dataset

This guide starts with a completed NeonHades2 dataset and produces the sanitized publication artifact used by the website.
The workflow adds automated verification, manual observation evidence, deterministic reproduction, editorial validation, and a public-field allowlist.

Follow [Acquire the complete dataset](/project/data/ACQUIRE-DATA.md) first.
You need the completed source snapshot, all five completed domain acquisitions, and the completed combined dataset from that tutorial.

## Restore the PowerShell paths

Start in `project/data` and restore the helper from the acquisition tutorial.

```powershell
$repo = (Resolve-Path 'C:\path\to\NeonHades2').Path
$dataRoot = Join-Path $repo 'project\data'
Set-Location $dataRoot

function Get-LatestCompletedDirectory {
	param([Parameter(Mandatory)][string]$Root)

	$directory = Get-ChildItem -LiteralPath $Root -Directory |
		Where-Object { Test-Path -LiteralPath (Join-Path $_.FullName 'complete.json') } |
		Sort-Object LastWriteTimeUtc -Descending |
		Select-Object -First 1

	if ($null -eq $directory) {
		throw "No completed artifact exists under $Root"
	}

	return $directory.FullName
}

$sourceAcquisition = Get-LatestCompletedDirectory (Join-Path $dataRoot '.local\acquisitions')
$boons = Get-LatestCompletedDirectory (Join-Path $dataRoot '.local\boons')
$weapons = Get-LatestCompletedDirectory (Join-Path $dataRoot '.local\weapons')
$arcana = Get-LatestCompletedDirectory (Join-Path $dataRoot '.local\arcana')
$loadouts = Get-LatestCompletedDirectory (Join-Path $dataRoot '.local\loadouts')
$guide = Get-LatestCompletedDirectory (Join-Path $dataRoot '.local\guide')
$dataset = Get-LatestCompletedDirectory (Join-Path $dataRoot '.local\datasets')
```

Review the printed paths before continuing.
All inputs must come from the same acquisition session and game build.
The builders verify that identity again and reject a mismatch.

## 1. Create the automated verification plan

Run the verification builder without a manual ledger.

```powershell
pnpm verification:build -- --dataset $dataset --source-acquisition $sourceAcquisition
$verification = Get-LatestCompletedDirectory (Join-Path $dataRoot '.local\verification')
```

The verifier recalculates exported numeric values and resolves the named-requirement graph.
Its `observation-plan.json` lists every check that still needs direct observation or spoiler review.

An initial verification artifact can be complete as a file set while still reporting pending manual tasks.
The later data-ready gate requires every planned task to pass.

## 2. Record passive observations

Generate the observer config for the selected dataset.

```powershell
pnpm observer:config -- --dataset $dataset
```

In r2modman, open the same Hades II profile folder used for acquisition and set `$profile` to that absolute path.

```powershell
$profile = (Resolve-Path 'C:\path\to\your\r2modman\HadesII\profiles\Default').Path
$observerSource = Join-Path $dataRoot 'mod\neodes2-observer'
$observerDestination = Join-Path $profile 'ReturnOfModding\plugins\NeonHades2-Observer'
New-Item -ItemType Directory -Path $observerDestination -Force | Out-Null
Copy-Item -Path (Join-Path $observerSource '*') -Destination $observerDestination -Recurse -Force
Copy-Item -LiteralPath (Join-Path $dataRoot '.local\observer\config.lua') -Destination (Join-Path $observerDestination 'config.lua') -Force
```

Start the game with **Start modded** and load the dedicated test save.
Perform only the actions assigned by `observation-plan.json`.
The observer records room, equipment, trait, health, Magick, weapon, projectile, hit, effect, and control identifiers without changing save state.

Each game load creates a trace under:

```text
<profile>\ReturnOfModding\plugins_data\NeonHades2-Observer\runs\<run-id>\trace.ndjson
```

Close the game before importing a trace.

```powershell
$trace = (Resolve-Path 'C:\absolute\profile\path\ReturnOfModding\plugins_data\NeonHades2-Observer\runs\run-id\trace.ndjson').Path
pnpm observation:import -- --dataset $dataset --trace $trace
```

Import each trace separately when a game restart splits one observation task across several traces.
The importer writes a normalized candidate report under `.local/observations/`.
A candidate report points to relevant events but does not mark a check as passed.

## 3. Prepare controlled aspect checks when required

Some aspect checks need a known weapon and aspect state.
Use the training harness only on a dedicated test save that you have backed up.
Never use it on a primary save.
The pipeline does not assign a fixed slot number. Choose an unused or explicitly replaceable slot, record that operational choice outside the dataset, and verify its backup before arming the harness.

Prepare the dataset-bound session.

```powershell
pnpm aspect-session:prepare -- --dataset $dataset
$training = Get-LatestCompletedDirectory (Join-Path $dataRoot '.local\training')
```

The command writes a plan, `config.lua`, 24 aspect commands, a restore command, and hash manifests under `.local/training/`.
Copy the harness and generated config into the active profile.

```powershell
$harnessSource = Join-Path $dataRoot 'mod\neodes2-training-harness'
$harnessDestination = Join-Path $profile 'ReturnOfModding\plugins\NeonHades2-TrainingHarness'
New-Item -ItemType Directory -Path $harnessDestination -Force | Out-Null
Copy-Item -Path (Join-Path $harnessSource '*') -Destination $harnessDestination -Recurse -Force
Copy-Item -LiteralPath (Join-Path $training 'config.lua') -Destination (Join-Path $harnessDestination 'config.lua') -Force
```

Create the harness data directory and copy one generated command into it as `command.txt`.

```powershell
$harnessData = Join-Path $profile 'ReturnOfModding\plugins_data\NeonHades2-TrainingHarness'
New-Item -ItemType Directory -Path $harnessData -Force | Out-Null
$firstCommand = Get-ChildItem -LiteralPath (Join-Path $training 'commands\aspects') -Filter '*.txt' | Sort-Object Name | Select-Object -First 1
Copy-Item -LiteralPath $firstCommand.FullName -Destination (Join-Path $harnessData 'command.txt') -Force
```

Start the game with the backed-up test save.

Each load writes a new `ready.txt` with a runtime nonce while the harness remains disarmed.
Confirm the active test profile in `ReturnOfModding\LogOutput.log`.
Then create `arm.txt` beside `ready.txt` with the nonce and dataset acquisition identifier shown in `ready.txt`.

```text
schema=neodes2-training-arm-1
session_nonce=value-from-ready.txt
dataset_acquisition_id=value-from-ready.txt
end=neodes2-training-arm-1
```

The harness ignores stale arm files.
It writes the command outcome to `result.txt` beside the other control files.
After `result.txt` reports `status=ok`, perform the matching observation-plan actions while the passive observer records them.
If `result.txt` reports `status=error`, stop the session and restore the test-save backup.

Copy the next generated command to the same `command.txt` path only after the previous `result.txt` reports `status=ok`.
Copy `commands\restore-original.txt` to that path before the final session ends.
Close the game before importing the traces.
Remove the observer and training harness from the profile when verification is complete.

## 4. Create the manual evidence ledger

Store the ledger and its evidence files together under an ignored `.local` directory.
Use the schema `neodes2-manual-evidence-1`.

The ledger has this shape:

```json
{
  "schema": "neodes2-manual-evidence-1",
  "sourceDatasetAcquisitionId": "dataset acquisition ID",
  "entries": [
    {
      "id": "unique evidence entry ID",
      "taskId": "task ID from observation-plan.json",
      "check": "check ID from observation-plan.json",
      "outcome": "pass",
      "targetIds": ["exact target IDs from observation-plan.json"],
      "evidence": [
        {
          "path": "relative-evidence-file.json",
          "sha256": "lowercase SHA-256"
        }
      ],
      "note": "What was observed and why it proves the check."
    }
  ]
}
```

Each entry covers one task and one check.
Use the exact target identifiers from `observation-plan.json`.
Reference every evidence file needed for that entry with a path relative to the ledger directory and its lowercase SHA-256 hash.

The verifier rejects unknown tasks, unknown checks, unknown targets, duplicate target coverage, paths outside the ledger directory, symbolic links, empty files, changed hashes, and evidence from another dataset.

Run the verifier again with the completed ledger.

```powershell
$manualEvidence = (Resolve-Path (Join-Path $dataRoot '.local\manual-verification\ledger.json')).Path
pnpm verification:build -- --dataset $dataset --source-acquisition $sourceAcquisition --manual-evidence $manualEvidence
$verification = Get-LatestCompletedDirectory (Join-Path $dataRoot '.local\verification')
```

Do not continue until the verification report has no pending or failed task.

## 5. Reproduce the combined dataset

Build the same five domain acquisitions again into a separate output root.

```powershell
$reproductionRoot = Join-Path $dataRoot '.local\data-ready-reproduction'
pnpm dataset:build -- --boons $boons --weapons $weapons --arcana $arcana --loadouts $loadouts --guide $guide --output $reproductionRoot
$reproducedDataset = Get-LatestCompletedDirectory $reproductionRoot
```

The reproduced acquisition identifier, dataset hash, and manifest hash must match the original dataset.
The next command enforces that equality.

## 6. Pass the data-ready gate

Run the gate with the original dataset, the reproduced dataset, and the completed verification artifact.

```powershell
pnpm data-ready:build -- --dataset $dataset --reproduced-dataset $reproducedDataset --verification $verification
$dataReady = Get-LatestCompletedDirectory (Join-Path $dataRoot '.local\data-ready')
```

The gate re-reads every hash-bound input and requires all manual tasks to pass.
It writes `publication-allowlist.json`, which limits the next stage to public contract fields plus the structural `recordType` and `id` keys.

The allowlist excludes source paths, raw source text, raw runtime structures, private save state, evidence, and binary assets.

## 7. Build the editorial artifact

The repository owns the authored progression stages, recommendations, rankings, and page definitions under `/project/data/src/editorial/`.
Build that content against the selected dataset and data-ready artifact.

```powershell
pnpm editorial:build -- --dataset $dataset --data-ready $dataReady
$editorial = Get-LatestCompletedDirectory (Join-Path $dataRoot '.local\editorial')
```

The compiler validates every editorial reference and required coverage rule against the selected dataset.
It rejects incomplete progression stages, missing subject coverage, invalid recommendation context, duplicate records, orphan records, incomplete ranking sets, and references that do not exist in the game data.

## 8. Build the publication artifact

Project the verified facts and editorial content through the publication allowlist.

```powershell
pnpm publication:build -- --dataset $dataset --data-ready $dataReady --editorial $editorial
$publication = Get-LatestCompletedDirectory (Join-Path $dataRoot '.local\publication')
Get-ChildItem -LiteralPath $publication
```

The completed directory contains `publication.json`, `publication-report.json`, `manifest.json`, and `complete.json`.
The compiler rejects forbidden fields, mixed input identities, unresolved public references, duplicate records, empty pages, incomplete reverse relationships, and records without search terms.

The local publication artifact remains private.
Do not deploy or commit it.

## 9. Refresh the committed website snapshot

Move to `project/web`, install its dependencies, and select the completed publication artifact explicitly.

```powershell
$webRoot = Join-Path $repo 'project\web'
Set-Location $webRoot
pnpm install --frozen-lockfile
$env:NEONHADES2_PUBLICATION_PATH = $publication
pnpm refresh:publication
pnpm check
Remove-Item Env:NEONHADES2_PUBLICATION_PATH
```

The walkthrough resolves game-dependent wording from the publication artifact during the website build. Its guide adapter fails when a required record or public field is missing, and it rejects god-keepsake policy that discards an unused Rarify charge. Weapon reveal timing, gated Olympian availability, and story-incantation reveal requirements therefore update from the acquired game data instead of duplicated website prose.

No AI step is part of this path. The clone contains the authored route strategy. The installed exporter mod, completed local acquisition and verification artifacts, and the commands above rebuild the game-dependent facts, editorial artifact, publication artifact, website snapshot, and guide pages.

`pnpm refresh:publication` writes only the sanitized public snapshot to `/project/web/src/content/publication.json`.
`pnpm check` verifies formatting, lint rules, Astro diagnostics, static generation, the sitemap, social metadata, and the public output boundary.

Review the snapshot diff and the rendered website before committing it.
Never copy `.local/publication/` into the website or a deployment bundle.
