import { posix } from "node:path";

import type { AcquisitionContract } from "../contract/index.js";

const supportedExtensions = new Set([".lua", ".sjson"]);
const forbiddenDirectories = new Set(["audio", "movies", "packages", "saves"]);

export interface SourcePolicyRule {
  readonly directory: string;
  readonly extension: ".lua" | ".sjson";
  readonly files: "all" | readonly string[];
}

export interface SourcePolicy {
  readonly schema: "neodes2-source-policy-1";
  readonly rules: readonly SourcePolicyRule[];
}

export const sourcePolicy = {
  schema: "neodes2-source-policy-1",
  rules: [
    { directory: "Content/Scripts", extension: ".lua", files: "all" },
    { directory: "Content/Game/Text/en", extension: ".sjson", files: "all" },
    { directory: "Content/Game/Projectiles", extension: ".sjson", files: "all" },
    { directory: "Content/Game/Units", extension: ".sjson", files: ["Enemies.sjson"] },
    { directory: "Content/Game/Weapons", extension: ".sjson", files: "all" },
  ],
} as const satisfies SourcePolicy;

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertSafeRelativePath(value: string, label: string): void {
  if (
    value === "" ||
    value.startsWith("/") ||
    value.includes("\\") ||
    value.split("/").some((part) => part === "" || part === "." || part === "..")
  ) {
    throw new Error(`${label} must be a normalized relative path.`);
  }
}

export function validateSourcePolicy(value: unknown): SourcePolicy {
  if (!isRecord(value) || value.schema !== "neodes2-source-policy-1") {
    throw new Error("Unknown source policy schema.");
  }

  if (!Array.isArray(value.rules) || value.rules.length === 0) {
    throw new Error("Source policy must contain at least one rule.");
  }

  const directories = new Set<string>();
  const rules: SourcePolicyRule[] = value.rules.map((candidate, index) => {
    if (!isRecord(candidate)) {
      throw new Error(`Source policy rule ${index} must be an object.`);
    }

    const directory = candidate.directory;
    const extension = candidate.extension;
    const files = candidate.files;

    if (typeof directory !== "string") {
      throw new Error(`Source policy rule ${index} is missing its directory.`);
    }
    assertSafeRelativePath(directory, `Source policy directory ${index}`);

    if (directories.has(directory.toLowerCase())) {
      throw new Error(`Duplicate source policy directory: ${directory}`);
    }
    directories.add(directory.toLowerCase());

    if (typeof extension !== "string" || !supportedExtensions.has(extension)) {
      throw new Error(`Forbidden source file class in policy rule ${index}.`);
    }

    if (
      directory
        .toLowerCase()
        .split("/")
        .some((part) => forbiddenDirectories.has(part))
    ) {
      throw new Error(`Forbidden source directory in policy rule ${index}.`);
    }

    if (files !== "all" && !Array.isArray(files)) {
      throw new Error(`Source policy rule ${index} has an invalid file selector.`);
    }

    if (Array.isArray(files)) {
      if (files.length === 0) {
        throw new Error(`Source policy rule ${index} has no named files.`);
      }

      for (const file of files) {
        if (typeof file !== "string") {
          throw new Error(`Source policy rule ${index} has a non-string filename.`);
        }
        assertSafeRelativePath(file, `Source policy filename ${index}`);
        if (file.includes("/") || posix.extname(file).toLowerCase() !== extension) {
          throw new Error(`Source policy rule ${index} has a forbidden filename.`);
        }
      }
    }

    return {
      directory,
      extension: extension as SourcePolicyRule["extension"],
      files: files === "all" ? "all" : [...files] as readonly string[],
    };
  });

  return { schema: "neodes2-source-policy-1", rules };
}

export function getRequiredContractSourcePatterns(
  contract: AcquisitionContract,
): readonly string[] {
  const patterns = new Set<string>();

  for (const domain of contract.domains) {
    for (const record of domain.records) {
      for (const pattern of record.sourcePatterns) {
        if (pattern.startsWith("Content/")) {
          patterns.add(pattern);
        }
      }

      for (const field of record.fields) {
        for (const pattern of field.sourcePatterns) {
          if (pattern.startsWith("Content/")) {
            patterns.add(pattern);
          }
        }
      }
    }
  }

  const result = [...patterns].sort();
  for (const pattern of result) {
    assertSafeRelativePath(pattern, "Contract source pattern");
    const extension = posix.extname(pattern).toLowerCase();
    if (!supportedExtensions.has(extension)) {
      throw new Error(`Contract source pattern has a forbidden file class: ${pattern}`);
    }
  }

  return result;
}

function escapeRegularExpression(character: string): string {
  return /[\\^$.*+?()[\]{}|]/u.test(character) ? `\\${character}` : character;
}

export function matchesSourcePattern(relativePath: string, pattern: string): boolean {
  let expression = "^";

  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index];
    if (character === "*" && pattern[index + 1] === "*") {
      if (pattern[index + 2] === "/") {
        expression += "(?:.*/)?";
        index += 2;
      } else {
        expression += ".*";
        index += 1;
      }
      continue;
    }

    if (character === "*") {
      expression += "[^/]*";
      continue;
    }

    if (character === "?") {
      expression += "[^/]";
      continue;
    }

    if (character === undefined) {
      break;
    }
    expression += escapeRegularExpression(character);
  }

  expression += "$";
  return new RegExp(expression, "u").test(relativePath);
}
