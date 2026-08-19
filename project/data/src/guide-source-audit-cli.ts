import { isAbsolute } from "node:path";

import { auditGuideSources, renderGuideSourceAudit } from "./guide/index.js";

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
  const audit = await auditGuideSources(source, achievements);
  console.log(renderGuideSourceAudit(audit));
  if (!audit.complete) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Unknown guide source audit failure.");
  process.exitCode = 1;
});
