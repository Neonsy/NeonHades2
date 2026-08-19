import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const supportedFormats = new Set([
  "AddToBase",
  "CardRarity",
  "DamageOverTime",
  "DamageOverTotalDuration",
  "FlatHeal",
  "FlatPercent",
  "FlatPercentDelta",
  "LuckModifiedPercent",
  "ManaSpendCost",
  "MultipliedMoney",
  "MultiplyByBase",
  "NegativePercentDelta",
  "Percent",
  "PercentDelta",
  "PercentHeal",
  "Rarity",
  "RemainingBiomes",
  "SlottedBoon",
  "TotalDamageTaken",
  "TotalHeroTraitValuePercent",
  "TotalTargets",
]);

const supportedBaseTypes = new Set([
  "EffectData",
  "EffectLuaData",
  "HeroData",
  "Projectile",
  "ProjectileBase",
  "Weapon",
  "WeaponData",
]);

interface LuaRecord {
  readonly id: string;
  readonly source: string;
}

interface LocalizationRecord {
  readonly displayName?: string;
  readonly description?: string;
  readonly inheritFrom?: string;
}

export interface LoadoutSourceAuditIssue {
  readonly code:
    | "duplicate-record"
    | "invalid-familiar-upgrades"
    | "invalid-membership-count"
    | "missing-description"
    | "missing-record"
    | "unsupported-base-type"
    | "unsupported-format";
  readonly recordId: string;
  readonly detail: string;
}

export interface LoadoutSourceAudit {
  readonly schema: "neodes2-loadout-source-audit-1";
  readonly sourceAcquisitionDirectory: string;
  readonly keepsakeIds: readonly string[];
  readonly familiarIds: readonly string[];
  readonly familiarUpgradeGroupIds: readonly string[];
  readonly hexes: readonly { readonly id: string; readonly traitId: string; readonly talentIds: readonly string[] }[];
  readonly incantationIds: readonly string[];
  readonly automaticWorldUpgradeIds: readonly string[];
  readonly extractionFormats: readonly string[];
  readonly extractionBaseTypes: readonly string[];
  readonly issues: readonly LoadoutSourceAuditIssue[];
  readonly complete: boolean;
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
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

function stripLuaComments(source: string): string {
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
    if (current === "\"" || current === "'") quote = current;
  }
  return characters.join("");
}

function closingBrace(masked: string, openingIndex: number): number {
  let depth = 0;
  for (let index = openingIndex; index < masked.length; index += 1) {
    if (masked[index] === "{") depth += 1;
    else if (masked[index] === "}") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  throw new Error("Lua table has no closing brace.");
}

function tableSource(source: string, anchor: RegExp): string {
  const masked = maskLua(source);
  const match = anchor.exec(masked);
  if (match?.index === undefined) throw new Error(`Lua table anchor not found: ${anchor.source}`);
  const start = masked.indexOf("{", match.index + match[0].length);
  if (start < 0) throw new Error(`Lua table opening brace not found: ${anchor.source}`);
  return source.slice(start, closingBrace(masked, start) + 1);
}

function luaRecords(source: string, anchor: RegExp): readonly LuaRecord[] {
  const masked = maskLua(source);
  const match = anchor.exec(masked);
  if (match?.index === undefined) throw new Error(`Lua table anchor not found: ${anchor.source}`);
  const tableStart = masked.indexOf("{", match.index + match[0].length);
  if (tableStart < 0) throw new Error(`Lua table opening brace not found: ${anchor.source}`);
  const tableEnd = closingBrace(masked, tableStart);
  const records: LuaRecord[] = [];
  let depth = 1;
  for (let index = tableStart + 1; index < tableEnd; index += 1) {
    const current = masked[index] as string;
    if (current === "{") { depth += 1; continue; }
    if (current === "}") { depth -= 1; continue; }
    if (depth !== 1 || !/[A-Za-z_]/u.test(current)) continue;
    const idMatch = /^[A-Za-z_][A-Za-z0-9_]*/u.exec(masked.slice(index));
    if (idMatch === null) continue;
    let cursor = index + idMatch[0].length;
    while (/\s/u.test(masked[cursor] ?? "")) cursor += 1;
    if (masked[cursor] !== "=") continue;
    cursor += 1;
    while (/\s/u.test(masked[cursor] ?? "")) cursor += 1;
    if (masked[cursor] !== "{") continue;
    const end = closingBrace(masked, cursor);
    records.push({ id: idMatch[0], source: source.slice(index, end + 1) });
    index = end;
  }
  return records;
}

function quotedField(source: string, field: string): string | undefined {
  return new RegExp(`\\b${field}\\s*=\\s*\"((?:\\\\.|[^\"])*)\"`, "u").exec(source)?.[1];
}

function quotedFields(source: string, field: string): readonly string[] {
  const expression = new RegExp(`\\b${field}\\s*=\\s*\"((?:\\\\.|[^\"])*)\"`, "gu");
  return [...stripLuaComments(source).matchAll(expression)].map((match) => match[1] as string);
}

function localizationRecords(source: string): ReadonlyMap<string, LocalizationRecord> {
  const records = new Map<string, LocalizationRecord>();
  const expression = /^[ \t]*\{\r?\n[ \t]*Id\s*=\s*"([^"]+)"([\s\S]*?)^[ \t]*\}/gmu;
  for (const match of source.matchAll(expression)) {
    const id = match[1] as string;
    const body = match[2] as string;
    const displayName = quotedField(body, "DisplayName");
    const description = quotedField(body, "Description");
    const inheritFrom = quotedField(body, "InheritFrom");
    records.set(id, {
      ...(displayName === undefined ? {} : { displayName }),
      ...(description === undefined ? {} : { description }),
      ...(inheritFrom === undefined ? {} : { inheritFrom }),
    });
  }
  return records;
}

function mergeLocalization(sources: readonly string[]): ReadonlyMap<string, LocalizationRecord> {
  const raw = new Map<string, LocalizationRecord>();
  for (const source of sources) for (const [id, record] of localizationRecords(source)) raw.set(id, record);
  const resolved = new Map<string, LocalizationRecord>();
  const resolving = new Set<string>();
  const resolveRecord = (id: string): LocalizationRecord | undefined => {
    const existing = resolved.get(id);
    if (existing !== undefined) return existing;
    const record = raw.get(id);
    if (record === undefined) return undefined;
    if (resolving.has(id)) throw new Error(`Localization inheritance cycle at ${id}.`);
    resolving.add(id);
    const parent = record.inheritFrom === undefined ? undefined : resolveRecord(record.inheritFrom);
    const displayName = record.displayName ?? parent?.displayName;
    const description = record.description ?? parent?.description;
    const value = {
      ...(displayName === undefined ? {} : { displayName }),
      ...(description === undefined ? {} : { description }),
      ...(record.inheritFrom === undefined ? {} : { inheritFrom: record.inheritFrom }),
    };
    resolved.set(id, value);
    resolving.delete(id);
    return value;
  };
  for (const id of raw.keys()) resolveRecord(id);
  return resolved;
}

function uniqueQuotedValues(source: string, pattern: RegExp): readonly string[] {
  return [...new Set([...stripLuaComments(source).matchAll(pattern)].map((match) => match[1] as string))].sort(compareStrings);
}

function addMissingTextIssues(
  ids: readonly string[],
  localization: ReadonlyMap<string, LocalizationRecord>,
  issues: LoadoutSourceAuditIssue[],
): void {
  for (const id of ids) {
    const text = localization.get(id);
    if (text?.displayName === undefined || text.description === undefined) {
      issues.push({
        code: "missing-description",
        recordId: id,
        detail: "Official English DisplayName or Description is missing.",
      });
    }
  }
}

export async function auditLoadoutSources(sourceAcquisitionDirectory: string): Promise<LoadoutSourceAudit> {
  const acquisitionDirectory = resolve(sourceAcquisitionDirectory);
  const scripts = join(acquisitionDirectory, "sources", "Content", "Scripts");
  const text = join(acquisitionDirectory, "sources", "Content", "Game", "Text", "en");
  const [
    keepsakeSource,
    keepsakeTraitSource,
    familiarSource,
    familiarShopSource,
    spellSource,
    spellTraitSource,
    talentTraitSource,
    worldUpgradeSource,
    ...localizationSources
  ] = await Promise.all([
    readFile(join(scripts, "KeepsakeData.lua"), "utf8"),
    readFile(join(scripts, "TraitData_Keepsake.lua"), "utf8"),
    readFile(join(scripts, "FamiliarData.lua"), "utf8"),
    readFile(join(scripts, "FamiliarShopData.lua"), "utf8"),
    readFile(join(scripts, "SpellData.lua"), "utf8"),
    readFile(join(scripts, "TraitData_Spell.lua"), "utf8"),
    readFile(join(scripts, "TraitData_Talent.lua"), "utf8"),
    readFile(join(scripts, "WorldUpgradeData.lua"), "utf8"),
    ...[
      "HelpText.en.sjson",
      "TraitText.en.sjson",
      "_FamiliarData.en.sjson",
      "_KeepsakeData.en.sjson",
      "_TraitData_Keepsake.en.sjson",
      "_TraitData_Spell.en.sjson",
      "_WorldUpgradeData.en.sjson",
    ].map((name) => readFile(join(text, name), "utf8")),
  ]);
  if (
    keepsakeSource === undefined || keepsakeTraitSource === undefined ||
    familiarSource === undefined || familiarShopSource === undefined ||
    spellSource === undefined || spellTraitSource === undefined ||
    talentTraitSource === undefined || worldUpgradeSource === undefined
  ) {
    throw new Error("Loadout source acquisition is incomplete.");
  }
  const localization = mergeLocalization(localizationSources);
  const issues: LoadoutSourceAuditIssue[] = [];
  const keepsakeIds = uniqueQuotedValues(keepsakeSource, /\bGift\s*=\s*"([A-Za-z_][A-Za-z0-9_]*)"/gu);
  const familiarOrderSource = tableSource(familiarSource, /\bFamiliarOrderData\s*=/u);
  const familiarIds = uniqueQuotedValues(familiarOrderSource, /"([A-Za-z_][A-Za-z0-9_]*)"/gu);
  const familiarUpgradeGroupIds = uniqueQuotedValues(
    familiarShopSource,
    /\bShowLastInGroup\s*=\s*"([A-Za-z_][A-Za-z0-9_]*)"/gu,
  );
  const familiarShopRecords = new Map(
    luaRecords(familiarShopSource, /\bFamiliarShopItemData\s*=/u).map((record) => [record.id, record]),
  );
  for (const groupId of familiarUpgradeGroupIds) {
    for (const suffix of ["", "2", "3"]) {
      if (!familiarShopRecords.has(`${groupId}${suffix}`)) {
        issues.push({
          code: "invalid-familiar-upgrades",
          recordId: groupId,
          detail: `Upgrade track is missing source rank ${suffix === "" ? "1" : suffix}.`,
        });
      }
    }
  }

  const hexes = luaRecords(spellSource, /\bSpellData\s*=/u)
    .flatMap((record) => {
      const traitId = quotedField(record.source, "TraitName");
      if (traitId === undefined) return [];
      const talentTable = tableSource(record.source, /\bTalents\s*=/u);
      return [{
        id: record.id,
        traitId,
        talentIds: uniqueQuotedValues(talentTable, /"([A-Za-z_][A-Za-z0-9_]*)"/gu),
      }];
    })
    .sort((left, right) => compareStrings(left.id, right.id));
  const worldRecords = luaRecords(worldUpgradeSource, /\bWorldUpgradeData\s*=/u);
  const incantationIds = worldRecords
    .map((record) => record.id)
    .filter((id) => {
      const localized = localization.get(id);
      return id.startsWith("WorldUpgrade") && localized?.displayName !== undefined && localized.description !== undefined;
    })
    .sort(compareStrings);
  const automaticTable = tableSource(
    worldUpgradeSource,
    /\bGameData\.WorldUpgradeAutomaticUnlocks\s*=/u,
  );
  const automaticWorldUpgradeIds = uniqueQuotedValues(
    automaticTable,
    /"([A-Za-z_][A-Za-z0-9_]*)"/gu,
  ).filter((id) => incantationIds.includes(id));
  if (keepsakeIds.length !== 33) {
    issues.push({ code: "invalid-membership-count", recordId: "keepsakes", detail: `Expected 33 keepsakes, found ${keepsakeIds.length}.` });
  }
  if (familiarIds.length !== 5) {
    issues.push({ code: "invalid-membership-count", recordId: "familiars", detail: `Expected five Familiars, found ${familiarIds.length}.` });
  }
  if (familiarUpgradeGroupIds.length !== 15) {
    issues.push({ code: "invalid-membership-count", recordId: "familiar-upgrades", detail: `Expected 15 upgrade tracks, found ${familiarUpgradeGroupIds.length}.` });
  }
  if (hexes.length !== 9) {
    issues.push({ code: "invalid-membership-count", recordId: "hexes", detail: `Expected nine Hexes, found ${hexes.length}.` });
  }
  if (incantationIds.length === 0) {
    issues.push({ code: "invalid-membership-count", recordId: "incantations", detail: "No localized incantations were found." });
  }
  addMissingTextIssues(keepsakeIds, localization, issues);
  for (const id of familiarIds) {
    if (localization.get(id)?.displayName === undefined) {
      issues.push({ code: "missing-description", recordId: id, detail: "Official English Familiar DisplayName is missing." });
    }
    const flavorId = `${id}_FlavorText`;
    if (localization.get(flavorId)?.displayName === undefined) {
      issues.push({ code: "missing-description", recordId: flavorId, detail: "Official English Familiar flavor text is missing." });
    }
  }
  addMissingTextIssues(familiarUpgradeGroupIds, localization, issues);
  addMissingTextIssues(hexes.flatMap((hex) => [hex.traitId, ...hex.talentIds]), localization, issues);
  addMissingTextIssues(incantationIds, localization, issues);

  const traitSources = [keepsakeTraitSource, familiarSource, spellTraitSource, talentTraitSource];
  const extractionFormats = [
    ...new Set(traitSources.flatMap((source) => quotedFields(source, "Format"))),
  ].sort(compareStrings);
  const extractionBaseTypes = [
    ...new Set(traitSources.flatMap((source) => quotedFields(source, "BaseType"))),
  ].sort(compareStrings);
  for (const format of extractionFormats) {
    if (!supportedFormats.has(format)) {
      issues.push({ code: "unsupported-format", recordId: format, detail: `Runtime sampling does not declare extraction format ${format}.` });
    }
  }
  for (const baseType of extractionBaseTypes) {
    if (!supportedBaseTypes.has(baseType)) {
      issues.push({ code: "unsupported-base-type", recordId: baseType, detail: `Runtime sampling does not declare base type ${baseType}.` });
    }
  }
  issues.sort(
    (left, right) => compareStrings(left.recordId, right.recordId) || compareStrings(left.code, right.code),
  );
  return {
    schema: "neodes2-loadout-source-audit-1",
    sourceAcquisitionDirectory: acquisitionDirectory,
    keepsakeIds,
    familiarIds,
    familiarUpgradeGroupIds,
    hexes,
    incantationIds,
    automaticWorldUpgradeIds,
    extractionFormats,
    extractionBaseTypes,
    issues,
    complete: issues.length === 0,
  };
}

export function renderLoadoutSourceAudit(audit: LoadoutSourceAudit): string {
  const lines = [
    "# Loadout-system source audit",
    "",
    `- Complete: ${audit.complete}`,
    `- Keepsakes: ${audit.keepsakeIds.length}`,
    `- Familiars: ${audit.familiarIds.length}`,
    `- Familiar upgrade tracks: ${audit.familiarUpgradeGroupIds.length}`,
    `- Hexes: ${audit.hexes.length}`,
    `- Path of Stars talents: ${new Set(audit.hexes.flatMap((hex) => hex.talentIds)).size}`,
    `- Incantations: ${audit.incantationIds.length}`,
    `- Automatic incantations: ${audit.automaticWorldUpgradeIds.length}`,
    `- Issues: ${audit.issues.length}`,
    "",
    "## Extraction vocabulary",
    "",
    `- Formats: ${audit.extractionFormats.join(", ") || "none"}`,
    `- Base types: ${audit.extractionBaseTypes.join(", ") || "none"}`,
  ];
  if (audit.issues.length > 0) {
    lines.push("", "## Issues", "");
    for (const issue of audit.issues) lines.push(`- ${issue.recordId} [${issue.code}]: ${issue.detail}`);
  }
  return `${lines.join("\n")}\n`;
}
