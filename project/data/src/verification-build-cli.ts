import { isAbsolute, resolve } from "node:path";

import { createVerificationArtifact } from "./verification/index.js";

interface Options {
  readonly datasetDirectory: string;
  readonly sourceDirectory: string;
  readonly outputRoot: string;
  readonly manualEvidencePath?: string;
}

function parseArguments(arguments_: readonly string[]): Options {
  const values = new Map<string, string>();
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === "--") continue;
    if (argument === "--help" || argument === "-h") {
      process.stdout.write(`Usage: pnpm verification:build -- [options]

Required options:
  --dataset <absolute-directory>
  --source-acquisition <absolute-directory>

Optional:
  --output <directory>  Output root under .local (default: .local/verification)
  --manual-evidence <absolute-file>  Completed manual evidence ledger
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
    if (!new Set(["dataset", "source-acquisition", "output", "manual-evidence"]).has(key)) {
      throw new Error(`Unknown option: --${key}`);
    }
  }
  const datasetDirectory = values.get("dataset");
  const sourceDirectory = values.get("source-acquisition");
  if (datasetDirectory === undefined || !isAbsolute(datasetDirectory)) throw new Error("--dataset requires an absolute directory.");
  if (sourceDirectory === undefined || !isAbsolute(sourceDirectory)) {
    throw new Error("--source-acquisition requires an absolute directory.");
  }
  const manualEvidencePath = values.get("manual-evidence");
  if (manualEvidencePath !== undefined && !isAbsolute(manualEvidencePath)) {
    throw new Error("--manual-evidence requires an absolute file path.");
  }
  return {
    datasetDirectory,
    sourceDirectory,
    outputRoot: resolve(values.get("output") ?? ".local/verification"),
    ...(manualEvidencePath === undefined ? {} : { manualEvidencePath }),
  };
}

try {
  const result = await createVerificationArtifact(parseArguments(process.argv.slice(2)));
  const pending = result.report.manualTasks.filter((task) => task.status === "pending");
  const factTasks = pending.filter((task) => task.claimKind !== "editorial").length;
  const editorialTasks = pending.length - factTasks;
  process.stdout.write(`Automated verification complete.
Acquisition: ${result.acquisitionId}
Calculated values: ${result.report.calculations.valueCount}
Calculation issues: ${result.report.calculations.issues.length}
Named requirements: ${result.report.requirementGraph.nodes.length}
Requirement issues: ${result.report.requirementGraph.issues.length}
Manual checks complete: ${result.report.manualEvidence.completedCheckCount}/${result.report.manualEvidence.requiredCheckCount}
Pending factual manual tasks: ${factTasks}
Pending editorial manual tasks: ${editorialTasks}
Phase 5 complete: ${result.report.phaseComplete}
Directory: ${result.directory}
`);
} catch (error) {
  process.stderr.write(`Automated verification failed: ${error instanceof Error ? error.message : "Unknown error."}\n`);
  process.exitCode = 1;
}
