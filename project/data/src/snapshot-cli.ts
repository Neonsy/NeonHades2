import { fileURLToPath } from "node:url";
import { isAbsolute, resolve } from "node:path";

import { assertLocalOutputPath, createSourceSnapshot } from "./snapshot/index.js";

interface CliOptions {
  readonly manifestPath?: string;
  readonly steamRoots?: readonly string[];
  readonly outputRoot: string;
  readonly help: boolean;
}

const defaultOutputRoot = fileURLToPath(new URL("../.local/acquisitions/", import.meta.url));

function requireValue(arguments_: readonly string[], index: number, option: string): string {
  const value = arguments_[index + 1];
  if (value === undefined || value.startsWith("--")) {
    throw new Error(`${option} requires a value.`);
  }
  return value;
}

export function parseSnapshotArguments(arguments_: readonly string[]): CliOptions {
  let manifestPath: string | undefined;
  let outputRoot = defaultOutputRoot;
  let help = false;
  const steamRoots: string[] = [];

  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === "--") {
      continue;
    }
    if (argument === "--help") {
      help = true;
      continue;
    }
    if (argument === "--manifest") {
      const value = requireValue(arguments_, index, argument);
      if (!isAbsolute(value)) {
        throw new Error("--manifest requires an absolute path.");
      }
      manifestPath = value;
      index += 1;
      continue;
    }
    if (argument === "--steam-root") {
      const value = requireValue(arguments_, index, argument);
      if (!isAbsolute(value)) {
        throw new Error("--steam-root requires an absolute path.");
      }
      steamRoots.push(value);
      index += 1;
      continue;
    }
    if (argument === "--output") {
      outputRoot = resolve(requireValue(arguments_, index, argument));
      index += 1;
      continue;
    }
    throw new Error(`Unknown snapshot option: ${argument ?? ""}`);
  }

  return {
    ...(manifestPath === undefined ? {} : { manifestPath }),
    ...(steamRoots.length === 0 ? {} : { steamRoots }),
    outputRoot,
    help,
  };
}

function printHelp(): void {
  console.log(`Usage: pnpm snapshot [options]

Options:
  --manifest <absolute-path>  Select one Steam app manifest when discovery is ambiguous.
  --steam-root <absolute-path> Add an explicit Steam root to discovery. May be repeated.
  --output <path>             Write to an ignored .local directory.
  --help                      Show this help.`);
}

async function main(): Promise<void> {
  const options = parseSnapshotArguments(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  assertLocalOutputPath(options.outputRoot);
  const result = await createSourceSnapshot({
    outputRoot: options.outputRoot,
    ...(options.manifestPath === undefined ? {} : { manifestPath: options.manifestPath }),
    ...(options.steamRoots === undefined ? {} : { steamRoots: options.steamRoots }),
  });

  console.log(`Snapshot complete.
Acquisition: ${result.acquisitionId}
Sources: ${result.sourceCount}
Directory: ${result.directory}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown snapshot failure.";
  console.error(`Snapshot failed: ${message}`);
  process.exitCode = 1;
});
