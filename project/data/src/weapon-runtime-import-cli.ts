import { isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createRuntimeWeaponAcquisition } from "./weapons/runtime-acquisition.js";

const defaultOutputRoot = fileURLToPath(new URL("../.local/weapons/", import.meta.url));

function valueAfter(arguments_: readonly string[], option: string): string | undefined {
  const index = arguments_.indexOf(option);
  if (index < 0) {
    return undefined;
  }
  const value = arguments_[index + 1];
  if (value === undefined || value.startsWith("--")) {
    throw new Error(`${option} requires a value.`);
  }
  return value;
}

async function main(): Promise<void> {
  const arguments_ = process.argv.slice(2).filter((argument) => argument !== "--");
  if (arguments_.includes("--help")) {
    console.log(`Usage: pnpm weapons:import -- --report <absolute-path> --source-acquisition <absolute-path> [--output <path>]

Verifies and normalizes a finalized weapon runtime export into ignored local storage.`);
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
      throw new Error(`Unknown weapon runtime import option: ${argument}`);
    }
    index += 1;
  }
  const result = await createRuntimeWeaponAcquisition({
    reportPath,
    sourceAcquisitionDirectory,
    outputRoot,
  });
  console.log(`Weapon runtime acquisition complete.
Acquisition: ${result.acquisitionId}
Weapons: ${result.weaponCount}
Aspects: ${result.aspectCount}
Hammers: ${result.hammerCount}
Coverage complete: ${result.coverageComplete}
Directory: ${result.directory}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown weapon runtime import failure.";
  console.error(`Weapon runtime import failed: ${message}`);
  process.exitCode = 1;
});
