import { isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { prepareAspectTrainingSession } from "./training/index.js";

const defaultOutputRoot = fileURLToPath(new URL("../.local/training/", import.meta.url));

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
    console.log(`Usage: pnpm aspect-session:prepare -- --dataset <absolute-path> [options]

Options:
  --output <path>  Ignored .local training artifact root.`);
    return;
  }
  const dataset = valueAfter(arguments_, "--dataset");
  if (dataset === undefined || !isAbsolute(dataset)) throw new Error("--dataset requires an absolute path.");
  const output = resolve(valueAfter(arguments_, "--output") ?? defaultOutputRoot);
  const knownOptions = new Set(["--dataset", "--output"]);
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index] as string;
    if (!knownOptions.has(argument)) throw new Error(`Unknown aspect-session option: ${argument}`);
    index += 1;
  }
  const result = await prepareAspectTrainingSession(dataset, output);
  console.log(`Aspect training session prepared.
Acquisition: ${result.acquisitionId}
Scenarios: ${result.plan.scenarios.length}
Plan SHA-256: ${result.planSha256}
Directory: ${result.directory}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown aspect-session preparation failure.";
  console.error(`Aspect training preparation failed: ${message}`);
  process.exitCode = 1;
});
