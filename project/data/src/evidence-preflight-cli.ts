import { fileURLToPath } from "node:url";

import { preflightEvidenceExporter } from "./evidence/index.js";

const modDirectory = fileURLToPath(new URL("../mod/neodes2-boon-exporter/", import.meta.url));
const result = await preflightEvidenceExporter(modDirectory);
console.log(`Evidence exporter preflight complete.\nComplete: ${result.complete}\nExporter version: ${result.exporterVersion}\nIssues: ${result.issues.length}`);
if (!result.complete) {
  for (const issue of result.issues) console.error(`- ${issue}`);
  process.exitCode = 1;
}
