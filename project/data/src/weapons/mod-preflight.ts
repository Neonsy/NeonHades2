import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { auditWeaponSources, type WeaponSourceAudit } from "./source-audit.js";

export interface WeaponExporterPreflightIssue {
  readonly code:
    | "forbidden-player-state-access"
    | "fatal-error-propagation"
    | "lua-structure"
    | "manifest-version-mismatch"
    | "missing-base-type-handler"
    | "missing-format-handler"
    | "missing-runtime-schema";
  readonly file: string;
  readonly detail: string;
}

export interface WeaponExporterPreflight {
  readonly schema: "neodes2-weapon-exporter-preflight-1";
  readonly exporterVersion: string;
  readonly sourceAudit: WeaponSourceAudit;
  readonly issues: readonly WeaponExporterPreflightIssue[];
  readonly complete: boolean;
}

interface MaskedLua {
  readonly masked: string;
  readonly tokens: readonly string[];
}

function maskAndTokenizeLua(source: string): MaskedLua {
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
  if (quote !== undefined || blockComment) {
    throw new Error("Lua source ends inside a string or block comment.");
  }
  const masked = characters.join("");
  return {
    masked,
    tokens: [...masked.matchAll(/[A-Za-z_][A-Za-z0-9_]*|[()[\]{}]/gu)].map(
      (match) => match[0],
    ),
  };
}

export function validateLuaStructure(source: string): readonly string[] {
  const { tokens } = maskAndTokenizeLua(source);
  const brackets: string[] = [];
  const blocks: ("end" | "until")[] = [];
  let pendingDo = 0;
  const errors: string[] = [];
  const closing: Readonly<Record<string, string>> = { ")": "(", "]": "[", "}": "{" };

  for (const token of tokens) {
    if (token === "(" || token === "[" || token === "{") {
      brackets.push(token);
    } else if (token === ")" || token === "]" || token === "}") {
      if (brackets.pop() !== closing[token]) {
        errors.push(`Unbalanced ${token}.`);
      }
    } else if (token === "function" || token === "if") {
      blocks.push("end");
    } else if (token === "for" || token === "while") {
      blocks.push("end");
      pendingDo += 1;
    } else if (token === "do") {
      if (pendingDo > 0) {
        pendingDo -= 1;
      } else {
        blocks.push("end");
      }
    } else if (token === "repeat") {
      blocks.push("until");
    } else if (token === "end" || token === "until") {
      const expected = blocks.pop();
      if (expected !== token) {
        errors.push(`Unexpected ${token}, expected ${expected ?? "no closing keyword"}.`);
      }
    }
  }
  if (brackets.length > 0) {
    errors.push(`Unclosed bracket ${brackets.at(-1)}.`);
  }
  if (blocks.length > 0) {
    errors.push(`Unclosed Lua block expecting ${blocks.at(-1)}.`);
  }
  if (pendingDo > 0) {
    errors.push("A for or while statement has no do keyword.");
  }
  return errors;
}

function literalBranch(source: string, field: "base_type" | "format", value: string): boolean {
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return new RegExp(`\\b${field}\\s*==\\s*\"${escaped}\"`, "u").test(source);
}

export async function preflightWeaponExporter(
  modDirectory: string,
  sourceAcquisitionDirectory: string,
): Promise<WeaponExporterPreflight> {
  const resolvedModDirectory = resolve(modDirectory);
  const [mainSource, weaponsSource, manifestSource, sourceAudit] = await Promise.all([
    readFile(join(resolvedModDirectory, "main.lua"), "utf8"),
    readFile(join(resolvedModDirectory, "weapons.lua"), "utf8"),
    readFile(join(resolvedModDirectory, "manifest.json"), "utf8"),
    auditWeaponSources(sourceAcquisitionDirectory),
  ]);
  const manifest: unknown = JSON.parse(manifestSource);
  if (typeof manifest !== "object" || manifest === null || Array.isArray(manifest)) {
    throw new Error("Exporter manifest must be an object.");
  }
  const version = /^local EXPORTER_VERSION\s*=\s*"([^"]+)"/mu.exec(mainSource)?.[1];
  if (version === undefined) {
    throw new Error("main.lua does not declare EXPORTER_VERSION.");
  }
  const issues: WeaponExporterPreflightIssue[] = [];
  if (mainSource.includes("rom.log.error")) {
    issues.push({
      code: "fatal-error-propagation",
      file: "main.lua",
      detail: "Exporter failures must not call rom.log.error because it raises into game loading.",
    });
  }
  for (const [file, source] of [
    ["main.lua", mainSource],
    ["weapons.lua", weaponsSource],
  ] as const) {
    for (const detail of validateLuaStructure(source)) {
      issues.push({ code: "lua-structure", file, detail });
    }
    const masked = maskAndTokenizeLua(source).masked;
    for (const forbidden of [
      "CurrentRun",
      "GameState",
      "HeroHasTrait",
      "GetHeroTrait",
      "GetTotalHeroTraitValue",
      "CalculateHealingMultiplier",
    ]) {
      if (new RegExp(`\\b${forbidden}\\b`, "u").test(masked)) {
        issues.push({
          code: "forbidden-player-state-access",
          file,
          detail: `Exporter code accesses ${forbidden}.`,
        });
      }
    }
  }
  const manifestVersion = (manifest as Readonly<Record<string, unknown>>).version_number;
  if (manifestVersion !== version) {
    issues.push({
      code: "manifest-version-mismatch",
      file: "manifest.json",
      detail: `Manifest version ${String(manifestVersion)} does not match ${version}.`,
    });
  }
  if (!mainSource.includes('"neodes2-weapon-runtime-manifest-1"') ||
      !weaponsSource.includes('schema = "neodes2-weapon-runtime-1"')) {
    issues.push({
      code: "missing-runtime-schema",
      file: "main.lua or weapons.lua",
      detail: "Weapon runtime report or finalization schema is absent.",
    });
  }
  for (const format of sourceAudit.extractionFormats) {
    if (!literalBranch(mainSource, "format", format)) {
      issues.push({
        code: "missing-format-handler",
        file: "main.lua",
        detail: `No deterministic sample handler exists for ${format}.`,
      });
    }
  }
  for (const baseType of sourceAudit.extractionBaseTypes) {
    if (!literalBranch(mainSource, "base_type", baseType)) {
      issues.push({
        code: "missing-base-type-handler",
        file: "main.lua",
        detail: `No static base-data handler exists for ${baseType}.`,
      });
    }
  }
  if (!sourceAudit.complete) {
    issues.push({
      code: "missing-runtime-schema",
      file: "source acquisition",
      detail: "The authoritative static weapon source audit is incomplete.",
    });
  }
  return {
    schema: "neodes2-weapon-exporter-preflight-1",
    exporterVersion: version,
    sourceAudit,
    issues,
    complete: issues.length === 0,
  };
}
