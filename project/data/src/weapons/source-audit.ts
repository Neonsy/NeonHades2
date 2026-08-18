import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const weaponFamilies = [
  { id: "WeaponStaffSwing", hammerFile: "TraitData_Staff.lua", hammerRoot: "StaffHammerTrait" },
  { id: "WeaponDagger", hammerFile: "TraitData_Dagger.lua", hammerRoot: "DaggerHammerTrait" },
  { id: "WeaponTorch", hammerFile: "TraitData_Torch.lua", hammerRoot: "TorchHammerTrait" },
  { id: "WeaponAxe", hammerFile: "TraitData_Axe.lua", hammerRoot: "AxeHammerTrait" },
  { id: "WeaponLob", hammerFile: "TraitData_Lob.lua", hammerRoot: "LobHammerTrait" },
  { id: "WeaponSuit", hammerFile: "TraitData_Suit.lua", hammerRoot: "SuitHammerTrait" },
] as const;

const supportedFormats = new Set([
  "AddToBase",
  "AdjustedBaseManaSpendCost",
  "LuckModifiedPercent",
  "MultiplyByBase",
  "NegativePercentDelta",
  "Percent",
  "PercentDelta",
  "PercentReciprocalDelta",
]);

const supportedBaseTypes = new Set([
  "EffectData",
  "EffectLuaData",
  "Projectile",
  "ProjectileBase",
  "TraitData",
  "WeaponData",
]);

interface LuaRecord {
  readonly id: string;
  readonly source: string;
}

interface LocalizationRecord {
  readonly displayName?: string;
  readonly description?: string;
}

export interface WeaponSourceAuditIssue {
  readonly code:
    | "duplicate-extract-id"
    | "duplicate-record"
    | "invalid-aspect-count"
    | "missing-aspect-shop-item"
    | "missing-description"
    | "missing-hammer-family"
    | "missing-rank-shop-item"
    | "missing-weapon-shop-item"
    | "tooltip-value-without-extractor"
    | "unsupported-base-type"
    | "unsupported-format";
  readonly recordId: string;
  readonly detail: string;
}

export interface WeaponSourceAuditRecord {
  readonly id: string;
  readonly weaponId: string;
  readonly extractIds: readonly string[];
  readonly tooltipValueIds: readonly string[];
}

export interface WeaponSourceAudit {
  readonly schema: "neodes2-weapon-source-audit-1";
  readonly sourceAcquisitionDirectory: string;
  readonly weaponIds: readonly string[];
  readonly aspects: readonly WeaponSourceAuditRecord[];
  readonly hammers: readonly WeaponSourceAuditRecord[];
  readonly baseAspectIds: readonly string[];
  readonly rankShopItemCount: number;
  readonly extractionFormats: readonly string[];
  readonly extractionBaseTypes: readonly string[];
  readonly issues: readonly WeaponSourceAuditIssue[];
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
      if (current === "\n") {
        lineComment = false;
      } else {
        characters[index] = " ";
      }
      continue;
    }
    if (blockComment) {
      if (current === "]" && next === "]") {
        characters[index] = " ";
        characters[index + 1] = " ";
        index += 1;
        blockComment = false;
      } else if (current !== "\n" && current !== "\r") {
        characters[index] = " ";
      }
      continue;
    }
    if (quote !== undefined) {
      if (escaped) {
        escaped = false;
      } else if (current === "\\") {
        escaped = true;
      } else if (current === quote) {
        quote = undefined;
      }
      if (current !== "\n" && current !== "\r") {
        characters[index] = " ";
      }
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
      } else {
        lineComment = true;
      }
      continue;
    }
    if (current === "\"" || current === "'") {
      quote = current;
      characters[index] = " ";
    }
  }
  return characters.join("");
}

function closingBrace(masked: string, openingIndex: number): number {
  let depth = 0;
  for (let index = openingIndex; index < masked.length; index += 1) {
    if (masked[index] === "{") {
      depth += 1;
    } else if (masked[index] === "}") {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }
  throw new Error("Lua table has no closing brace.");
}

function luaRecords(source: string, anchor: RegExp): readonly LuaRecord[] {
  const masked = maskLua(source);
  const match = anchor.exec(masked);
  if (match?.index === undefined) {
    throw new Error(`Lua table anchor was not found: ${anchor.source}`);
  }
  const tableStart = masked.indexOf("{", match.index + match[0].length);
  if (tableStart < 0) {
    throw new Error(`Lua table opening brace was not found: ${anchor.source}`);
  }
  const tableEnd = closingBrace(masked, tableStart);
  const records: LuaRecord[] = [];
  let depth = 1;

  for (let index = tableStart + 1; index < tableEnd; index += 1) {
    const current = masked[index] as string;
    if (current === "{") {
      depth += 1;
      continue;
    }
    if (current === "}") {
      depth -= 1;
      continue;
    }
    if (depth !== 1 || !/[A-Za-z_]/u.test(current)) {
      continue;
    }
    const idMatch = /^[A-Za-z_][A-Za-z0-9_]*/u.exec(masked.slice(index));
    if (idMatch === null) {
      continue;
    }
    let cursor = index + idMatch[0].length;
    while (/\s/u.test(masked[cursor] ?? "")) {
      cursor += 1;
    }
    if (masked[cursor] !== "=") {
      continue;
    }
    cursor += 1;
    while (/\s/u.test(masked[cursor] ?? "")) {
      cursor += 1;
    }
    if (masked[cursor] !== "{") {
      continue;
    }
    const recordEnd = closingBrace(masked, cursor);
    records.push({ id: idMatch[0], source: source.slice(index, recordEnd + 1) });
    index = recordEnd;
  }
  return records;
}

function quotedField(source: string, field: string): string | undefined {
  const expression = new RegExp(`\\b${field}\\s*=\\s*\"((?:\\\\.|[^\"])*)\"`, "u");
  return expression.exec(source)?.[1];
}

function quotedFields(source: string, field: string): readonly string[] {
  const expression = new RegExp(`\\b${field}\\s*=\\s*\"((?:\\\\.|[^\"])*)\"`, "gu");
  return [...source.matchAll(expression)].map((match) => match[1] as string);
}

function localizationRecords(source: string): ReadonlyMap<string, LocalizationRecord> {
  const records = new Map<string, LocalizationRecord>();
  const expression = /^[ \t]*\{\r?\n[ \t]*Id\s*=\s*"([^"]+)"([\s\S]*?)^[ \t]*\}/gmu;
  for (const match of source.matchAll(expression)) {
    const id = match[1] as string;
    const body = match[2] as string;
    const displayName = quotedField(body, "DisplayName");
    const description = quotedField(body, "Description");
    records.set(id, {
      ...(displayName === undefined ? {} : { displayName }),
      ...(description === undefined ? {} : { description }),
    });
  }
  return records;
}

function tooltipValueIds(description: string | undefined): readonly string[] {
  if (description === undefined) {
    return [];
  }
  return [
    ...new Set(
      [...description.matchAll(/\$TooltipData\.ExtractData\.([A-Za-z0-9_]+)/gu)].map(
        (match) => match[1] as string,
      ),
    ),
  ].sort(compareStrings);
}

function duplicateValues(values: readonly string[]): readonly string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value);
    }
    seen.add(value);
  }
  return [...duplicates].sort(compareStrings);
}

function recordsById(
  records: readonly LuaRecord[],
  issues: WeaponSourceAuditIssue[],
): ReadonlyMap<string, LuaRecord> {
  const result = new Map<string, LuaRecord>();
  for (const record of records) {
    if (result.has(record.id)) {
      issues.push({
        code: "duplicate-record",
        recordId: record.id,
        detail: "The same top-level Lua record appears more than once.",
      });
    }
    result.set(record.id, record);
  }
  return result;
}

function auditExtractionVocabulary(
  sources: readonly string[],
  issues: WeaponSourceAuditIssue[],
): { readonly formats: readonly string[]; readonly baseTypes: readonly string[] } {
  const formats = [...new Set(sources.flatMap((source) => quotedFields(source, "Format")))].sort(
    compareStrings,
  );
  const baseTypes = [
    ...new Set(sources.flatMap((source) => quotedFields(source, "BaseType"))),
  ].sort(compareStrings);
  for (const format of formats) {
    if (!supportedFormats.has(format)) {
      issues.push({
        code: "unsupported-format",
        recordId: format,
        detail: `The runtime exporter does not declare support for extraction format ${format}.`,
      });
    }
  }
  for (const baseType of baseTypes) {
    if (!supportedBaseTypes.has(baseType)) {
      issues.push({
        code: "unsupported-base-type",
        recordId: baseType,
        detail: `The runtime exporter does not declare support for base type ${baseType}.`,
      });
    }
  }
  return { formats, baseTypes };
}

function auditRecord(
  record: LuaRecord,
  weaponId: string,
  localization: ReadonlyMap<string, LocalizationRecord>,
  issues: WeaponSourceAuditIssue[],
): WeaponSourceAuditRecord {
  const allExtractIds = quotedFields(record.source, "ExtractAs");
  for (const duplicate of duplicateValues(allExtractIds)) {
    issues.push({
      code: "duplicate-extract-id",
      recordId: record.id,
      detail: `Extraction ID ${duplicate} is declared more than once.`,
    });
  }
  const localized = localization.get(record.id);
  if (localized?.displayName === undefined || localized.description === undefined) {
    issues.push({
      code: "missing-description",
      recordId: record.id,
      detail: "English DisplayName or Description is missing.",
    });
  }
  const extracts = [...new Set(allExtractIds)].sort(compareStrings);
  const tooltipIds = tooltipValueIds(localized?.description);
  for (const tooltipId of tooltipIds) {
    if (!extracts.includes(tooltipId)) {
      issues.push({
        code: "tooltip-value-without-extractor",
        recordId: record.id,
        detail: `Description references ${tooltipId}, but the record has no matching ExtractAs.`,
      });
    }
  }
  return { id: record.id, weaponId, extractIds: extracts, tooltipValueIds: tooltipIds };
}

export async function auditWeaponSources(
  sourceAcquisitionDirectory: string,
): Promise<WeaponSourceAudit> {
  const acquisitionDirectory = resolve(sourceAcquisitionDirectory);
  const scriptDirectory = join(acquisitionDirectory, "sources", "Content", "Scripts");
  const textDirectory = join(acquisitionDirectory, "sources", "Content", "Game", "Text", "en");
  const [shopSource, aspectSource, localizationSource, ...hammerSources] = await Promise.all([
    readFile(join(scriptDirectory, "WeaponShopData.lua"), "utf8"),
    readFile(join(scriptDirectory, "TraitData_Aspect.lua"), "utf8"),
    readFile(join(textDirectory, "TraitText.en.sjson"), "utf8"),
    ...weaponFamilies.map(async (family) =>
      readFile(join(scriptDirectory, family.hammerFile), "utf8"),
    ),
  ]);
  const issues: WeaponSourceAuditIssue[] = [];
  const shopRecords = recordsById(
    luaRecords(shopSource, /\bWeaponShopItemData\s*=/u),
    issues,
  );
  const aspectRecords = luaRecords(aspectSource, /\bTraitSetData\.Aspects\s*=/u).filter(
    (record) => weaponFamilies.some((family) => quotedField(record.source, "RequiredWeapon") === family.id),
  );
  recordsById(aspectRecords, issues);
  const localization = localizationRecords(localizationSource);

  for (const family of weaponFamilies) {
    if (!shopRecords.has(family.id)) {
      issues.push({
        code: "missing-weapon-shop-item",
        recordId: family.id,
        detail: "Base weapon is absent from WeaponShopItemData.",
      });
    }
    const localized = localization.get(family.id);
    if (localized?.displayName === undefined || localized.description === undefined) {
      issues.push({
        code: "missing-description",
        recordId: family.id,
        detail: "English weapon DisplayName or Description is missing.",
      });
    }
  }

  const aspects: WeaponSourceAuditRecord[] = [];
  const baseAspectIds: string[] = [];
  let rankShopItemCount = 0;
  for (const family of weaponFamilies) {
    const familyAspects = aspectRecords.filter(
      (record) => quotedField(record.source, "RequiredWeapon") === family.id,
    );
    if (familyAspects.length !== 4) {
      issues.push({
        code: "invalid-aspect-count",
        recordId: family.id,
        detail: `Expected four aspects, found ${familyAspects.length}.`,
      });
    }
    for (const aspect of familyAspects) {
      aspects.push(auditRecord(aspect, family.id, localization, issues));
      const unlockItem = shopRecords.get(aspect.id);
      if (unlockItem === undefined) {
        baseAspectIds.push(aspect.id);
      } else if (quotedField(unlockItem.source, "WeaponName") !== family.id) {
        issues.push({
          code: "missing-aspect-shop-item",
          recordId: aspect.id,
          detail: `Aspect shop item is not owned by ${family.id}.`,
        });
      }
      for (let rank = 2; rank <= 5; rank += 1) {
        const rankId = `${aspect.id}${rank}`;
        const rankItem = shopRecords.get(rankId);
        if (
          rankItem === undefined ||
          quotedField(rankItem.source, "TraitUpgrade") !== aspect.id ||
          quotedField(rankItem.source, "WeaponName") !== family.id ||
          !/\bCost\s*=\s*\{/u.test(rankItem.source)
        ) {
          issues.push({
            code: "missing-rank-shop-item",
            recordId: rankId,
            detail: `Rank shop item is missing or is not bound to ${aspect.id} and ${family.id}.`,
          });
        } else {
          rankShopItemCount += 1;
        }
      }
    }
  }
  if (baseAspectIds.length !== weaponFamilies.length) {
    issues.push({
      code: "invalid-aspect-count",
      recordId: "base-aspects",
      detail: `Expected six base aspects without unlock shop items, found ${baseAspectIds.length}.`,
    });
  }

  const hammers: WeaponSourceAuditRecord[] = [];
  for (const [index, family] of weaponFamilies.entries()) {
    const hammerSource = hammerSources[index];
    if (hammerSource === undefined) {
      throw new Error(`Hammer source was not loaded for ${family.id}.`);
    }
    const records = luaRecords(hammerSource, /\bOverwriteTableKeys\s*\(\s*TraitData\s*,/u);
    recordsById(records, issues);
    const familyHammers = records.filter(
      (record) =>
        record.id !== family.hammerRoot &&
        new RegExp(`\\b${family.hammerRoot}\\b`, "u").test(record.source),
    );
    if (familyHammers.length === 0) {
      issues.push({
        code: "missing-hammer-family",
        recordId: family.id,
        detail: `No Hammer records inherit from ${family.hammerRoot}.`,
      });
    }
    for (const hammer of familyHammers) {
      hammers.push(auditRecord(hammer, family.id, localization, issues));
    }
  }

  const vocabulary = auditExtractionVocabulary(
    [aspectSource, ...hammerSources],
    issues,
  );
  return {
    schema: "neodes2-weapon-source-audit-1",
    sourceAcquisitionDirectory: acquisitionDirectory,
    weaponIds: weaponFamilies.map((family) => family.id),
    aspects: aspects.sort((left, right) => compareStrings(left.id, right.id)),
    hammers: hammers.sort((left, right) => compareStrings(left.id, right.id)),
    baseAspectIds: baseAspectIds.sort(compareStrings),
    rankShopItemCount,
    extractionFormats: vocabulary.formats,
    extractionBaseTypes: vocabulary.baseTypes,
    issues: issues.sort(
      (left, right) =>
        compareStrings(left.recordId, right.recordId) || compareStrings(left.code, right.code),
    ),
    complete: issues.length === 0,
  };
}

export function renderWeaponSourceAudit(audit: WeaponSourceAudit): string {
  const lines = [
    "# Weapon source audit",
    "",
    `- Complete: ${audit.complete}`,
    `- Weapons: ${audit.weaponIds.length}`,
    `- Aspects: ${audit.aspects.length}`,
    `- Base aspects: ${audit.baseAspectIds.length}`,
    `- Rank shop items: ${audit.rankShopItemCount}`,
    `- Hammers: ${audit.hammers.length}`,
    `- Issues: ${audit.issues.length}`,
    "",
    "## Extraction vocabulary",
    "",
    `- Formats: ${audit.extractionFormats.join(", ") || "none"}`,
    `- Base types: ${audit.extractionBaseTypes.join(", ") || "none"}`,
  ];
  if (audit.issues.length > 0) {
    lines.push("", "## Issues", "");
    for (const issue of audit.issues) {
      lines.push(`- ${issue.recordId} [${issue.code}]: ${issue.detail}`);
    }
  }
  return `${lines.join("\n")}\n`;
}
