import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { auditGuideSources, type GuideSourceAudit } from "./source-audit.js";

export interface GuideExporterPreflight {
  readonly schema: "neodes2-guide-exporter-preflight-1";
  readonly exporterVersion: string;
  readonly sourceAudit: GuideSourceAudit;
  readonly issues: readonly string[];
  readonly complete: boolean;
}

export async function preflightGuideExporter(
  modDirectory: string,
  sourceAcquisitionDirectory: string,
  achievementSchemaPath: string,
): Promise<GuideExporterPreflight> {
  const mod = resolve(modDirectory);
  const [mainSource, guideSource, manifestSource, sourceAudit] = await Promise.all([
    readFile(join(mod, "main.lua"), "utf8"),
    readFile(join(mod, "guide.lua"), "utf8"),
    readFile(join(mod, "manifest.json"), "utf8"),
    auditGuideSources(sourceAcquisitionDirectory, achievementSchemaPath),
  ]);
  const version = /^local EXPORTER_VERSION\s*=\s*"([^"]+)"/mu.exec(mainSource)?.[1];
  if (version === undefined) throw new Error("main.lua does not declare EXPORTER_VERSION.");
  const manifest = JSON.parse(manifestSource) as Readonly<Record<string, unknown>>;
  const issues: string[] = [];
  if (manifest.version_number !== version) issues.push("Exporter manifest version differs from main.lua.");
  if (!mainSource.includes('"neodes2-guide-runtime-manifest-1"')) issues.push("Guide finalization schema is absent.");
  if (!guideSource.includes('schema = "neodes2-guide-runtime-1"')) issues.push("Guide runtime schema is absent.");
  for (const sourceTable of [
    "AchievementData",
    "BountyData",
    "ConsumableData",
    "EffectData",
    "EncounterData",
    "EnemyData",
    "GameData.RunClearMessageData",
    "GameOutroData",
    "GameOutroPriorities",
    "GiftData",
    "HubRoomData",
    "LootData",
    "MetaUpgradeData",
    "NamedRequirementsData",
    "NarrativeData",
    "QuestData",
    "QuestOrderData",
    "PresetEventArgs",
    "ResourceData",
    "RewardData",
    "RoomData",
    "RoomSets",
    "ScreenData.Shrine.BountyOrder",
    "ShrineUpgradeOrder",
    "TraitData",
  ]) {
    if (!guideSource.includes(`"${sourceTable}"`)) issues.push(`Guide source metadata omits ${sourceTable}.`);
  }
  if (!guideSource.includes("encounterAidTraits = collect_encounter_aid_traits")) {
    issues.push("Guide exporter omits processed encounter-aid traits.");
  }
  if (!mainSource.includes("collect_samples = collect_samples")) {
    issues.push("Guide exporter cannot resolve encounter-aid effect values.");
  }
  for (const token of [
    'base_type == "ConsumableData"',
    'instruction.Format == "FinalBoss"',
    'format == "MaxHealth"',
    'format == "MaxMana"',
    'instruction.Format == "ResourceAmount"',
    'instruction.Format == "TotalHeroTraitValue"',
  ]) {
    if (!mainSource.includes(token)) issues.push(`Guide exporter omits runtime extraction support for ${token}.`);
  }
  for (const token of ["CurrentRun", "GameState.", "SaveFile", "SaveName"]) {
    if (guideSource.includes(token)) issues.push(`Guide exporter reads player-specific state through ${token}.`);
  }
  if (!sourceAudit.complete) issues.push("Static guide source audit is incomplete.");
  return {
    schema: "neodes2-guide-exporter-preflight-1",
    exporterVersion: version,
    sourceAudit,
    issues,
    complete: issues.length === 0,
  };
}
