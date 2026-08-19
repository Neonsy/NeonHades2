import { isAbsolute, resolve } from "node:path";

import { createEditorialArtifact } from "./editorial/index.js";

interface Options {
  readonly datasetDirectory: string;
  readonly dataReadyDirectory: string;
  readonly outputRoot: string;
}

function parseArguments(arguments_: readonly string[]): Options {
  const values = new Map<string, string>();
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === "--") continue;
    if (argument === "--help" || argument === "-h") {
      process.stdout.write(`Usage: pnpm editorial:build -- [options]

Required options:
  --dataset <absolute-directory>
  --data-ready <absolute-directory>

Optional:
  --output <directory>  Output root under .local (default: .local/editorial)
`);
      process.exit(0);
    }
    if (argument === undefined || !argument.startsWith("--")) throw new Error(`Unknown argument: ${String(argument)}`);
    const value = arguments_[index + 1];
    if (value === undefined || value.startsWith("--")) throw new Error(`${argument} requires a value.`);
    values.set(argument.slice(2), value);
    index += 1;
  }
  for (const option of values.keys()) {
    if (!new Set(["dataset", "data-ready", "output"]).has(option)) throw new Error(`Unknown option: --${option}`);
  }
  const required = (option: string): string => {
    const value = values.get(option);
    if (value === undefined || !isAbsolute(value)) throw new Error(`--${option} requires an absolute directory.`);
    return value;
  };
  return {
    datasetDirectory: required("dataset"),
    dataReadyDirectory: required("data-ready"),
    outputRoot: resolve(values.get("output") ?? ".local/editorial"),
  };
}

try {
  const result = await createEditorialArtifact(parseArguments(process.argv.slice(2)));
  process.stdout.write(`Editorial content complete.
Acquisition: ${result.acquisitionId}
Progression stages: ${result.report.counts.progressionStages}
Page definitions: ${result.report.counts.pageDefinitions}
Weapon guides: ${result.report.counts.weaponGuides}
Aspect guides: ${result.report.counts.aspectGuides}
Boon ratings: ${result.report.counts.boonRatings}
Arcana ratings: ${result.report.counts.arcanaRatings}
Familiar ratings: ${result.report.counts.familiarRatings}
Hex ratings: ${result.report.counts.hexRatings}
Keepsake priorities: ${result.report.counts.keepsakePriorities}
Resource policies: ${result.report.counts.resourceAdvice}
Directory: ${result.directory}
`);
} catch (error) {
  process.stderr.write(`Editorial build failed: ${error instanceof Error ? error.message : "Unknown error."}\n`);
  process.exitCode = 1;
}
