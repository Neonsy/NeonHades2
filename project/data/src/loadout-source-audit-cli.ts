import { mkdir, writeFile } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { auditLoadoutSources, renderLoadoutSourceAudit } from "./loadouts/source-audit.js";
import { assertLocalOutputPath } from "./snapshot/index.js";

const defaultOutputDirectory = fileURLToPath(new URL("../.local/loadout-source-audit/", import.meta.url));

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
    console.log(`Usage: pnpm loadouts:audit -- --source-acquisition <absolute-path> [--output <path>]

Audits keepsake, Familiar, Hex, Path of Stars, and incantation source membership and extraction vocabulary.
Output must remain under an ignored .local directory.`);
    return;
  }
  const sourceAcquisition = valueAfter(arguments_, "--source-acquisition");
  if (sourceAcquisition === undefined || !isAbsolute(sourceAcquisition)) {
    throw new Error("--source-acquisition requires an absolute path.");
  }
  const outputDirectory = resolve(valueAfter(arguments_, "--output") ?? defaultOutputDirectory);
  assertLocalOutputPath(outputDirectory);
  const audit = await auditLoadoutSources(sourceAcquisition);
  await mkdir(outputDirectory, { recursive: true });
  await Promise.all([
    writeFile(join(outputDirectory, "audit.json"), `${JSON.stringify(audit, null, 2)}\n`, "utf8"),
    writeFile(join(outputDirectory, "audit.md"), renderLoadoutSourceAudit(audit), "utf8"),
  ]);
  console.log(`Loadout-system source audit complete.
Complete: ${audit.complete}
Keepsakes: ${audit.keepsakeIds.length}
Familiars: ${audit.familiarIds.length}
Familiar upgrade tracks: ${audit.familiarUpgradeGroupIds.length}
Hexes: ${audit.hexes.length}
Incantations: ${audit.incantationIds.length}
Issues: ${audit.issues.length}
Directory: ${outputDirectory}`);
  if (!audit.complete) process.exitCode = 1;
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown loadout-system source audit failure.";
  console.error(`Loadout-system source audit failed: ${message}`);
  process.exitCode = 1;
});
