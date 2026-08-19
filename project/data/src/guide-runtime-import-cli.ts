import { isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createRuntimeGuideAcquisition } from "./guide/index.js";

const defaultOutputRoot = fileURLToPath(new URL("../.local/guide/", import.meta.url));

function valueAfter(arguments_: readonly string[], option: string): string | undefined {
  const index = arguments_.indexOf(option);
  if (index < 0) return undefined;
  return arguments_[index + 1];
}

async function main(): Promise<void> {
  const arguments_ = process.argv.slice(2).filter((argument) => argument !== "--");
  const report = valueAfter(arguments_, "--report");
  const source = valueAfter(arguments_, "--source-acquisition");
  const achievements = valueAfter(arguments_, "--achievement-schema");
  if (report === undefined || !isAbsolute(report)) throw new Error("--report requires an absolute path.");
  if (source === undefined || !isAbsolute(source)) throw new Error("--source-acquisition requires an absolute path.");
  if (achievements === undefined || !isAbsolute(achievements)) {
    throw new Error("--achievement-schema requires an absolute path.");
  }
  const result = await createRuntimeGuideAcquisition({
    reportPath: report,
    sourceAcquisitionDirectory: source,
    achievementSchemaPath: achievements,
    outputRoot: resolve(valueAfter(arguments_, "--output") ?? defaultOutputRoot),
  });
  console.log(`Guide runtime acquisition complete.
Acquisition: ${result.acquisitionId}
Coverage complete: ${result.coverageComplete}
Counts: ${JSON.stringify(result.counts)}
Directory: ${result.directory}`);
  if (!result.coverageComplete) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Unknown guide runtime import failure.");
  process.exitCode = 1;
});
