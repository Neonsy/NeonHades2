import { isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createRuntimeArcanaAcquisition } from "./arcana/runtime-acquisition.js";

const defaultOutputRoot = fileURLToPath(new URL("../.local/arcana/", import.meta.url));

function valueAfter(arguments_: readonly string[], option: string): string | undefined {
  const index = arguments_.indexOf(option);
  if (index < 0) return undefined;
  const value = arguments_[index + 1];
  if (value === undefined || value.startsWith("--")) {
    throw new Error(`${option} requires a value.`);
  }
  return value;
}

async function main(): Promise<void> {
  const arguments_ = process.argv.slice(2).filter((argument) => argument !== "--");
  if (arguments_.includes("--help")) {
    console.log(`Usage: pnpm arcana:import -- --report <absolute-path> --source-acquisition <absolute-path> [--output <path>]

Verifies and normalizes a finalized Arcana runtime export into ignored local storage.`);
    return;
  }
  const reportPath = valueAfter(arguments_, "--report");
  const sourceAcquisitionDirectory = valueAfter(arguments_, "--source-acquisition");
  if (reportPath === undefined || !isAbsolute(reportPath)) {
    throw new Error("--report requires an absolute path.");
  }
  if (sourceAcquisitionDirectory === undefined || !isAbsolute(sourceAcquisitionDirectory)) {
    throw new Error("--source-acquisition requires an absolute path.");
  }
  const outputRoot = resolve(valueAfter(arguments_, "--output") ?? defaultOutputRoot);
  const knownOptions = new Set(["--report", "--source-acquisition", "--output"]);
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index] as string;
    if (!knownOptions.has(argument)) {
      throw new Error(`Unknown Arcana runtime import option: ${argument}`);
    }
    index += 1;
  }
  const result = await createRuntimeArcanaAcquisition({
    reportPath,
    sourceAcquisitionDirectory,
    outputRoot,
  });
  console.log(`Arcana runtime acquisition complete.
Acquisition: ${result.acquisitionId}
Cards: ${result.cardCount}
Ranks: ${result.rankCount}
Grasp levels: ${result.graspLevelCount}
Maximum Grasp: ${result.maximumGrasp}
Coverage complete: ${result.coverageComplete}
Directory: ${result.directory}`);
  if (!result.coverageComplete) process.exitCode = 1;
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown Arcana runtime import failure.";
  console.error(`Arcana runtime import failed: ${message}`);
  process.exitCode = 1;
});
