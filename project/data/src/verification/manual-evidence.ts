import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { realpath } from "node:fs/promises";

import { readStableRegularFile, type StableFile } from "../boons/runtime-acquisition.js";
import { assertLocalOutputPath } from "../snapshot/index.js";
import type { ManualVerificationKind, ManualVerificationTask } from "./report.js";
import type { ObservationPlan } from "./observation-plan.js";

export type ManualEvidenceOutcome = "pass" | "fail";

export interface ManualEvidenceReference {
  readonly path: string;
  readonly sha256: string;
}

export interface ManualEvidenceEntry {
  readonly id: string;
  readonly taskId: string;
  readonly check: ManualVerificationKind;
  readonly outcome: ManualEvidenceOutcome;
  readonly targetIds: readonly string[];
  readonly evidence: readonly ManualEvidenceReference[];
  readonly note: string;
}

export interface ManualEvidenceLedger {
  readonly schema: "neodes2-manual-evidence-1";
  readonly sourceDatasetAcquisitionId: string;
  readonly entries: readonly ManualEvidenceEntry[];
}

const verifiedManualEvidence = Symbol("verified-manual-evidence");

export interface VerifiedManualEvidence {
  readonly [verifiedManualEvidence]: true;
  readonly ledger: ManualEvidenceLedger;
  readonly ledgerSha256: string;
  readonly evidenceFileCount: number;
}

export interface ManualEvidenceIssue {
  readonly code: "failed-check";
  readonly entryId: string;
  readonly taskId: string;
  readonly check: ManualVerificationKind;
  readonly targetIds: readonly string[];
}

export interface ManualEvidenceVerificationReport {
  readonly schema: "neodes2-manual-evidence-verification-1";
  readonly sourceDatasetAcquisitionId: string;
  readonly ledgerSha256: string | null;
  readonly evidenceFileCount: number;
  readonly requiredCheckCount: number;
  readonly completedCheckCount: number;
  readonly pendingCheckCount: number;
  readonly issues: readonly ManualEvidenceIssue[];
  readonly entries: readonly ManualEvidenceEntry[];
  readonly complete: boolean;
}

function asRecord(value: unknown, label: string): Readonly<Record<string, unknown>> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Readonly<Record<string, unknown>>;
}

function assertKeys(record: Readonly<Record<string, unknown>>, allowed: readonly string[], label: string): void {
  const unexpected = Object.keys(record).filter((key) => !allowed.includes(key));
  if (unexpected.length > 0) throw new Error(`${label} has unexpected field ${unexpected.sort().join(", ")}.`);
}

function nonemptyString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${label} must be a nonempty string.`);
  return value;
}

function literal<const Value extends string>(value: unknown, allowed: readonly Value[], label: string): Value {
  if (typeof value !== "string" || !allowed.includes(value as Value)) {
    throw new Error(`${label} must be ${allowed.join(" or ")}.`);
  }
  return value as Value;
}

function sortedUniqueStrings(value: unknown, label: string): readonly string[] {
  if (!Array.isArray(value) || value.length === 0) throw new Error(`${label} must be a nonempty array.`);
  const output = value.map((entry, index) => nonemptyString(entry, `${label}[${index}]`));
  const sorted = output.toSorted();
  if (new Set(output).size !== output.length) throw new Error(`${label} must not repeat a value.`);
  if (output.some((entry, index) => entry !== sorted[index])) throw new Error(`${label} must be sorted.`);
  return output;
}

function evidencePath(value: unknown, label: string): string {
  const path = nonemptyString(value, label);
  if (
    isAbsolute(path) ||
    path.includes("\\") ||
    path.includes(":") ||
    path.split("/").some((part) => part === "" || part === "." || part === "..")
  ) {
    throw new Error(`${label} must be a normalized relative path inside the ledger directory.`);
  }
  return path;
}

function evidenceReference(value: unknown, label: string): ManualEvidenceReference {
  const reference = asRecord(value, label);
  assertKeys(reference, ["path", "sha256"], label);
  const hash = nonemptyString(reference.sha256, `${label}.sha256`);
  if (!/^[0-9a-f]{64}$/u.test(hash)) throw new Error(`${label}.sha256 must be a lowercase SHA-256 hash.`);
  return {
    path: evidencePath(reference.path, `${label}.path`),
    sha256: hash,
  };
}

function evidenceEntry(value: unknown, label: string): ManualEvidenceEntry {
  const entry = asRecord(value, label);
  assertKeys(entry, ["id", "taskId", "check", "outcome", "targetIds", "evidence", "note"], label);
  if (!Array.isArray(entry.evidence) || entry.evidence.length === 0) {
    throw new Error(`${label}.evidence must be a nonempty array.`);
  }
  const evidence = entry.evidence.map((reference, index) => evidenceReference(reference, `${label}.evidence[${index}]`));
  const paths = evidence.map((reference) => reference.path);
  if (new Set(paths).size !== paths.length) throw new Error(`${label}.evidence must not repeat a path.`);
  if (paths.some((path, index) => path !== paths.toSorted()[index])) throw new Error(`${label}.evidence must be sorted by path.`);
  return {
    id: nonemptyString(entry.id, `${label}.id`),
    taskId: nonemptyString(entry.taskId, `${label}.taskId`),
    check: literal(entry.check, ["observation", "spoiler-review"] as const, `${label}.check`),
    outcome: literal(entry.outcome, ["pass", "fail"] as const, `${label}.outcome`),
    targetIds: sortedUniqueStrings(entry.targetIds, `${label}.targetIds`),
    evidence,
    note: nonemptyString(entry.note, `${label}.note`),
  };
}

export function validateManualEvidenceLedger(value: unknown): ManualEvidenceLedger {
  const ledger = asRecord(value, "manual evidence ledger");
  assertKeys(ledger, ["schema", "sourceDatasetAcquisitionId", "entries"], "manual evidence ledger");
  if (!Array.isArray(ledger.entries)) throw new Error("manual evidence ledger.entries must be an array.");
  const entries = ledger.entries.map((entry, index) => evidenceEntry(entry, `manual evidence ledger.entries[${index}]`));
  const ids = entries.map((entry) => entry.id);
  if (new Set(ids).size !== ids.length) throw new Error("manual evidence ledger.entries must not repeat an id.");
  if (ids.some((id, index) => id !== ids.toSorted()[index])) {
    throw new Error("manual evidence ledger.entries must be sorted by id.");
  }
  return {
    schema: literal(ledger.schema, ["neodes2-manual-evidence-1"] as const, "manual evidence ledger.schema"),
    sourceDatasetAcquisitionId: nonemptyString(
      ledger.sourceDatasetAcquisitionId,
      "manual evidence ledger.sourceDatasetAcquisitionId",
    ),
    entries,
  };
}

function isOutside(parent: string, child: string): boolean {
  const difference = relative(parent, child);
  return difference === ".." || difference.startsWith(`..${sep}`) || isAbsolute(difference);
}

async function verifyEvidenceFile(baseDirectory: string, reference: ManualEvidenceReference): Promise<StableFile> {
  const resolvedPath = resolve(baseDirectory, ...reference.path.split("/"));
  const actualPath = await realpath(resolvedPath);
  if (isOutside(baseDirectory, actualPath)) throw new Error(`Manual evidence path escapes its ledger directory: ${reference.path}`);
  const file = await readStableRegularFile(resolvedPath);
  if (file.content.length === 0) throw new Error(`Manual evidence file is empty: ${reference.path}`);
  if (file.sha256 !== reference.sha256) throw new Error(`Manual evidence hash changed: ${reference.path}`);
  return file;
}

export async function readManualEvidenceLedger(path: string): Promise<VerifiedManualEvidence> {
  if (!isAbsolute(path)) throw new Error("Manual evidence ledger path must be absolute.");
  assertLocalOutputPath(path);
  const requestedPath = resolve(path);
  const ledgerFile = await readStableRegularFile(requestedPath);
  const ledgerPath = await realpath(requestedPath);
  assertLocalOutputPath(ledgerPath);
  const ledgerDirectory = await realpath(dirname(ledgerPath));
  const ledger: unknown = JSON.parse(ledgerFile.content.toString("utf8"));
  const validated = validateManualEvidenceLedger(ledger);
  const references = new Map<string, ManualEvidenceReference>();
  for (const entry of validated.entries) {
    for (const reference of entry.evidence) {
      const referenceKey = reference.path.toLowerCase();
      const existing = references.get(referenceKey);
      if (existing !== undefined && existing.sha256 !== reference.sha256) {
        throw new Error(`Manual evidence path has conflicting hashes: ${reference.path}`);
      }
      references.set(referenceKey, reference);
    }
  }
  await Promise.all([...references.values()].map((reference) => verifyEvidenceFile(ledgerDirectory, reference)));
  return {
    [verifiedManualEvidence]: true,
    ledger: validated,
    ledgerSha256: ledgerFile.sha256,
    evidenceFileCount: references.size,
  };
}

function assignmentKey(taskId: string, check: ManualVerificationKind): string {
  return `${taskId}\u0000${check}`;
}

export function verifyManualEvidence(
  tasks: readonly ManualVerificationTask[],
  plan: ObservationPlan,
  evidence?: VerifiedManualEvidence,
): { readonly tasks: readonly ManualVerificationTask[]; readonly report: ManualEvidenceVerificationReport } {
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const targetSetById = new Map(plan.targetSets.map((targetSet) => [targetSet.id, targetSet]));
  const assignmentByKey = new Map(plan.assignments.map((assignment) => [assignmentKey(assignment.taskId, assignment.check), assignment]));
  if (evidence !== undefined && evidence.ledger.sourceDatasetAcquisitionId !== plan.sourceDatasetAcquisitionId) {
    throw new Error("Manual evidence and observation plan do not share one dataset acquisition.");
  }
  const coveredTargets = new Map<string, Set<string>>();
  const issues: ManualEvidenceIssue[] = [];
  for (const entry of evidence?.ledger.entries ?? []) {
    const task = taskById.get(entry.taskId);
    if (task === undefined) throw new Error(`Manual evidence entry ${entry.id} references unknown task ${entry.taskId}.`);
    if (!task.requiredChecks.includes(entry.check)) {
      throw new Error(`Manual evidence entry ${entry.id} references unrequired check ${entry.check}.`);
    }
    const key = assignmentKey(entry.taskId, entry.check);
    const assignment = assignmentByKey.get(key);
    if (assignment === undefined) throw new Error(`Manual evidence entry ${entry.id} has no observation-plan assignment.`);
    const targetSet = targetSetById.get(assignment.targetSetId);
    if (targetSet === undefined) throw new Error(`Manual evidence entry ${entry.id} has no observation target set.`);
    const allowedTargets = new Set(targetSet.targets.map((target) => target.id));
    const covered = coveredTargets.get(key) ?? new Set<string>();
    for (const targetId of entry.targetIds) {
      if (!allowedTargets.has(targetId)) throw new Error(`Manual evidence entry ${entry.id} references unknown target ${targetId}.`);
      if (covered.has(targetId)) throw new Error(`Manual evidence repeats target ${targetId} for ${entry.taskId} ${entry.check}.`);
      covered.add(targetId);
    }
    coveredTargets.set(key, covered);
    if (entry.outcome === "fail") {
      issues.push({
        code: "failed-check",
        entryId: entry.id,
        taskId: entry.taskId,
        check: entry.check,
        targetIds: entry.targetIds,
      });
    }
  }
  const failedKeys = new Set(issues.map((issue) => assignmentKey(issue.taskId, issue.check)));
  const completedKeys = new Set<string>();
  for (const assignment of plan.assignments) {
    const key = assignmentKey(assignment.taskId, assignment.check);
    const targetSet = targetSetById.get(assignment.targetSetId);
    if (targetSet === undefined) throw new Error(`Observation plan has missing target set ${assignment.targetSetId}.`);
    if (!failedKeys.has(key) && (coveredTargets.get(key)?.size ?? 0) === targetSet.targets.length) completedKeys.add(key);
  }
  const evaluatedTasks = tasks.map((task) => ({
    ...task,
    status: task.requiredChecks.every((check) => completedKeys.has(assignmentKey(task.id, check)))
      ? "complete" as const
      : "pending" as const,
  }));
  const requiredCheckCount = plan.assignments.length;
  const completedCheckCount = completedKeys.size;
  return {
    tasks: evaluatedTasks,
    report: {
      schema: "neodes2-manual-evidence-verification-1",
      sourceDatasetAcquisitionId: plan.sourceDatasetAcquisitionId,
      ledgerSha256: evidence?.ledgerSha256 ?? null,
      evidenceFileCount: evidence?.evidenceFileCount ?? 0,
      requiredCheckCount,
      completedCheckCount,
      pendingCheckCount: requiredCheckCount - completedCheckCount,
      issues: issues.sort((left, right) => left.entryId < right.entryId ? -1 : left.entryId > right.entryId ? 1 : 0),
      entries: evidence?.ledger.entries ?? [],
      complete: completedCheckCount === requiredCheckCount && issues.length === 0,
    },
  };
}
