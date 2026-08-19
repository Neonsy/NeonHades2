import { isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createObservationArtifact } from "./observation/index.js";

const defaultOutputRoot = fileURLToPath(new URL("../.local/observations/", import.meta.url));

function valueAfter(arguments_: readonly string[], option: string): string | undefined {
  const index = arguments_.indexOf(option);
  if (index < 0) return undefined;
  const value = arguments_[index + 1];
  if (value === undefined || value.startsWith("--")) throw new Error(`${option} requires a value.`);
  return value;
}

async function main(): Promise<void> {
  const arguments_ = process.argv.slice(2).filter((argument) => argument !== "--");
  if (arguments_.includes("--help")) {
    console.log(`Usage: pnpm observation:import -- --dataset <absolute-path> --trace <absolute-path> [options]

Options:
  --output <path>  Ignored .local observation artifact root.`);
    return;
  }
  const dataset = valueAfter(arguments_, "--dataset");
  const trace = valueAfter(arguments_, "--trace");
  if (dataset === undefined || !isAbsolute(dataset)) throw new Error("--dataset requires an absolute path.");
  if (trace === undefined || !isAbsolute(trace)) throw new Error("--trace requires an absolute path.");
  const outputRoot = resolve(valueAfter(arguments_, "--output") ?? defaultOutputRoot);
  const knownOptions = new Set(["--dataset", "--trace", "--output"]);
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index] as string;
    if (!knownOptions.has(argument)) throw new Error(`Unknown observation import option: ${argument}`);
    index += 1;
  }
  const result = await createObservationArtifact({ datasetDirectory: dataset, tracePath: trace, outputRoot });
  console.log(`Observation import complete.
Acquisition: ${result.acquisitionId}
Events: ${result.report.eventCount}
Trace SHA-256: ${result.traceSha256}
Directory: ${result.directory}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown observation import failure.";
  console.error(`Observation import failed: ${message}`);
  process.exitCode = 1;
});
