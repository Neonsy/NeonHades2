import { mkdir, writeFile } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { assertLocalOutputPath } from "./snapshot/index.js";
import { auditWeaponSources, renderWeaponSourceAudit } from "./weapons/source-audit.js";

const defaultOutputDirectory = fileURLToPath(
  new URL("../.local/weapon-source-audit/", import.meta.url),
);

function argumentValue(arguments_: readonly string[], option: string): string | undefined {
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
    console.log(`Usage: pnpm weapons:audit -- --source-acquisition <absolute-path> [--output <path>]

Audits weapon, aspect, rank, Hammer, localization, and extraction source structure.
Output must remain under an ignored .local directory.`);
    return;
  }
  const sourceAcquisition = argumentValue(arguments_, "--source-acquisition");
  if (sourceAcquisition === undefined || !isAbsolute(sourceAcquisition)) {
    throw new Error("--source-acquisition requires an absolute path.");
  }
  const outputDirectory = resolve(
    argumentValue(arguments_, "--output") ?? defaultOutputDirectory,
  );
  assertLocalOutputPath(outputDirectory);
  const knownOptions = new Set(["--source-acquisition", "--output"]);
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index] as string;
    if (!knownOptions.has(argument)) {
      throw new Error(`Unknown weapon source audit option: ${argument}`);
    }
    index += 1;
  }

  const audit = await auditWeaponSources(sourceAcquisition);
  await mkdir(outputDirectory, { recursive: true });
  await Promise.all([
    writeFile(join(outputDirectory, "audit.json"), `${JSON.stringify(audit, null, 2)}\n`, "utf8"),
    writeFile(join(outputDirectory, "audit.md"), renderWeaponSourceAudit(audit), "utf8"),
  ]);
  console.log(`Weapon source audit complete.
Complete: ${audit.complete}
Weapons: ${audit.weaponIds.length}
Aspects: ${audit.aspects.length}
Hammers: ${audit.hammers.length}
Issues: ${audit.issues.length}
Directory: ${outputDirectory}`);
  if (!audit.complete) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown weapon source audit failure.";
  console.error(`Weapon source audit failed: ${message}`);
  process.exitCode = 1;
});
