import { isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";

import { preflightGuideExporter } from "./guide/index.js";

const modDirectory = fileURLToPath(new URL("../mod/neodes2-boon-exporter/", import.meta.url));

function valueAfter(arguments_: readonly string[], option: string): string | undefined {
  const index = arguments_.indexOf(option);
  if (index < 0) return undefined;
  return arguments_[index + 1];
}

async function main(): Promise<void> {
  const arguments_ = process.argv.slice(2).filter((argument) => argument !== "--");
  const source = valueAfter(arguments_, "--source-acquisition");
  const achievements = valueAfter(arguments_, "--achievement-schema");
  if (source === undefined || !isAbsolute(source)) throw new Error("--source-acquisition requires an absolute path.");
  if (achievements === undefined || !isAbsolute(achievements)) {
    throw new Error("--achievement-schema requires an absolute path.");
  }
  const preflight = await preflightGuideExporter(modDirectory, source, achievements);
  console.log(`Guide exporter ${preflight.exporterVersion}
Source audit complete: ${preflight.sourceAudit.complete}
Issues: ${preflight.issues.length}
Complete: ${preflight.complete}`);
  for (const issue of preflight.issues) console.log(`- ${issue}`);
  if (!preflight.complete) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Unknown guide exporter preflight failure.");
  process.exitCode = 1;
});
