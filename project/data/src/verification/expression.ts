export type FormulaValue = boolean | number | string;

interface FormulaToken {
  readonly kind: "identifier" | "number" | "operator" | "symbol";
  readonly value: string;
}

type FormulaNode =
  | { readonly kind: "binary"; readonly operator: "+" | "-" | "*" | "/" | "~=" | "and" | "or"; readonly left: FormulaNode; readonly right: FormulaNode }
  | { readonly kind: "call"; readonly name: string; readonly arguments: readonly FormulaNode[] }
  | { readonly kind: "identifier"; readonly name: string }
  | { readonly kind: "number"; readonly value: number }
  | { readonly kind: "unary"; readonly operand: FormulaNode };

function tokens(expression: string): readonly FormulaToken[] {
  const output: FormulaToken[] = [];
  let index = 0;
  while (index < expression.length) {
    const rest = expression.slice(index);
    const whitespace = /^\s+/u.exec(rest);
    if (whitespace !== null) {
      index += whitespace[0].length;
      continue;
    }
    const number = /^(?:\d+(?:\.\d*)?|\.\d+)/u.exec(rest);
    if (number !== null) {
      output.push({ kind: "number", value: number[0] });
      index += number[0].length;
      continue;
    }
    const identifier = /^[A-Za-z_][A-Za-z0-9_:]*/u.exec(rest);
    if (identifier !== null) {
      const value = identifier[0];
      output.push({ kind: value === "and" || value === "or" ? "operator" : "identifier", value });
      index += value.length;
      continue;
    }
    if (rest.startsWith("~=")) {
      output.push({ kind: "operator", value: "~=" });
      index += 2;
      continue;
    }
    const symbol = rest[0];
    if (symbol !== undefined && "+-*/(),".includes(symbol)) {
      output.push({ kind: "+-*/".includes(symbol) ? "operator" : "symbol", value: symbol });
      index += 1;
      continue;
    }
    throw new Error(`Unsupported formula token near ${JSON.stringify(rest.slice(0, 24))}.`);
  }
  return output;
}

class FormulaParser {
  readonly #tokens: readonly FormulaToken[];
  #index = 0;

  constructor(expression: string) {
    this.#tokens = tokens(expression);
  }

  #peek(value?: string): FormulaToken | undefined {
    const token = this.#tokens[this.#index];
    return value === undefined || token?.value === value ? token : undefined;
  }

  #take(value?: string): FormulaToken {
    const token = this.#peek(value);
    if (token === undefined) throw new Error(`Expected ${value ?? "formula token"}.`);
    this.#index += 1;
    return token;
  }

  #primary(): FormulaNode {
    const token = this.#peek();
    if (token?.kind === "number") {
      this.#take();
      return { kind: "number", value: Number(token.value) };
    }
    if (token?.kind === "identifier") {
      this.#take();
      if (this.#peek("(") === undefined) return { kind: "identifier", name: token.value };
      this.#take("(");
      const arguments_: FormulaNode[] = [];
      while (this.#peek(")") === undefined) {
        arguments_.push(this.#or());
        if (this.#peek(",") === undefined) break;
        this.#take(",");
      }
      this.#take(")");
      return { kind: "call", name: token.value, arguments: arguments_ };
    }
    if (this.#peek("(") !== undefined) {
      this.#take("(");
      const node = this.#or();
      this.#take(")");
      return node;
    }
    throw new Error("Expected a formula value.");
  }

  #unary(): FormulaNode {
    if (this.#peek("-") !== undefined) {
      this.#take("-");
      return { kind: "unary", operand: this.#unary() };
    }
    return this.#primary();
  }

  #binary(next: () => FormulaNode, operators: ReadonlySet<string>): FormulaNode {
    let node = next();
    while (this.#peek()?.kind === "operator" && operators.has(this.#peek()!.value)) {
      const operator = this.#take().value as "+" | "-" | "*" | "/" | "~=" | "and" | "or";
      node = { kind: "binary", operator, left: node, right: next() };
    }
    return node;
  }

  #multiply(): FormulaNode {
    return this.#binary(() => this.#unary(), new Set(["*", "/"]));
  }

  #add(): FormulaNode {
    return this.#binary(() => this.#multiply(), new Set(["+", "-"]));
  }

  #compare(): FormulaNode {
    return this.#binary(() => this.#add(), new Set(["~="]));
  }

  #and(): FormulaNode {
    return this.#binary(() => this.#compare(), new Set(["and"]));
  }

  #or(): FormulaNode {
    return this.#binary(() => this.#and(), new Set(["or"]));
  }

  parse(): FormulaNode {
    const node = this.#or();
    if (this.#peek() !== undefined) throw new Error(`Unexpected formula token ${this.#peek()!.value}.`);
    return node;
  }
}

function numberValue(value: FormulaValue, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${label} must be a finite number.`);
  return value;
}

function truthy(value: FormulaValue): boolean {
  return value !== false;
}

function gameRound(value: number, precision: number): number {
  const scale = 10 ** precision;
  return Math.floor(value * scale + 0.5) / scale;
}

function evaluate(node: FormulaNode, context: Readonly<Record<string, FormulaValue>>): FormulaValue {
  if (node.kind === "number") return node.value;
  if (node.kind === "identifier") {
    const value = context[node.name];
    if (value === undefined) throw new Error(`Formula input ${node.name} is missing.`);
    return value;
  }
  if (node.kind === "unary") return -numberValue(evaluate(node.operand, context), "Unary operand");
  if (node.kind === "binary") {
    const left = evaluate(node.left, context);
    if (node.operator === "and") return truthy(left) ? evaluate(node.right, context) : left;
    if (node.operator === "or") return truthy(left) ? left : evaluate(node.right, context);
    const right = evaluate(node.right, context);
    if (node.operator === "~=") return left !== right;
    const leftNumber = numberValue(left, "Left arithmetic operand");
    const rightNumber = numberValue(right, "Right arithmetic operand");
    if (node.operator === "+") return leftNumber + rightNumber;
    if (node.operator === "-") return leftNumber - rightNumber;
    if (node.operator === "*") return leftNumber * rightNumber;
    return leftNumber / rightNumber;
  }
  const arguments_ = node.arguments.map((argument) => evaluate(argument, context));
  if (node.name === "abs" && arguments_.length === 1) return Math.abs(numberValue(arguments_[0]!, "abs argument"));
  if (node.name === "min" && arguments_.length >= 1) return Math.min(...arguments_.map((value) => numberValue(value, "min argument")));
  if (node.name === "max" && arguments_.length >= 1) return Math.max(...arguments_.map((value) => numberValue(value, "max argument")));
  if (node.name === "round" && arguments_.length === 2) {
    const precision = numberValue(arguments_[1]!, "round precision");
    if (!Number.isSafeInteger(precision) || precision < 0) throw new Error("round precision must be a nonnegative integer.");
    return gameRound(numberValue(arguments_[0]!, "round value"), precision);
  }
  throw new Error(`Unsupported formula function ${node.name}.`);
}

export function evaluateFormula(expression: string, context: Readonly<Record<string, FormulaValue>>): FormulaValue {
  const value = evaluate(new FormulaParser(expression).parse(), context);
  if (typeof value === "number" && !Number.isFinite(value)) throw new Error("Formula result is not finite.");
  return value;
}
