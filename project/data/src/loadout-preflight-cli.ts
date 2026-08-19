import { mkdir, writeFile } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { preflightLoadoutExporter } from "./loadouts/mod-preflight.js";
import { assertLocalOutputPath } from "./snapshot/index.js";

const defaultModDirectory = fileURLToPath(new URL("../mod/neodes2-boon-exporter/", import.meta.url));
const defaultOutputDirectory = fileURLToPath(new URL("../.local/loadout-preflight/", import.meta.url));

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
    console.log(`Usage: pnpm loadouts:preflight -- --source-acquisition <absolute-path> [options]

Options:
  --mod <path>     Exporter source directory.
  --output <path>  Ignored .local result directory.`);
    return;
  }
  const sourceAcquisition = valueAfter(arguments_, "--source-acquisition");
  if (sourceAcquisition === undefined || !isAbsolute(sourceAcquisition)) {
    throw new Error("--source-acquisition requires an absolute path.");
  }
  const modDirectory = resolve(valueAfter(arguments_, "--mod") ?? defaultModDirectory);
  const outputDirectory = resolve(valueAfter(arguments_, "--output") ?? defaultOutputDirectory);
  assertLocalOutputPath(outputDirectory);
  const result = await preflightLoadoutExporter(modDirectory, sourceAcquisition);
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(join(outputDirectory, "preflight.json"), `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.log(`Loadout-system exporter preflight complete.
Complete: ${result.complete}
Exporter version: ${result.exporterVersion}
Keepsakes: ${result.sourceAudit.keepsakeIds.length}
Familiars: ${result.sourceAudit.familiarIds.length}
Hexes: ${result.sourceAudit.hexes.length}
Incantations: ${result.sourceAudit.incantationIds.length}
Issues: ${result.issues.length}
Directory: ${outputDirectory}`);
  if (!result.complete) process.exitCode = 1;
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown loadout-system preflight failure.";
  console.error(`Loadout-system preflight failed: ${message}`);
  process.exitCode = 1;
});
