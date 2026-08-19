import { isAbsolute, resolve } from "node:path";

import { createDataReadyArtifact } from "./data-ready/index.js";

interface Options {
  readonly datasetDirectory: string;
  readonly reproducedDatasetDirectory: string;
  readonly verificationDirectory: string;
  readonly outputRoot: string;
}

function parseArguments(arguments_: readonly string[]): Options {
  const values = new Map<string, string>();
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === "--") continue;
    if (argument === "--help" || argument === "-h") {
      process.stdout.write(`Usage: pnpm data-ready:build -- [options]

Required options:
  --dataset <absolute-directory>
  --reproduced-dataset <absolute-directory>
  --verification <absolute-directory>

Optional:
  --output <directory>  Output root under .local (default: .local/data-ready)
`);
      process.exit(0);
    }
    if (argument === undefined || !argument.startsWith("--")) throw new Error(`Unknown argument: ${String(argument)}`);
    const value = arguments_[index + 1];
    if (value === undefined || value.startsWith("--")) throw new Error(`${argument} requires a value.`);
    values.set(argument.slice(2), value);
    index += 1;
  }
  for (const key of values.keys()) {
    if (!new Set(["dataset", "reproduced-dataset", "verification", "output"]).has(key)) throw new Error(`Unknown option: --${key}`);
  }
  const required = (key: string): string => {
    const value = values.get(key);
    if (value === undefined || !isAbsolute(value)) throw new Error(`--${key} requires an absolute directory.`);
    return value;
  };
  return {
    datasetDirectory: required("dataset"),
    reproducedDatasetDirectory: required("reproduced-dataset"),
    verificationDirectory: required("verification"),
    outputRoot: resolve(values.get("output") ?? ".local/data-ready"),
  };
}

try {
  const result = await createDataReadyArtifact(parseArguments(process.argv.slice(2)));
  process.stdout.write(`Data-ready gate complete.
Acquisition: ${result.acquisitionId}
Checks: ${result.report.checks.length}/${result.report.checks.length}
Records: ${result.report.dataset.recordCount}
Publication fields: ${result.report.publication.allowedFieldCount}
Directory: ${result.directory}
`);
} catch (error) {
  process.stderr.write(`Data-ready gate failed: ${error instanceof Error ? error.message : "Unknown error."}\n`);
  process.exitCode = 1;
}
