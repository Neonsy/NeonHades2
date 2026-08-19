import { isAbsolute, resolve } from "node:path";

import { createCombinedDataset, type DatasetDomainName } from "./dataset/index.js";

interface Options {
  readonly acquisitions: Readonly<Record<DatasetDomainName, string>>;
  readonly outputRoot: string;
}

const domains = ["arcana", "boons", "guide", "loadouts", "weapons"] as const;

function parseArguments(arguments_: readonly string[]): Options {
  const values = new Map<string, string>();
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === "--") continue;
    if (argument === "--help" || argument === "-h") {
      process.stdout.write(`Usage: pnpm dataset:build -- [options]

Required options:
  --arcana <absolute-directory>
  --boons <absolute-directory>
  --guide <absolute-directory>
  --loadouts <absolute-directory>
  --weapons <absolute-directory>

Optional:
  --output <directory>  Output root under .local (default: .local/datasets)
`);
      process.exit(0);
    }
    if (argument === undefined || !argument.startsWith("--")) {
      throw new Error(`Unknown argument: ${String(argument)}`);
    }
    const value = arguments_[index + 1];
    if (value === undefined || value.startsWith("--")) throw new Error(`${argument} requires a value.`);
    values.set(argument.slice(2), value);
    index += 1;
  }
  const acquisitions = Object.fromEntries(domains.map((domain) => {
    const value = values.get(domain);
    if (value === undefined || !isAbsolute(value)) throw new Error(`--${domain} requires an absolute directory.`);
    return [domain, value];
  })) as Readonly<Record<DatasetDomainName, string>>;
  const known = new Set([...domains, "output"]);
  for (const key of values.keys()) {
    if (!known.has(key as DatasetDomainName | "output")) throw new Error(`Unknown option: --${key}`);
  }
  return { acquisitions, outputRoot: resolve(values.get("output") ?? ".local/datasets") };
}

try {
  const result = await createCombinedDataset(parseArguments(process.argv.slice(2)));
  process.stdout.write(`Combined dataset complete.
Acquisition: ${result.acquisitionId}
Dataset SHA-256: ${result.datasetSha256}
Validation issues: ${result.validation.issues.length}
Directory: ${result.directory}
`);
} catch (error) {
  process.stderr.write(`Combined dataset failed: ${error instanceof Error ? error.message : "Unknown error."}\n`);
  process.exitCode = 1;
}
