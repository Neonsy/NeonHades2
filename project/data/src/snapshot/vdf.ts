export type VdfValue = string | VdfObject;

export interface VdfObject {
  readonly [key: string]: VdfValue;
}

type Token =
  | { readonly kind: "text"; readonly value: string }
  | { readonly kind: "open" }
  | { readonly kind: "close" };

function tokenize(source: string): readonly Token[] {
  const tokens: Token[] = [];
  let index = 0;

  while (index < source.length) {
    const character = source[index];

    if (character === undefined) {
      break;
    }

    if (/\s/u.test(character)) {
      index += 1;
      continue;
    }

    if (character === "/" && source[index + 1] === "/") {
      index += 2;
      while (index < source.length && source[index] !== "\n") {
        index += 1;
      }
      continue;
    }

    if (character === "{") {
      tokens.push({ kind: "open" });
      index += 1;
      continue;
    }

    if (character === "}") {
      tokens.push({ kind: "close" });
      index += 1;
      continue;
    }

    if (character === '"') {
      let value = "";
      let closed = false;
      index += 1;

      while (index < source.length) {
        const current = source[index];

        if (current === undefined) {
          break;
        }

        if (current === '"') {
          index += 1;
          tokens.push({ kind: "text", value });
          closed = true;
          break;
        }

        if (current === "\\") {
          const escaped = source[index + 1];

          if (escaped === "\\" || escaped === '"') {
            value += escaped;
            index += 2;
            continue;
          }
        }

        value += current;
        index += 1;
      }

      if (!closed) {
        throw new Error("Unterminated quoted value in Valve KeyValues input.");
      }

      continue;
    }

    let value = "";
    while (index < source.length) {
      const current = source[index];
      if (current === undefined || /\s/u.test(current) || current === "{" || current === "}") {
        break;
      }
      value += current;
      index += 1;
    }

    if (value === "") {
      throw new Error(`Unexpected character at offset ${index}.`);
    }

    tokens.push({ kind: "text", value });
  }

  return tokens;
}

function parseObject(
  tokens: readonly Token[],
  start: number,
  expectsClosingBrace: boolean,
): readonly [VdfObject, number] {
  const result: Record<string, VdfValue> = {};
  let index = start;

  while (index < tokens.length) {
    const key = tokens[index];

    if (key?.kind === "close") {
      if (!expectsClosingBrace) {
        throw new Error("Unexpected closing brace in Valve KeyValues input.");
      }
      return [result, index + 1];
    }

    if (key?.kind !== "text") {
      throw new Error("Expected a Valve KeyValues key.");
    }

    if (Object.hasOwn(result, key.value)) {
      throw new Error(`Duplicate Valve KeyValues key: ${key.value}`);
    }

    const value = tokens[index + 1];
    if (value?.kind === "text") {
      result[key.value] = value.value;
      index += 2;
      continue;
    }

    if (value?.kind === "open") {
      const [child, next] = parseObject(tokens, index + 2, true);
      result[key.value] = child;
      index = next;
      continue;
    }

    throw new Error(`Expected a value for Valve KeyValues key: ${key.value}`);
  }

  if (expectsClosingBrace) {
    throw new Error("Unclosed object in Valve KeyValues input.");
  }

  return [result, index];
}

export function parseValveKeyValues(source: string): VdfObject {
  const tokens = tokenize(source);
  const [result, next] = parseObject(tokens, 0, false);

  if (next !== tokens.length) {
    throw new Error("Unexpected trailing Valve KeyValues input.");
  }

  return result;
}

export function isVdfObject(value: VdfValue | undefined): value is VdfObject {
  return typeof value === "object" && value !== null;
}

export function requireVdfObject(parent: VdfObject, key: string): VdfObject {
  const value = parent[key];
  if (!isVdfObject(value)) {
    throw new Error(`Valve KeyValues object is missing: ${key}`);
  }
  return value;
}

export function requireVdfString(parent: VdfObject, key: string): string {
  const value = parent[key];
  if (typeof value !== "string" || value === "") {
    throw new Error(`Valve KeyValues string is missing: ${key}`);
  }
  return value;
}
