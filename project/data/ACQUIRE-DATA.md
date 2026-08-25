# Acquire the complete dataset

This tutorial creates the complete normalized NeonHades2 dataset from a fresh clone and an installed Steam copy of _Hades II_.
The final result is a completed directory under `project/data/.local/datasets/` that contains `dataset.json`, `validation.json`, `manifest.json`, and `complete.json`.

This tutorial does not create the independently verified publication used by the website.
After the dataset build succeeds, continue with [Verify and publish the dataset](/project/data/VERIFY-AND-PUBLISH.md) if you need that result.

## Before you start

Use a Windows account that can read your Steam library and your r2modman profile.
Close _Hades II_ and let Steam finish pending updates before the source snapshot.

Install these tools:

- Git.
- Node.js 24 or newer.
- pnpm 11.
- [r2modman](https://thunderstore.io/package/ebkr/r2modman/).

Use the [official Hades II modding setup](https://github.com/SGG-Modding/Hades2ModWiki/blob/main/docs/installing-mods/getting-started.md) to create an r2modman Hades II profile.
Install the current packages named by the `dependencies` array in `/project/data/mod/neodes2-boon-exporter/manifest.json`.
The local exporter is not a Thunderstore package, so r2modman does not install those dependencies for you.

## 1. Clone and validate the repository

Clone the repository, set `$repo` to its absolute path, and install the data dependencies.

```powershell
git clone https://github.com/Neonsy/NeonHades2.git
$repo = (Resolve-Path 'C:\path\to\NeonHades2').Path
$dataRoot = Join-Path $repo 'project\data'
Set-Location $dataRoot
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm contract:check
```

All four commands must exit successfully.
The contract check prints the product-field coverage report.

Add this helper to the same PowerShell session.
It selects the newest directory that has a completion marker.

```powershell
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
```

## 2. Create the source snapshot

Run the snapshotter while the game is closed.

```powershell
pnpm snapshot
$sourceAcquisition = Get-LatestCompletedDirectory (Join-Path $dataRoot '.local\acquisitions')
$sourceAcquisition
```

The command discovers Steam through the Windows registry and `libraryfolders.vdf`.
It prints an acquisition identifier, a source count, and the completed directory.

If the command finds more than one Hades II installation, pass the intended Steam app manifest.

```powershell
pnpm snapshot -- --manifest 'C:\path\to\your\SteamLibrary\steamapps\appmanifest_1145350.acf'
```

Use `--steam-root` when Steam itself is installed in a location that discovery cannot find.

```powershell
pnpm snapshot -- --steam-root 'C:\path\to\your\Steam'
```

Do not edit the completed snapshot.
The runtime exporter and every importer bind their output to its acquisition identifier and manifest hash.

## 3. Locate Steam's achievement schema

The guide audit and guide importer need Steam's local Hades II achievement schema.
Steam normally stores the file under its client directory after it has cached the game's metadata.

Set `$achievementSchema` to the real file on your computer.

```powershell
$achievementSchema = (Resolve-Path 'C:\path\to\your\Steam\appcache\stats\UserGameStatsSchema_1145350.bin').Path
```

If Steam is installed elsewhere, replace the Steam directory in that command.
Stop here if the file does not exist.
Open Steam while online, view _Hades II_ in the library, and check the path again after Steam has cached its metadata.

## 4. Audit the static evidence

Run every source audit against the same completed snapshot.

```powershell
pnpm weapons:audit -- --source-acquisition $sourceAcquisition
pnpm arcana:audit -- --source-acquisition $sourceAcquisition
pnpm loadouts:audit -- --source-acquisition $sourceAcquisition
pnpm guide:audit -- --source-acquisition $sourceAcquisition --achievement-schema $achievementSchema
```

Each audit checks the static source structure for its domain.
The commands write their reports under ignored `.local` directories.
Fix any reported issue before continuing.

## 5. Run every exporter preflight

Run the preflights against the same source snapshot and repository exporter.

```powershell
pnpm weapons:preflight -- --source-acquisition $sourceAcquisition
pnpm arcana:preflight -- --source-acquisition $sourceAcquisition
pnpm loadouts:preflight -- --source-acquisition $sourceAcquisition
pnpm guide:preflight -- --source-acquisition $sourceAcquisition --achievement-schema $achievementSchema
pnpm evidence:preflight
```

Every preflight must print `Complete: true`.
Do not launch the exporter when a preflight is incomplete.

## 6. Install the exporter in the active profile

In r2modman, select the Hades II profile that you will use.
Open **Settings**, choose **Locations**, and use **Browse profile folder**.
Copy that absolute folder path into `$profile`.

```powershell
$profile = (Resolve-Path 'C:\path\to\your\r2modman\HadesII\profiles\Default').Path
$plugins = Join-Path $profile 'ReturnOfModding\plugins'
$installedExporter = Join-Path $plugins 'NeonHades2-BoonExporter'
New-Item -ItemType Directory -Path $installedExporter -Force | Out-Null
Copy-Item -Path (Join-Path $dataRoot 'mod\neodes2-boon-exporter\*') -Destination $installedExporter -Recurse -Force
```

Create `config.lua` from the completed source snapshot.
The completion marker already contains the lowercase hash expected by the importer.

```powershell
$sourceManifest = Get-Content -LiteralPath (Join-Path $sourceAcquisition 'manifest.json') -Raw | ConvertFrom-Json
$sourceCompletion = Get-Content -LiteralPath (Join-Path $sourceAcquisition 'complete.json') -Raw | ConvertFrom-Json
$configPath = Join-Path $installedExporter 'config.lua'

$config = @"
return {
	schema = "neodes2-boon-export-config-1",
	acquisition_id = "$($sourceManifest.acquisitionId)",
	source_manifest_sha256 = "$($sourceCompletion.manifestSha256)",
	steam_build_id = "$($sourceManifest.game.steamBuildId)",
	executable_version = "$($sourceManifest.game.executableVersion)",
	package_version = "$($sourceManifest.game.packageVersion)",
}
"@

[System.IO.File]::WriteAllText($configPath, $config, (New-Object System.Text.UTF8Encoding($false)))
```

Confirm that the installed directory contains `manifest.json`, `main.lua`, `evidence.lua`, `weapons.lua`, `arcana.lua`, `loadouts.lua`, `guide.lua`, and `config.lua`.

```powershell
Get-ChildItem -LiteralPath $installedExporter
```

## 7. Run the exporter

Start the game with **Start modded** in r2modman.
Use the same Steam build that produced the source snapshot.
If Steam updated the game after Step 2, close the game and restart the tutorial with a new snapshot.

Load any save and keep the game focused until the exporter finishes.
The exporter reads processed tables after the save loads, but the result does not depend on that save's unlock progress.

The Hell2Modding console reports each stage directly. During the private archive it prints the table name, `current/total` count, cumulative output size, and elapsed time.
You can also watch the same progress from another PowerShell window.

```powershell
Get-Content -LiteralPath (Join-Path $profile 'ReturnOfModding\LogOutput.log') -Wait
```

Press `Ctrl+C` after the exporter reports completion.

The exporter creates one run under:

```text
<profile>\ReturnOfModding\plugins_data\NeonHades2-BoonExporter\runs\<run-id>\
```

Wait for the run directory to contain `manifest.json` and `complete.json`.
It must also contain these five reports:

```text
runtime-report.json
weapons\runtime-report.json
arcana\runtime-report.json
loadouts\runtime-report.json
guide\runtime-report.json
evidence\manifest.json
evidence\complete.json
```

The `evidence` directory also contains one hash-listed JSON graph chunk for every exported static processed table.
Node identities are shared across chunks, so repeated references are stored once. The manifest records the total shared-node count, denied player-state roots, and excluded non-game runtime namespaces.

Select the completed run.

```powershell
$runtimeRoot = Join-Path $profile 'ReturnOfModding\plugins_data\NeonHades2-BoonExporter\runs'
$runtimeRun = Get-LatestCompletedDirectory $runtimeRoot
$runtimeRun
```

Close _Hades II_ before importing the reports.

## 8. Archive the complete raw export

Copy and verify the entire completed mod run before importing any part of it.

```powershell
pnpm runtime-export:import -- --runtime-run $runtimeRun
$runtimeArchive = Get-LatestCompletedDirectory (Join-Path $dataRoot '.local\runtime-exports')
$rawRun = Join-Path $runtimeArchive 'raw'
$rawRun
```

The archive contains an unchanged copy of every finalized mod output.
Its manifest lists every file, size, and SHA-256 hash.
After this step, r2modman is only the staging location. Use `$rawRun` for every importer.
Keep the staging run until the raw archive and all imports pass.
You may then delete `ReturnOfModding\plugins_data\NeonHades2-BoonExporter` without affecting the `.local` archive.

## 9. Import the private evidence archive

Copy and verify the processed-table evidence before normalizing any domain.

```powershell
pnpm evidence:import -- --source-acquisition $sourceAcquisition --runtime-evidence (Join-Path $rawRun 'evidence')
$evidence = Get-LatestCompletedDirectory (Join-Path $dataRoot '.local\evidence')
$evidence
```

Keep the completed evidence archive and its matching source acquisition together.
They are the private source for future fields that the current normalized contract does not anticipate.
Neither artifact may be committed or published.

## 10. Import all five domains

Run every importer with the same source snapshot.

```powershell
pnpm runtime:import -- --report (Join-Path $rawRun 'runtime-report.json') --source-acquisition $sourceAcquisition
pnpm weapons:import -- --report (Join-Path $rawRun 'weapons\runtime-report.json') --source-acquisition $sourceAcquisition
pnpm arcana:import -- --report (Join-Path $rawRun 'arcana\runtime-report.json') --source-acquisition $sourceAcquisition
pnpm loadouts:import -- --report (Join-Path $rawRun 'loadouts\runtime-report.json') --source-acquisition $sourceAcquisition
pnpm guide:import -- --report (Join-Path $rawRun 'guide\runtime-report.json') --source-acquisition $sourceAcquisition --achievement-schema $achievementSchema
```

Each importer verifies the runtime finalization files, report hashes, exporter version, game version, source acquisition identity, and domain coverage.
Each command must report complete coverage.

Select the five completed domain acquisitions.

```powershell
$boons = Get-LatestCompletedDirectory (Join-Path $dataRoot '.local\boons')
$weapons = Get-LatestCompletedDirectory (Join-Path $dataRoot '.local\weapons')
$arcana = Get-LatestCompletedDirectory (Join-Path $dataRoot '.local\arcana')
$loadouts = Get-LatestCompletedDirectory (Join-Path $dataRoot '.local\loadouts')
$guide = Get-LatestCompletedDirectory (Join-Path $dataRoot '.local\guide')
```

## 11. Build the combined dataset

Pass all five completed domain acquisitions to the dataset builder.

```powershell
pnpm dataset:build -- --boons $boons --weapons $weapons --arcana $arcana --loadouts $loadouts --guide $guide
$dataset = Get-LatestCompletedDirectory (Join-Path $dataRoot '.local\datasets')
$dataset
```

The builder rejects incomplete artifacts, changed hashes, mixed source identities, mixed exporter versions, record-count drift, duplicate identifiers, unresolved references, invalid values, unknown enums, and excluded dialogue presentation data.

Confirm the completed files.

```powershell
Get-ChildItem -LiteralPath $dataset
```

The directory must contain:

```text
dataset.json
validation.json
manifest.json
complete.json
```

You now have the complete normalized NeonHades2 dataset for one recorded Steam build.
Keep the directory under `.local`.
Do not commit or distribute it.

To create the verified and sanitized publication used by the website, continue with [Verify and publish the dataset](/project/data/VERIFY-AND-PUBLISH.md).

## Troubleshoot a failed run

Do not rename an incomplete directory or add a completion marker yourself.
The pipeline writes completion markers only after every check and file write succeeds.

Use the first failing command as the boundary:

- If `snapshot` fails, check the Steam installation, pending updates, and manifest selection.
- If an audit fails, the installed game build no longer matches the current contract.
- If a preflight fails, the exporter source and the snapshot do not satisfy one another.
- If the exporter does not finish, inspect `ReturnOfModding\LogOutput.log` and confirm every manifest dependency is installed.
- If `runtime-export:import` rejects the run, preserve the r2modman output and investigate the missing, changed, or unexpected file.
- If `evidence:import` rejects a file, rerun the exporter instead of editing or copying individual table files.
- If an importer rejects a report, do not mix reports or snapshots from different runs.
- If `dataset:build` rejects an input, rerun the failed domain import instead of editing its artifact.
