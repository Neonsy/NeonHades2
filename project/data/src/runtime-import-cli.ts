import { isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createRuntimeBoonAcquisition } from "./boons/runtime-acquisition.js";

interface CliOptions {
  readonly reportPath?: string;
  readonly sourceAcquisitionDirectory?: string;
  readonly outputRoot: string;
  readonly help: boolean;
}

const defaultOutputRoot = fileURLToPath(new URL("../.local/boons/", import.meta.url));

function requireValue(arguments_: readonly string[], index: number, option: string): string {
  const value = arguments_[index + 1];
  if (value === undefined || value.startsWith("--")) {
    throw new Error(`${option} requires a value.`);
  }
  return value;
}

export function parseRuntimeImportArguments(arguments_: readonly string[]): CliOptions {
  let reportPath: string | undefined;
  let sourceAcquisitionDirectory: string | undefined;
  let outputRoot = defaultOutputRoot;
  let help = false;

  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === "--") {
      continue;
    }
    if (argument === "--help") {
      help = true;
      continue;
    }
    if (argument === "--report") {
      const value = requireValue(arguments_, index, argument);
      if (!isAbsolute(value)) {
        throw new Error("--report requires an absolute path.");
      }
      reportPath = value;
      index += 1;
      continue;
    }
    if (argument === "--source-acquisition") {
      const value = requireValue(arguments_, index, argument);
      if (!isAbsolute(value)) {
        throw new Error("--source-acquisition requires an absolute path.");
      }
      sourceAcquisitionDirectory = value;
      index += 1;
      continue;
    }
    if (argument === "--output") {
      outputRoot = resolve(requireValue(arguments_, index, argument));
      index += 1;
      continue;
    }
    throw new Error(`Unknown runtime import option: ${argument ?? ""}`);
  }

  return {
    ...(reportPath === undefined ? {} : { reportPath }),
    ...(sourceAcquisitionDirectory === undefined ? {} : { sourceAcquisitionDirectory }),
    outputRoot,
    help,
  };
}

function printHelp(): void {
  console.log(`Usage: pnpm runtime:import -- --report <absolute-path> --source-acquisition <absolute-path> [options]

Options:
  --report <absolute-path>             Read a finalized runtime boon report.
  --source-acquisition <absolute-path> Bind it to a completed Phase 1 acquisition.
  --output <path>                      Write under an ignored .local directory.
  --help                               Show this help.`);
}

async function main(): Promise<void> {
  const options = parseRuntimeImportArguments(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }
  if (options.reportPath === undefined || options.sourceAcquisitionDirectory === undefined) {
    throw new Error("--report and --source-acquisition are required.");
  }

  const result = await createRuntimeBoonAcquisition({
    reportPath: options.reportPath,
    sourceAcquisitionDirectory: options.sourceAcquisitionDirectory,
    outputRoot: options.outputRoot,
  });
  console.log(`Runtime boon acquisition complete.
Acquisition: ${result.acquisitionId}
Boons: ${result.boonCount}
Coverage complete: ${result.coverageComplete}
Directory: ${result.directory}`);
  if (!result.coverageComplete) process.exitCode = 1;
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown runtime import failure.";
  console.error(`Runtime import failed: ${message}`);
  process.exitCode = 1;
});
