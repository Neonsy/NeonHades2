export interface AutomaticPropertyChange {
  readonly operation: "add" | "multiply" | "replace";
  readonly inputId: string;
}

export interface CalculationRules {
  readonly automaticProperties: Readonly<Record<string, AutomaticPropertyChange>>;
  readonly rarityOrder: readonly string[];
}

interface LuaArray extends ReadonlyArray<LuaValue> {}

interface LuaObject {
  readonly [key: string]: LuaValue;
}

type LuaValue = string | number | LuaArray | LuaObject;

interface Token {
  readonly kind: "identifier" | "number" | "string" | "symbol";
  readonly value: string;
}

function tokenize(input: string): readonly Token[] {
  const tokens: Token[] = [];
  let index = 0;
  while (index < input.length) {
    const rest = input.slice(index);
    const whitespace = /^(?:\s+|--[^\r\n]*(?:\r?\n|$))+/u.exec(rest);
    if (whitespace !== null) {
      index += whitespace[0].length;
      continue;
    }
    const string = /^"((?:\\.|[^"\\])*)"/u.exec(rest);
    if (string !== null) {
      tokens.push({ kind: "string", value: JSON.parse(string[0]) as string });
      index += string[0].length;
      continue;
    }
    const identifier = /^[A-Za-z_][A-Za-z0-9_]*/u.exec(rest);
    if (identifier !== null) {
      tokens.push({ kind: "identifier", value: identifier[0] });
      index += identifier[0].length;
      continue;
    }
    const number = /^-?(?:\d+(?:\.\d*)?|\.\d+)/u.exec(rest);
    if (number !== null) {
      tokens.push({ kind: "number", value: number[0] });
      index += number[0].length;
      continue;
    }
    const symbol = rest[0];
    if (symbol !== undefined && "{},=".includes(symbol)) {
      tokens.push({ kind: "symbol", value: symbol });
      index += 1;
      continue;
    }
    throw new Error(`Unsupported Lua table token near ${JSON.stringify(rest.slice(0, 24))}.`);
  }
  return tokens;
}

class LuaTableParser {
  readonly #tokens: readonly Token[];
  #index = 0;

  constructor(tokens: readonly Token[]) {
    this.#tokens = tokens;
  }

  #peek(offset = 0): Token | undefined {
    return this.#tokens[this.#index + offset];
  }

  #take(kind?: Token["kind"], value?: string): Token {
    const token = this.#tokens[this.#index];
    if (token === undefined || (kind !== undefined && token.kind !== kind) || (value !== undefined && token.value !== value)) {
      throw new Error(`Expected ${value ?? kind ?? "Lua token"}.`);
    }
    this.#index += 1;
    return token;
  }

  #value(): LuaValue {
    const token = this.#peek();
    if (token?.kind === "string") return this.#take("string").value;
    if (token?.kind === "number") return Number(this.#take("number").value);
    if (token?.kind === "symbol" && token.value === "{") return this.#table();
    throw new Error("Expected a supported Lua table value.");
  }

  #table(): LuaValue {
    this.#take("symbol", "{");
    const array: LuaValue[] = [];
    const object: Record<string, LuaValue> = {};
    let hasKeys = false;
    let hasValues = false;
    while (this.#peek()?.value !== "}") {
      const token = this.#peek();
      if (token === undefined) throw new Error("Unterminated Lua table.");
      if (token.kind === "identifier" && this.#peek(1)?.value === "=") {
        const key = this.#take("identifier").value;
        this.#take("symbol", "=");
        object[key] = this.#value();
        hasKeys = true;
      } else {
        array.push(this.#value());
        hasValues = true;
      }
      if (this.#peek()?.value === ",") this.#take("symbol", ",");
    }
    this.#take("symbol", "}");
    if (hasKeys && hasValues) throw new Error("Mixed Lua tables are not supported for calculation rules.");
    return hasKeys ? object : array;
  }

  parse(): LuaValue {
    const value = this.#value();
    return value;
  }
}

function assignmentTable(source: string, name: string): LuaValue {
  const pattern = new RegExp(`\\b${name}\\s*=`, "u");
  const match = pattern.exec(source);
  if (match === null) throw new Error(`Game source does not define ${name}.`);
  const start = source.indexOf("{", match.index + match[0].length);
  if (start < 0) throw new Error(`Game source ${name} assignment has no table.`);
  let depth = 0;
  let inString = false;
  let escaped = false;
  let inComment = false;
  for (let index = start; index < source.length; index += 1) {
    const character = source[index]!;
    const next = source[index + 1];
    if (inComment) {
      if (character === "\n") inComment = false;
      continue;
    }
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === "\"") inString = false;
      continue;
    }
    if (character === "-" && next === "-") {
      inComment = true;
      index += 1;
    } else if (character === "\"") {
      inString = true;
    } else if (character === "{") {
      depth += 1;
    } else if (character === "}") {
      depth -= 1;
      if (depth === 0) return new LuaTableParser(tokenize(source.slice(start, index + 1))).parse();
    }
  }
  throw new Error(`Game source ${name} table is unterminated.`);
}

function objectValue(value: LuaValue, label: string): Readonly<Record<string, LuaValue>> {
  if (typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be a keyed Lua table.`);
  return value as LuaObject;
}

export function parseCalculationRules(uiDataSource: string, traitDataSource: string): CalculationRules {
  const automaticTable = objectValue(
    assignmentTable(uiDataSource, "AutomaticExtractProperties"),
    "AutomaticExtractProperties",
  );
  const operationNames = {
    AddHeroValue: "add",
    MultiplyHeroValue: "multiply",
    ReplaceWithHeroValue: "replace",
  } as const;
  const automaticProperties: Record<string, AutomaticPropertyChange> = {};
  for (const [extractAs, rawChange] of Object.entries(automaticTable)) {
    const change = objectValue(rawChange, `AutomaticExtractProperties.${extractAs}`);
    const entries = Object.entries(change);
    if (entries.length !== 1) throw new Error(`AutomaticExtractProperties.${extractAs} must have one operation.`);
    const [operationName, inputId] = entries[0]!;
    const operation = operationNames[operationName as keyof typeof operationNames];
    if (operation === undefined || typeof inputId !== "string" || inputId === "") {
      throw new Error(`AutomaticExtractProperties.${extractAs} has an unsupported operation.`);
    }
    automaticProperties[extractAs] = { operation, inputId };
  }
  const rarityValue = assignmentTable(traitDataSource, "RarityUpgradeOrder");
  if (!Array.isArray(rarityValue) || rarityValue.some((entry) => typeof entry !== "string" || entry === "")) {
    throw new Error("RarityUpgradeOrder must be an array of nonempty strings.");
  }
  return { automaticProperties, rarityOrder: rarityValue as readonly string[] };
}
