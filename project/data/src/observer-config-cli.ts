import { isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createObserverConfig } from "./observation/index.js";

const defaultOutputPath = fileURLToPath(new URL("../.local/observer/config.lua", import.meta.url));

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
    console.log(`Usage: pnpm observer:config -- --dataset <absolute-path> [options]

Options:
  --output <path>  Ignored .local config file.`);
    return;
  }
  const dataset = valueAfter(arguments_, "--dataset");
  if (dataset === undefined || !isAbsolute(dataset)) throw new Error("--dataset requires an absolute path.");
  const output = resolve(valueAfter(arguments_, "--output") ?? defaultOutputPath);
  const knownOptions = new Set(["--dataset", "--output"]);
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index] as string;
    if (!knownOptions.has(argument)) throw new Error(`Unknown observer config option: ${argument}`);
    index += 1;
  }
  const path = await createObserverConfig(dataset, output);
  console.log(`Observer config created.
Path: ${path}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown observer config failure.";
  console.error(`Observer config failed: ${message}`);
  process.exitCode = 1;
});
