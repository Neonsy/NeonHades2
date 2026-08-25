import { resolve } from "node:path";

import { createRuntimeExportArchive } from "./runtime-export/index.js";

function valueAfter(arguments_: readonly string[], option: string): string {
  const index = arguments_.indexOf(option);
  const value = index < 0 ? undefined : arguments_[index + 1];
  if (value === undefined || value.startsWith("--")) throw new Error(`${option} requires a value.`);
  return resolve(value);
}

const arguments_ = process.argv.slice(2).filter((argument) => argument !== "--");
if (arguments_.includes("--help")) {
  console.log("Usage: pnpm runtime-export:import -- --runtime-run <path> [--output <path>]");
} else {
  const result = await createRuntimeExportArchive({
    runtimeRun: valueAfter(arguments_, "--runtime-run"),
    outputRoot: arguments_.includes("--output") ? valueAfter(arguments_, "--output") : resolve(".local", "runtime-exports"),
  });
  console.log(`Runtime export archive complete.\nAcquisition: ${result.acquisitionId}\nFiles: ${result.fileCount}\nBytes: ${result.byteCount}\nDirectory: ${result.directory}`);
}
