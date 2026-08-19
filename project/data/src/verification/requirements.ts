import type { JsonValue } from "../boons/index.js";
import type { CombinedDataset } from "../dataset/index.js";
import type { RuntimeGuideRecord } from "../guide/index.js";

export type RequirementReferencePolarity = "negative" | "positive";

export interface RequirementReference {
  readonly path: string;
  readonly targetId: string;
  readonly polarity: RequirementReferencePolarity;
  readonly ownerRequirementId: string | null;
}

export interface RequirementGraphNode {
  readonly id: string;
  readonly runtimePath: string;
  readonly directDependencies: readonly {
    readonly id: string;
    readonly polarity: RequirementReferencePolarity;
  }[];
  readonly transitiveDependencyIds: readonly string[];
  readonly usageCount: number;
}

export interface RequirementGraphIssue {
  readonly code: "cycle" | "invalid-reference" | "unresolved-reference";
  readonly path: string;
  readonly detail: string;
}

export interface RequirementGraph {
  readonly schema: "neodes2-requirement-graph-1";
  readonly sourceDatasetAcquisitionId: string;
  readonly nodes: readonly RequirementGraphNode[];
  readonly references: readonly RequirementReference[];
  readonly cycles: readonly (readonly string[])[];
  readonly issues: readonly RequirementGraphIssue[];
  readonly complete: boolean;
}

const referenceKeys = {
  NamedRequirements: "positive",
  NamedRequirementsFalse: "negative",
} as const satisfies Readonly<Record<string, RequirementReferencePolarity>>;

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function childPath(path: string, key: string | number): string {
  if (typeof key === "number") return `${path}[${key}]`;
  return /^[A-Za-z_][A-Za-z0-9_]*$/u.test(key) ? `${path}.${key}` : `${path}[${JSON.stringify(key)}]`;
}

function referencedIds(value: JsonValue): readonly string[] | null {
  if (typeof value === "string") return [value];
  if (Array.isArray(value) && value.every((entry) => typeof entry === "string")) return value;
  return null;
}

function collectReferences(
  value: JsonValue,
  path: string,
  ownerRequirementId: string | null,
  references: RequirementReference[],
  issues: RequirementGraphIssue[],
): void {
  if (value === null || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((entry, index) => collectReferences(entry, childPath(path, index), ownerRequirementId, references, issues));
    return;
  }
  for (const [key, entry] of Object.entries(value)) {
    if (entry === undefined) continue;
    const entryPath = childPath(path, key);
    const polarity = referenceKeys[key as keyof typeof referenceKeys];
    if (polarity !== undefined) {
      const ids = referencedIds(entry);
      if (ids === null || ids.some((id) => id.trim() === "")) {
        issues.push({
          code: "invalid-reference",
          path: entryPath,
          detail: `${key} must be a nonempty string or an array of nonempty strings.`,
        });
      } else {
        for (const id of ids) references.push({ path: entryPath, targetId: id, polarity, ownerRequirementId });
      }
    }
    collectReferences(entry, entryPath, ownerRequirementId, references, issues);
  }
}

function requirementCycles(dependencies: ReadonlyMap<string, ReadonlySet<string>>): readonly (readonly string[])[] {
  let nextIndex = 0;
  const indices = new Map<string, number>();
  const lowLinks = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const cycles: string[][] = [];
  const visit = (id: string): void => {
    const index = nextIndex++;
    indices.set(id, index);
    lowLinks.set(id, index);
    stack.push(id);
    onStack.add(id);
    for (const dependency of dependencies.get(id) ?? []) {
      if (!dependencies.has(dependency)) continue;
      if (!indices.has(dependency)) {
        visit(dependency);
        lowLinks.set(id, Math.min(lowLinks.get(id)!, lowLinks.get(dependency)!));
      } else if (onStack.has(dependency)) {
        lowLinks.set(id, Math.min(lowLinks.get(id)!, indices.get(dependency)!));
      }
    }
    if (lowLinks.get(id) !== indices.get(id)) return;
    const component: string[] = [];
    let member: string;
    do {
      member = stack.pop()!;
      onStack.delete(member);
      component.push(member);
    } while (member !== id);
    component.sort(compareStrings);
    if (component.length > 1 || (dependencies.get(id)?.has(id) ?? false)) cycles.push(component);
  };
  for (const id of [...dependencies.keys()].sort(compareStrings)) {
    if (!indices.has(id)) visit(id);
  }
  return cycles.sort((left, right) => compareStrings(left.join("\0"), right.join("\0")));
}

function transitiveDependencies(id: string, dependencies: ReadonlyMap<string, ReadonlySet<string>>): readonly string[] {
  const found = new Set<string>();
  const pending = [...(dependencies.get(id) ?? [])];
  while (pending.length > 0) {
    const dependency = pending.pop()!;
    if (dependency === id || found.has(dependency)) continue;
    found.add(dependency);
    pending.push(...(dependencies.get(dependency) ?? []));
  }
  return [...found].sort(compareStrings);
}

function findRecordOwner(path: string, records: readonly RuntimeGuideRecord[]): string | null {
  for (let index = 0; index < records.length; index += 1) {
    if (path.startsWith(`$.domains.guide.namedRequirements[${index}].data`)) return records[index]!.id;
  }
  return null;
}

export function compileRequirementGraph(dataset: CombinedDataset): RequirementGraph {
  const definitions = dataset.domains.guide.namedRequirements;
  const definitionIds = new Set(definitions.map((record) => record.id));
  const references: RequirementReference[] = [];
  const issues: RequirementGraphIssue[] = [];
  collectReferences(dataset as unknown as JsonValue, "$", null, references, issues);
  const ownedReferences = references.map((reference) => ({
    ...reference,
    ownerRequirementId: findRecordOwner(reference.path, definitions),
  }));
  for (const reference of ownedReferences) {
    if (!definitionIds.has(reference.targetId)) {
      issues.push({
        code: "unresolved-reference",
        path: reference.path,
        detail: `Named requirement ${reference.targetId} is not defined.`,
      });
    }
  }
  const dependencies = new Map(definitions.map((record) => [record.id, new Set<string>()]));
  const direct = new Map(definitions.map((record) => [record.id, new Map<string, RequirementReferencePolarity>()]));
  for (const reference of ownedReferences) {
    if (reference.ownerRequirementId === null) continue;
    dependencies.get(reference.ownerRequirementId)!.add(reference.targetId);
    const existing = direct.get(reference.ownerRequirementId)!.get(reference.targetId);
    if (existing !== undefined && existing !== reference.polarity) {
      issues.push({
        code: "invalid-reference",
        path: reference.path,
        detail: `Named requirement ${reference.targetId} is referenced with both positive and negative polarity.`,
      });
    }
    direct.get(reference.ownerRequirementId)!.set(reference.targetId, reference.polarity);
  }
  const cycles = requirementCycles(dependencies);
  for (const cycle of cycles) {
    issues.push({ code: "cycle", path: cycle.join(" -> "), detail: "Named requirement dependency cycle." });
  }
  const nodes = definitions.map((definition) => ({
    id: definition.id,
    runtimePath: definition.evidence.runtimePath,
    directDependencies: [...direct.get(definition.id)!.entries()]
      .map(([id, polarity]) => ({ id, polarity }))
      .sort((left, right) => compareStrings(left.id, right.id) || compareStrings(left.polarity, right.polarity)),
    transitiveDependencyIds: transitiveDependencies(definition.id, dependencies),
    usageCount: ownedReferences.filter((reference) => reference.targetId === definition.id).length,
  })).sort((left, right) => compareStrings(left.id, right.id));
  ownedReferences.sort(
    (left, right) => compareStrings(left.path, right.path) || compareStrings(left.targetId, right.targetId),
  );
  issues.sort((left, right) => compareStrings(left.path, right.path) || compareStrings(left.code, right.code));
  return {
    schema: "neodes2-requirement-graph-1",
    sourceDatasetAcquisitionId: dataset.source.acquisitionId,
    nodes,
    references: ownedReferences,
    cycles,
    issues,
    complete: issues.length === 0,
  };
}
