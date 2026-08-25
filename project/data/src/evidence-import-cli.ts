import { resolve } from "node:path";

import { createEvidenceArchive } from "./evidence/index.js";

function valueAfter(arguments_: readonly string[], option: string): string {
  const index = arguments_.indexOf(option);
  const value = index < 0 ? undefined : arguments_[index + 1];
  if (value === undefined || value.startsWith("--")) throw new Error(`${option} requires a value.`);
  return resolve(value);
}

const arguments_ = process.argv.slice(2).filter((argument) => argument !== "--");
if (arguments_.includes("--help")) {
  console.log("Usage: pnpm evidence:import -- --source-acquisition <path> --runtime-evidence <path> [--output <path>]");
} else {
  const result = await createEvidenceArchive({
    sourceAcquisition: valueAfter(arguments_, "--source-acquisition"),
    runtimeEvidence: valueAfter(arguments_, "--runtime-evidence"),
    outputRoot: arguments_.includes("--output") ? valueAfter(arguments_, "--output") : resolve(".local", "evidence"),
  });
  console.log(`Evidence archive complete.\nAcquisition: ${result.acquisitionId}\nProcessed tables: ${result.tableCount}\nDirectory: ${result.directory}`);
}
