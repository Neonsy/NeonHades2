import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { parseSteamAchievementSchema, type SteamAchievementText } from "./steam-achievements.js";

export interface GuideSourceAudit {
  readonly schema: "neodes2-guide-source-audit-1";
  readonly sourceAcquisitionDirectory: string;
  readonly shrineOrder: readonly string[];
  readonly bountyOrder: readonly string[];
  readonly questOrder: readonly string[];
  readonly outroIds: readonly string[];
  readonly outroOrder: readonly string[];
  readonly routeRegions: {
    readonly underworld: readonly string[];
    readonly surface: readonly string[];
  };
  readonly achievements: readonly SteamAchievementText[];
  readonly issues: readonly string[];
  readonly complete: boolean;
}

function maskLua(source: string): string {
  const characters = [...source];
  let quote: "\"" | "'" | undefined;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  for (let index = 0; index < characters.length; index += 1) {
    const current = characters[index] as string;
    const next = characters[index + 1];
    if (lineComment) {
      if (current === "\n") lineComment = false;
      else characters[index] = " ";
      continue;
    }
    if (blockComment) {
      if (current === "]" && next === "]") {
        characters[index] = " ";
        characters[index + 1] = " ";
        index += 1;
        blockComment = false;
      } else if (current !== "\n" && current !== "\r") characters[index] = " ";
      continue;
    }
    if (quote !== undefined) {
      if (escaped) escaped = false;
      else if (current === "\\") escaped = true;
      else if (current === quote) quote = undefined;
      if (current !== "\n" && current !== "\r") characters[index] = " ";
      continue;
    }
    if (current === "-" && next === "-") {
      characters[index] = " ";
      characters[index + 1] = " ";
      index += 1;
      if (characters[index + 1] === "[" && characters[index + 2] === "[") {
        characters[index + 1] = " ";
        characters[index + 2] = " ";
        index += 2;
        blockComment = true;
      } else lineComment = true;
      continue;
    }
    if (current === "\"" || current === "'") {
      quote = current;
      characters[index] = " ";
    }
  }
  return characters.join("");
}

function closingBrace(masked: string, start: number): number {
  let depth = 0;
  for (let index = start; index < masked.length; index += 1) {
    if (masked[index] === "{") depth += 1;
    else if (masked[index] === "}" && --depth === 0) return index;
  }
  throw new Error("Lua table has no closing brace.");
}

function orderedStrings(source: string, anchor: RegExp): readonly string[] {
  const masked = maskLua(source);
  const match = anchor.exec(masked);
  if (match?.index === undefined) throw new Error(`Lua table anchor not found: ${anchor.source}`);
  const start = masked.indexOf("{", match.index + match[0].length);
  if (start < 0) throw new Error(`Lua table opening brace not found: ${anchor.source}`);
  const table = source.slice(start, closingBrace(masked, start) + 1);
  return [...table.matchAll(/"([A-Za-z_][A-Za-z0-9_]*)"/gu)].map((entry) => entry[1] as string);
}

function topLevelTableKeys(source: string, anchor: RegExp): readonly string[] {
  const masked = maskLua(source);
  const match = anchor.exec(masked);
  if (match?.index === undefined) throw new Error(`Lua table anchor not found: ${anchor.source}`);
  const start = masked.indexOf("{", match.index + match[0].length);
  if (start < 0) throw new Error(`Lua table opening brace not found: ${anchor.source}`);
  const end = closingBrace(masked, start);
  const keys: string[] = [];
  let depth = 1;
  for (let index = start + 1; index < end; index += 1) {
    const character = masked[index];
    if (character === "{") {
      depth += 1;
      continue;
    }
    if (character === "}") {
      depth -= 1;
      continue;
    }
    if (depth !== 1 || character === undefined || !/[A-Za-z_]/u.test(character)) continue;
    const key = /^([A-Za-z_][A-Za-z0-9_]*)\s*=/u.exec(masked.slice(index))?.[1];
    if (key !== undefined) {
      keys.push(key);
      index += key.length - 1;
    }
  }
  return [...keys].sort();
}

function sameValues(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export async function auditGuideSources(
  sourceAcquisitionDirectory: string,
  achievementSchemaPath: string,
): Promise<GuideSourceAudit> {
  const acquisition = resolve(sourceAcquisitionDirectory);
  const scripts = join(acquisition, "sources", "Content", "Scripts");
  const [shrineSource, questSource, roomSetsSource, achievementSource, heroSource, achievementSchema] = await Promise.all([
    readFile(join(scripts, "ShrineData.lua"), "utf8"),
    readFile(join(scripts, "QuestData.lua"), "utf8"),
    readFile(join(scripts, "RoomSets.lua"), "utf8"),
    readFile(join(scripts, "AchievementData.lua"), "utf8"),
    readFile(join(scripts, "HeroData.lua"), "utf8"),
    readFile(resolve(achievementSchemaPath)),
  ]);
  const shrineOrder = orderedStrings(shrineSource, /\bShrineUpgradeOrder\s*=/u);
  const bountyOrder = orderedStrings(shrineSource, /\bBountyOrder\s*=/u);
  const questOrder = orderedStrings(questSource, /\bQuestOrderData\s*=/u);
  const outroIds = topLevelTableKeys(heroSource, /\bGameOutroData\s*=/u);
  const outroOrder = orderedStrings(heroSource, /\bGameOutroPriorities\s*=/u);
  const underworld = ["F", "G", "H", "I"];
  const surface = ["N", "O", "P", "Q"];
  const achievements = parseSteamAchievementSchema(achievementSchema);
  const issues: string[] = [];
  for (const regionId of [...underworld, ...surface]) {
    if (!new RegExp(`\\n\\s*${regionId}\\s*=\\s*\\{`, "u").test(roomSetsSource)) {
      issues.push(`RoomSets is missing route region ${regionId}.`);
    }
  }
  for (const achievement of achievements) {
    if (!new RegExp(`\\n\\s*${achievement.id}\\s*=\\s*\\{`, "u").test(achievementSource)) {
      issues.push(`AchievementData is missing Steam achievement ${achievement.id}.`);
    }
  }
  if (shrineOrder.length === 0) issues.push("ShrineUpgradeOrder is empty.");
  if (bountyOrder.length === 0) issues.push("Testament BountyOrder is empty.");
  if (questOrder.length === 0) issues.push("QuestOrderData is empty.");
  if (outroIds.length === 0) issues.push("GameOutroData is empty.");
  if (outroOrder.length === 0) issues.push("GameOutroPriorities is empty.");
  if (new Set(outroOrder).size !== outroOrder.length) issues.push("GameOutroPriorities repeats an identifier.");
  if (!sameValues([...outroOrder].sort(), outroIds)) {
    issues.push("GameOutroPriorities and GameOutroData contain different identifiers.");
  }
  return {
    schema: "neodes2-guide-source-audit-1",
    sourceAcquisitionDirectory: acquisition,
    shrineOrder,
    bountyOrder,
    questOrder,
    outroIds,
    outroOrder,
    routeRegions: { underworld, surface },
    achievements,
    issues,
    complete: issues.length === 0,
  };
}

export function renderGuideSourceAudit(audit: GuideSourceAudit): string {
  return [
    "# Guide source audit",
    "",
    `- Complete: ${audit.complete}`,
    `- Oath conditions: ${audit.shrineOrder.length}`,
    `- Testament order entries: ${audit.bountyOrder.length}`,
    `- Prophecies: ${audit.questOrder.length}`,
    `- Outros: ${audit.outroIds.length}`,
    `- Steam achievements: ${audit.achievements.length}`,
    `- Issues: ${audit.issues.length}`,
    "",
    ...audit.issues.map((issue) => `- ${issue}`),
    "",
  ].join("\n");
}
