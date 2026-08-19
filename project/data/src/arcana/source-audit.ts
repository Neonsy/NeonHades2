import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const supportedFormats = new Set([
  "FlatHeal",
  "FlatPercentDelta",
  "LuckModifiedPercent",
  "NegativePercentDelta",
  "Percent",
  "PercentDelta",
  "PercentOfBase",
]);

const supportedBaseTypes = new Set(["HeroData", "MetaUpgradeRequirement", "Weapon"]);

interface LuaRecord {
  readonly id: string;
  readonly source: string;
}

interface LocalizationRecord {
  readonly displayName?: string;
  readonly description?: string;
}

export interface ArcanaSourceAuditIssue {
  readonly code:
    | "duplicate-card"
    | "invalid-card-count"
    | "invalid-grasp-progression"
    | "invalid-rank-costs"
    | "missing-auto-activation-text"
    | "missing-card-data"
    | "missing-description"
    | "missing-trait"
    | "tooltip-value-without-extractor"
    | "trait-reference-mismatch"
    | "unlock-model-missing"
    | "unsupported-base-type"
    | "unsupported-format";
  readonly recordId: string;
  readonly detail: string;
}

export interface ArcanaSourceAuditRecord {
  readonly id: string;
  readonly row: number;
  readonly column: number;
  readonly traitId: string;
  readonly graspCost: number;
  readonly automatic: boolean;
  readonly extractIds: readonly string[];
  readonly tooltipExtractIds: readonly string[];
}

export interface ArcanaSourceAudit {
  readonly schema: "neodes2-arcana-source-audit-1";
  readonly sourceAcquisitionDirectory: string;
  readonly cards: readonly ArcanaSourceAuditRecord[];
  readonly layoutCardIds: readonly string[];
  readonly startingGrasp: number;
  readonly graspLevelCount: number;
  readonly maximumGrasp: number;
  readonly extractionFormats: readonly string[];
  readonly extractionBaseTypes: readonly string[];
  readonly issues: readonly ArcanaSourceAuditIssue[];
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
      } else if (current !== "\n" && current !== "\r") {
        characters[index] = " ";
      }
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
    if (current === "{") {
      depth += 1;
      continue;
    }
    if (current === "}") {
      depth -= 1;
      continue;
    }
    if (depth !== 1 || !/[A-Za-z_]/u.test(current)) continue;
    const idMatch = /^[A-Za-z_][A-Za-z0-9_]*/u.exec(masked.slice(index));
    if (idMatch === null) continue;
    let cursor = index + idMatch[0].length;
    while (/\s/u.test(masked[cursor] ?? "")) cursor += 1;
    if (masked[cursor] !== "=") continue;
    cursor += 1;
    while (/\s/u.test(masked[cursor] ?? "")) cursor += 1;
    if (masked[cursor] !== "{") continue;
    const recordEnd = closingBrace(masked, cursor);
    records.push({ id: idMatch[0], source: source.slice(index, recordEnd + 1) });
    index = recordEnd;
  }
  return records;
}

function recordsById(
  records: readonly LuaRecord[],
  issues: ArcanaSourceAuditIssue[],
): ReadonlyMap<string, LuaRecord> {
  const result = new Map<string, LuaRecord>();
  for (const record of records) {
    if (result.has(record.id)) {
      issues.push({
        code: "duplicate-card",
        recordId: record.id,
        detail: "The same top-level Lua record appears more than once.",
      });
    }
    result.set(record.id, record);
  }
  return result;
}

function quotedField(source: string, field: string): string | undefined {
  return new RegExp(`\\b${field}\\s*=\\s*\"((?:\\\\.|[^\"])*)\"`, "u").exec(source)?.[1];
}

function quotedFields(source: string, field: string): readonly string[] {
  const expression = new RegExp(`\\b${field}\\s*=\\s*\"((?:\\\\.|[^\"])*)\"`, "gu");
  return [...source.matchAll(expression)].map((match) => match[1] as string);
}

function numericField(source: string, field: string): number | undefined {
  const text = new RegExp(`\\b${field}\\s*=\\s*(-?[0-9]+(?:\\.[0-9]+)?)`, "u").exec(source)?.[1];
  return text === undefined ? undefined : Number(text);
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

function tooltipExtractIds(description: string | undefined): readonly string[] {
  if (description === undefined) return [];
  return [
    ...new Set(
      [...description.matchAll(/\$TooltipData\.ExtractData\.([A-Za-z0-9_]+)/gu)].map(
        (match) => match[1] as string,
      ),
    ),
  ].sort(compareStrings);
}

function traitReferences(
  description: string | undefined,
): readonly { readonly traitId: string; readonly field: string }[] {
  if (description === undefined) return [];
  return [...description.matchAll(/\$TraitData\.([A-Za-z0-9_]+)\.([A-Za-z0-9_]+)/gu)].map(
    (match) => ({ traitId: match[1] as string, field: match[2] as string }),
  );
}

function cardCost(record: LuaRecord): number | undefined {
  const explicit = numericField(record.source, "Cost");
  if (explicit !== undefined) return explicit;
  if (/\bInheritFrom\s*=\s*\{[^}]*"BaseBonusMetaUpgrade"/u.test(record.source)) return 0;
  if (/\bInheritFrom\s*=\s*\{[^}]*"BaseMetaUpgrade"/u.test(record.source)) return 1;
  return undefined;
}

function hasField(source: string, field: string): boolean {
  return new RegExp(`\\b${field}\\s*=`, "u").test(source);
}

function auditUnlockLogic(source: string): boolean {
  return [
    "function HasNeighboringUnlockedCards",
    "column - 1",
    "column + 1",
    "row + 1",
    "row - 1",
    "row == 1 and column == 1",
    "GameState.MetaUpgradeCardLayout[ cardACoord.Row ][ cardACoord.Column ]",
  ].every((marker) => source.includes(marker));
}

export async function auditArcanaSources(
  sourceAcquisitionDirectory: string,
): Promise<ArcanaSourceAudit> {
  const acquisitionDirectory = resolve(sourceAcquisitionDirectory);
  const scripts = join(acquisitionDirectory, "sources", "Content", "Scripts");
  const text = join(acquisitionDirectory, "sources", "Content", "Game", "Text", "en");
  const [metaSource, traitSource, screenLogicSource, localizationSource] = await Promise.all([
    readFile(join(scripts, "MetaUpgradeData.lua"), "utf8"),
    readFile(join(scripts, "TraitData_MetaUpgrade.lua"), "utf8"),
    readFile(join(scripts, "MetaUpgradeCardScreenLogic.lua"), "utf8"),
    readFile(join(text, "TraitText.en.sjson"), "utf8"),
  ]);
  const issues: ArcanaSourceAuditIssue[] = [];
  const layoutSource = tableSource(metaSource, /\bMetaUpgradeDefaultCardLayout\s*=/u);
  const layoutCardIds = [...layoutSource.matchAll(/"([A-Za-z_][A-Za-z0-9_]*)"/gu)].map(
    (match) => match[1] as string,
  );
  if (layoutCardIds.length !== 25 || new Set(layoutCardIds).size !== 25) {
    issues.push({
      code: "invalid-card-count",
      recordId: "MetaUpgradeDefaultCardLayout",
      detail: `Expected 25 unique default-layout cards, found ${layoutCardIds.length}.`,
    });
  }
  const cardRecords = recordsById(luaRecords(metaSource, /\bMetaUpgradeCardData\s*=/u), issues);
  const traitRecords = recordsById(
    luaRecords(traitSource, /\bTraitSetData\.MetaUpgrade\s*=/u),
    issues,
  );
  const localization = localizationRecords(localizationSource);
  const cards: ArcanaSourceAuditRecord[] = [];
  const traitSources: string[] = [];

  for (const [index, id] of layoutCardIds.entries()) {
    const record = cardRecords.get(id);
    if (record === undefined) {
      issues.push({
        code: "missing-card-data",
        recordId: id,
        detail: "Default-layout card is absent from MetaUpgradeCardData.",
      });
      continue;
    }
    const traitId = quotedField(record.source, "TraitName");
    const cost = cardCost(record);
    const automatic = hasField(record.source, "AutoEquipRequirements");
    if (traitId === undefined || cost === undefined) {
      issues.push({
        code: "missing-card-data",
        recordId: id,
        detail: "Card has no resolvable TraitName or Grasp cost.",
      });
      continue;
    }
    if ((record.source.match(/\bCardUpgradePoints\s*=/gu) ?? []).length !== 2) {
      issues.push({
        code: "invalid-rank-costs",
        recordId: id,
        detail: "Card must declare two rank upgrade costs.",
      });
    }
    if (!hasField(record.source, "ResourceCost")) {
      issues.push({
        code: "missing-card-data",
        recordId: id,
        detail: "Card has no unlock ResourceCost.",
      });
    }
    const localized = localization.get(id);
    if (localized?.displayName === undefined || localized.description === undefined) {
      issues.push({
        code: "missing-description",
        recordId: id,
        detail: "Official English card DisplayName or Description is missing.",
      });
    }
    if (automatic) {
      const autoTextId = quotedField(record.source, "AutoEquipText");
      if (autoTextId === undefined || localization.get(autoTextId)?.displayName === undefined) {
        issues.push({
          code: "missing-auto-activation-text",
          recordId: id,
          detail: "Automatic card has no localized activation rule.",
        });
      }
    }
    const traitRecord = traitRecords.get(traitId);
    if (traitRecord === undefined) {
      issues.push({
        code: "missing-trait",
        recordId: id,
        detail: `Card references missing TraitSetData.MetaUpgrade.${traitId}.`,
      });
      continue;
    }
    traitSources.push(traitRecord.source);
    const extractIds = [...new Set(quotedFields(traitRecord.source, "ExtractAs"))].sort(
      compareStrings,
    );
    const tooltipIds = tooltipExtractIds(localized?.description);
    for (const tooltipId of tooltipIds) {
      if (!extractIds.includes(tooltipId)) {
        issues.push({
          code: "tooltip-value-without-extractor",
          recordId: id,
          detail: `Description references ${tooltipId}, but ${traitId} has no matching ExtractAs.`,
        });
      }
    }
    for (const reference of traitReferences(localized?.description)) {
      if (reference.traitId !== traitId || !hasField(traitRecord.source, reference.field)) {
        issues.push({
          code: "trait-reference-mismatch",
          recordId: id,
          detail: `Description reference ${reference.traitId}.${reference.field} is not owned by the card trait.`,
        });
      }
    }
    cards.push({
      id,
      row: Math.floor(index / 5) + 1,
      column: (index % 5) + 1,
      traitId,
      graspCost: cost,
      automatic,
      extractIds,
      tooltipExtractIds: tooltipIds,
    });
  }

  const costSource = tableSource(metaSource, /\bMetaUpgradeCostData\s*=/u);
  const startingGrasp = numericField(costSource, "StartingMetaUpgradeLimit") ?? 0;
  const increases = [...costSource.matchAll(/\bCostIncrease\s*=\s*([0-9]+(?:\.[0-9]+)?)/gu)].map(
    (match) => Number(match[1]),
  );
  const graspLevelCount = increases.length;
  const maximumGrasp = increases.reduce((total, increase) => total + increase, startingGrasp);
  if (
    !Number.isSafeInteger(startingGrasp) ||
    startingGrasp <= 0 ||
    graspLevelCount === 0 ||
    increases.some((increase) => !Number.isSafeInteger(increase) || increase <= 0) ||
    (costSource.match(/\bResourceCost\s*=/gu) ?? []).length !== graspLevelCount
  ) {
    issues.push({
      code: "invalid-grasp-progression",
      recordId: "MetaUpgradeCostData",
      detail: "Grasp starting capacity, increases, or level costs are incomplete.",
    });
  }
  if (localization.get("IncreaseMetaUpgradeCard")?.description === undefined) {
    issues.push({
      code: "missing-description",
      recordId: "IncreaseMetaUpgradeCard",
      detail: "Official English Grasp name or description is missing.",
    });
  }
  if (!auditUnlockLogic(screenLogicSource)) {
    issues.push({
      code: "unlock-model-missing",
      recordId: "MetaUpgradeCardScreenLogic",
      detail: "Orthogonal-neighbor reveal or unlocked-card layout mutation logic was not found.",
    });
  }

  const extractionFormats = [
    ...new Set(traitSources.flatMap((source) => quotedFields(source, "Format"))),
  ].sort(compareStrings);
  const extractionBaseTypes = [
    ...new Set(traitSources.flatMap((source) => quotedFields(source, "BaseType"))),
  ].sort(compareStrings);
  for (const format of extractionFormats) {
    if (!supportedFormats.has(format)) {
      issues.push({
        code: "unsupported-format",
        recordId: format,
        detail: `Runtime sampling does not declare extraction format ${format}.`,
      });
    }
  }
  for (const baseType of extractionBaseTypes) {
    if (!supportedBaseTypes.has(baseType)) {
      issues.push({
        code: "unsupported-base-type",
        recordId: baseType,
        detail: `Runtime sampling does not declare base type ${baseType}.`,
      });
    }
  }

  return {
    schema: "neodes2-arcana-source-audit-1",
    sourceAcquisitionDirectory: acquisitionDirectory,
    cards: cards.sort((left, right) => compareStrings(left.id, right.id)),
    layoutCardIds,
    startingGrasp,
    graspLevelCount,
    maximumGrasp,
    extractionFormats,
    extractionBaseTypes,
    issues: issues.sort(
      (left, right) =>
        compareStrings(left.recordId, right.recordId) || compareStrings(left.code, right.code),
    ),
    complete: issues.length === 0,
  };
}

export function renderArcanaSourceAudit(audit: ArcanaSourceAudit): string {
  const lines = [
    "# Arcana source audit",
    "",
    `- Complete: ${audit.complete}`,
    `- Arcana Cards: ${audit.cards.length}`,
    `- Automatic Cards: ${audit.cards.filter((card) => card.automatic).length}`,
    `- Starting Grasp: ${audit.startingGrasp}`,
    `- Grasp upgrade levels: ${audit.graspLevelCount}`,
    `- Maximum Grasp: ${audit.maximumGrasp}`,
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
