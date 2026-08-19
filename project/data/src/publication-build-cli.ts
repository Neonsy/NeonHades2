import { isAbsolute, resolve } from "node:path";

import { createPublicationArtifact } from "./publication/index.js";

interface Options {
  readonly datasetDirectory: string;
  readonly dataReadyDirectory: string;
  readonly editorialDirectory: string;
  readonly outputRoot: string;
}

function parseArguments(arguments_: readonly string[]): Options {
  const values = new Map<string, string>();
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === "--") continue;
    if (argument === "--help" || argument === "-h") {
      process.stdout.write(`Usage: pnpm publication:build -- [options]

Required options:
  --dataset <absolute-directory>
  --data-ready <absolute-directory>
  --editorial <absolute-directory>

Optional:
  --output <directory>  Output root under .local (default: .local/publication)
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
    if (!new Set(["dataset", "data-ready", "editorial", "output"]).has(option)) throw new Error(`Unknown option: --${option}`);
  }
  const required = (option: string): string => {
    const value = values.get(option);
    if (value === undefined || !isAbsolute(value)) throw new Error(`--${option} requires an absolute directory.`);
    return value;
  };
  return {
    datasetDirectory: required("dataset"),
    dataReadyDirectory: required("data-ready"),
    editorialDirectory: required("editorial"),
    outputRoot: resolve(values.get("output") ?? ".local/publication"),
  };
}

try {
  const result = await createPublicationArtifact(parseArguments(process.argv.slice(2)));
  process.stdout.write(`Publication dataset complete.
Acquisition: ${result.acquisitionId}
Records: ${result.report.counts.records}
Pages: ${result.report.counts.pages}
Search entries: ${result.report.counts.searchEntries}
Forward relationships: ${result.report.counts.forwardRelationships}
Reverse relationships: ${result.report.counts.reverseRelationships}
Conditions: ${result.report.counts.conditions}
Directory: ${result.directory}
`);
} catch (error) {
  process.stderr.write(`Publication build failed: ${error instanceof Error ? error.message : "Unknown error."}\n`);
  process.exitCode = 1;
}
