import { mkdir, writeFile } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { assertLocalOutputPath } from "./snapshot/index.js";
import { preflightWeaponExporter } from "./weapons/mod-preflight.js";

const defaultModDirectory = fileURLToPath(
  new URL("../mod/neodes2-boon-exporter/", import.meta.url),
);
const defaultOutputDirectory = fileURLToPath(
  new URL("../.local/weapon-preflight/", import.meta.url),
);

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
    console.log(`Usage: pnpm weapons:preflight -- --source-acquisition <absolute-path> [options]

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
  const knownOptions = new Set(["--source-acquisition", "--mod", "--output"]);
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index] as string;
    if (!knownOptions.has(argument)) {
      throw new Error(`Unknown weapon preflight option: ${argument}`);
    }
    index += 1;
  }
  const result = await preflightWeaponExporter(modDirectory, sourceAcquisition);
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(
    join(outputDirectory, "preflight.json"),
    `${JSON.stringify(result, null, 2)}\n`,
    "utf8",
  );
  console.log(`Weapon exporter preflight complete.
Complete: ${result.complete}
Exporter version: ${result.exporterVersion}
Weapons: ${result.sourceAudit.weaponIds.length}
Aspects: ${result.sourceAudit.aspects.length}
Hammers: ${result.sourceAudit.hammers.length}
Issues: ${result.issues.length}
Directory: ${outputDirectory}`);
  if (!result.complete) process.exitCode = 1;
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown weapon preflight failure.";
  console.error(`Weapon preflight failed: ${message}`);
  process.exitCode = 1;
});
