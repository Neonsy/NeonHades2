import { mkdir, writeFile } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { auditArcanaSources, renderArcanaSourceAudit } from "./arcana/source-audit.js";
import { assertLocalOutputPath } from "./snapshot/index.js";

const defaultOutputDirectory = fileURLToPath(
  new URL("../.local/arcana-source-audit/", import.meta.url),
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
    console.log(`Usage: pnpm arcana:audit -- --source-acquisition <absolute-path> [--output <path>]

Audits Arcana Cards, Grasp progression, ranks, localization, unlock rules, and extraction structure.
Output must remain under an ignored .local directory.`);
    return;
  }
  const sourceAcquisition = valueAfter(arguments_, "--source-acquisition");
  if (sourceAcquisition === undefined || !isAbsolute(sourceAcquisition)) {
    throw new Error("--source-acquisition requires an absolute path.");
  }
  const outputDirectory = resolve(valueAfter(arguments_, "--output") ?? defaultOutputDirectory);
  assertLocalOutputPath(outputDirectory);
  const knownOptions = new Set(["--source-acquisition", "--output"]);
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index] as string;
    if (!knownOptions.has(argument)) {
      throw new Error(`Unknown Arcana source audit option: ${argument}`);
    }
    index += 1;
  }
  const audit = await auditArcanaSources(sourceAcquisition);
  await mkdir(outputDirectory, { recursive: true });
  await Promise.all([
    writeFile(join(outputDirectory, "audit.json"), `${JSON.stringify(audit, null, 2)}\n`, "utf8"),
    writeFile(join(outputDirectory, "audit.md"), renderArcanaSourceAudit(audit), "utf8"),
  ]);
  console.log(`Arcana source audit complete.
Complete: ${audit.complete}
Cards: ${audit.cards.length}
Automatic Cards: ${audit.cards.filter((card) => card.automatic).length}
Grasp levels: ${audit.graspLevelCount}
Maximum Grasp: ${audit.maximumGrasp}
Issues: ${audit.issues.length}
Directory: ${outputDirectory}`);
  if (!audit.complete) process.exitCode = 1;
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown Arcana source audit failure.";
  console.error(`Arcana source audit failed: ${message}`);
  process.exitCode = 1;
});
