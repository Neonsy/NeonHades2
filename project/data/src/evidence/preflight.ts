import { readFile } from "node:fs/promises";
import { join } from "node:path";

export interface EvidenceExporterPreflight {
  readonly schema: "neodes2-evidence-exporter-preflight-1";
  readonly exporterVersion: string;
  readonly issues: readonly string[];
  readonly complete: boolean;
}

function manifestVersion(value: unknown): string {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("Exporter manifest is invalid.");
  const version = (value as Readonly<Record<string, unknown>>).version_number;
  if (typeof version !== "string" || version === "") throw new Error("Exporter manifest version is missing.");
  return version;
}

export async function preflightEvidenceExporter(modDirectory: string): Promise<EvidenceExporterPreflight> {
  const [main, evidence, manifestText] = await Promise.all([
    readFile(join(modDirectory, "main.lua"), "utf8"),
    readFile(join(modDirectory, "evidence.lua"), "utf8"),
    readFile(join(modDirectory, "manifest.json"), "utf8"),
  ]);
  const version = manifestVersion(JSON.parse(manifestText));
  const issues: string[] = [];
  if (!main.includes(`local EXPORTER_VERSION = "${version}"`)) issues.push("Exporter manifest and Lua versions differ.");
  for (const token of [
    "AudioState", "CodexStatus", "ConfigOptionCache", "DebugState", "FrameState", "GameState",
    "GamepadCursorRequests", "Hero", "HotLoadInfo", "ManaDataStore", "MapState", "NextSeeds",
    "NotifyResultsTable", "PrevRun", "QueuedTextLines", "SaveFile", "SaveName", "ScreenAnchors",
    "ScreenState", "SessionMapState", "SessionState", "TextLinesCache", "UserDebugEquip",
  ]) {
    if (!new RegExp(`\\b${token}\\s*=\\s*true`, "u").test(evidence)) issues.push(`Evidence exporter does not deny ${token}.`);
    if (new RegExp(`game\\.${token}\\b`, "u").test(evidence)) issues.push(`Evidence exporter directly reads ${token}.`);
  }
  for (const token of ["Current", "Active", "Pending"]) {
    if (!evidence.includes(`== "${token}"`)) issues.push(`Evidence exporter does not deny the ${token} runtime prefix.`);
  }
  for (const token of ["neodes2-processed-table-evidence-2", "neodes2-runtime-evidence-manifest-2", "neodes2-runtime-evidence-completion-2"]) {
    if (!evidence.includes(token)) issues.push(`Evidence exporter omits schema ${token}.`);
  }
  for (const token of ["_G", "GLOBALS", "ModUtil", "package", "rom"]) {
    if (!evidence.includes(`${token} = true`)) {
      issues.push(`Evidence exporter does not exclude runtime namespace ${token}.`);
    }
  }
  for (const token of ["state.ids", "state.chunk_nodes", "totalNodeCount"]) {
    if (!evidence.includes(token)) issues.push(`Evidence exporter omits shared-graph marker ${token}.`);
  }
  for (const token of ["table %d/%d", "MiB total", "s elapsed"]) {
    if (!evidence.includes(token)) issues.push(`Evidence exporter omits progress marker ${token}.`);
  }
  if (!main.includes('import "evidence.lua"') || !main.includes("evidence_exporter.write_archive")) {
    issues.push("Main exporter does not finalize the evidence archive.");
  }
  return {
    schema: "neodes2-evidence-exporter-preflight-1",
    exporterVersion: version,
    issues,
    complete: issues.length === 0,
  };
}
