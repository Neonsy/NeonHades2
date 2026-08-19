import { acquisitionContract } from "../contract/index.js";
import type { CombinedDataset } from "../dataset/index.js";
import type { ManualVerificationKind, ManualVerificationTask } from "./report.js";

export interface ObservationTarget {
  readonly id: string;
  readonly name: string | null;
}

export interface ObservationTargetSet {
  readonly id: string;
  readonly targets: readonly ObservationTarget[];
}

export type ObservationSavePolicy = "offline" | "profile2-mutation-permission-required";

export interface ObservationSession {
  readonly id: string;
  readonly title: string;
  readonly objective: string;
  readonly gameRequired: boolean;
  readonly savePolicy: ObservationSavePolicy;
}

export interface ObservationAssignment {
  readonly taskId: string;
  readonly check: ManualVerificationKind;
  readonly targetSetId: string;
  readonly sessionId: string;
}

export interface ObservationPlan {
  readonly schema: "neodes2-observation-plan-1";
  readonly sourceDatasetAcquisitionId: string;
  readonly sessions: readonly ObservationSession[];
  readonly targetSets: readonly ObservationTargetSet[];
  readonly assignments: readonly ObservationAssignment[];
}

const sessions = [
  {
    id: "hub-system-effects",
    title: "Hub systems and effects",
    objective: "Verify incantation world changes and Oath rank effects against the normalized records.",
    gameRequired: true,
    savePolicy: "profile2-mutation-permission-required",
  },
  {
    id: "training-combat",
    title: "Training-ground combat",
    objective: "Verify core actions, every weapon aspect, every Hex, and every status effect in controlled combat.",
    gameRequired: true,
    savePolicy: "profile2-mutation-permission-required",
  },
  {
    id: "route-combat",
    title: "Route combat",
    objective: "Verify enemy attacks, phases, summons, hazards, and route-specific behavior.",
    gameRequired: true,
    savePolicy: "profile2-mutation-permission-required",
  },
  {
    id: "progression-transitions",
    title: "Progression transitions",
    objective: "Verify relationship, prophecy, narrative, and achievement state transitions.",
    gameRequired: true,
    savePolicy: "profile2-mutation-permission-required",
  },
  {
    id: "spoiler-review",
    title: "Spoiler classification review",
    objective: "Review every spoiler-sensitive contract field against the intended public reveal boundary.",
    gameRequired: false,
    savePolicy: "offline",
  },
  {
    id: "editorial-evaluation",
    title: "Editorial evaluation",
    objective: "Record the project-owned evaluations required before guide records can be authored.",
    gameRequired: false,
    savePolicy: "offline",
  },
] as const satisfies readonly ObservationSession[];

const taskTargetSets = {
  "editorial/aspect-guide/boon-priorities": "contract-field",
  "editorial/aspect-guide/boss-route-considerations": "contract-field",
  "editorial/aspect-guide/context-ratings": "contract-field",
  "editorial/aspect-guide/fallbacks-conflicts": "contract-field",
  "editorial/aspect-guide/hammer-rankings": "contract-field",
  "editorial/aspect-guide/playstyle-combat-sequence": "contract-field",
  "editorial/aspect-guide/rank-evaluations": "contract-field",
  "editorial/aspect-guide/strengths-weaknesses": "contract-field",
  "editorial/boon-rating/rating": "contract-field",
  "editorial/boon-rating/reason-prerequisites-limitation": "contract-field",
  "editorial/progression-stage/boon-encounter-priorities": "contract-field",
  "editorial/progression-stage/completion-checklist": "contract-field",
  "editorial/progression-stage/loadout": "contract-field",
  "editorial/progression-stage/milestone": "contract-field",
  "editorial/progression-stage/parallel-objectives": "contract-field",
  "editorial/progression-stage/route-late-game": "contract-field",
  "foundation/record-metadata/spoiler-level": "contract-record-types",
  "mechanics/combat-mechanic/behavior": "core-combat-mechanics",
  "mechanics/hex/base-effect": "hexes",
  "mechanics/incantation/effects": "incantations",
  "mechanics/status-element/behavior": "status-elements",
  "mechanics/weapon-aspect/attack-pattern": "weapon-aspects",
  "world-progression/achievement/name-description": "achievements",
  "world-progression/achievement/trigger": "achievements",
  "world-progression/enemy/attacks-behavior": "enemies",
  "world-progression/narrative-milestone/completion-evidence": "narrative-milestones",
  "world-progression/narrative-milestone/kind": "narrative-milestones",
  "world-progression/narrative-milestone/requirements": "narrative-milestones",
  "world-progression/oath-condition/rank-effects": "oath-conditions",
  "world-progression/prophecy/name": "prophecies",
  "world-progression/prophecy/objectives": "prophecies",
  "world-progression/prophecy/rewards": "prophecies",
  "world-progression/prophecy/unlock-requirements": "prophecies",
  "world-progression/relationship/character": "relationships",
  "world-progression/relationship/gift-track": "relationships",
  "world-progression/relationship/rewards": "relationships",
} as const satisfies Readonly<Record<string, string>>;

const observationSessions = {
  "mechanics/combat-mechanic/behavior": "training-combat",
  "mechanics/hex/base-effect": "training-combat",
  "mechanics/incantation/effects": "hub-system-effects",
  "mechanics/status-element/behavior": "training-combat",
  "mechanics/weapon-aspect/attack-pattern": "training-combat",
  "world-progression/achievement/trigger": "progression-transitions",
  "world-progression/enemy/attacks-behavior": "route-combat",
  "world-progression/narrative-milestone/completion-evidence": "progression-transitions",
  "world-progression/narrative-milestone/requirements": "progression-transitions",
  "world-progression/oath-condition/rank-effects": "hub-system-effects",
  "world-progression/prophecy/objectives": "progression-transitions",
  "world-progression/relationship/gift-track": "progression-transitions",
} as const satisfies Readonly<Record<string, string>>;

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function target(id: string, name: string | null | undefined): ObservationTarget {
  return { id, name: name ?? null };
}

function recordTargets(
  records: readonly { readonly id: string; readonly displayName?: string | null; readonly name?: string | null }[],
): readonly ObservationTarget[] {
  return records
    .map((record) => target(record.id, record.displayName ?? record.name))
    .sort((left, right) => compareStrings(left.id, right.id));
}

function prefixedRecordTargets(
  prefix: string,
  records: readonly { readonly id: string; readonly displayName?: string | null }[],
): readonly ObservationTarget[] {
  return records.map((record) => target(`${prefix}:${record.id}`, record.displayName)).sort((left, right) =>
    compareStrings(left.id, right.id));
}

function buildTargetSets(dataset: CombinedDataset): readonly ObservationTargetSet[] {
  const guide = dataset.domains.guide;
  const targetSets: ObservationTargetSet[] = [
    {
      id: "achievements",
      targets: recordTargets(guide.achievements),
    },
    {
      id: "contract-field",
      targets: [target("contract-field", "The complete field contract")],
    },
    {
      id: "contract-record-types",
      targets: acquisitionContract.domains.flatMap((domain) => domain.records.map((record) =>
        target(`${domain.id}/${record.id}`, record.description))).sort((left, right) => compareStrings(left.id, right.id)),
    },
    {
      id: "core-combat-mechanics",
      targets: ["attack", "cast", "dash", "hex", "magick", "omega", "special", "sprint"].map((id) =>
        target(id, null)),
    },
    {
      id: "enemies",
      targets: recordTargets(guide.enemies),
    },
    {
      id: "hexes",
      targets: recordTargets(dataset.domains.loadouts.hexes),
    },
    {
      id: "incantations",
      targets: recordTargets(dataset.domains.loadouts.incantations),
    },
    {
      id: "narrative-milestones",
      targets: [
        ...prefixedRecordTargets("narrative", guide.narrative),
        ...prefixedRecordTargets("outro", guide.outros),
        ...prefixedRecordTargets("run-clear", guide.runClearMessages),
      ].sort((left, right) => compareStrings(left.id, right.id)),
    },
    {
      id: "oath-conditions",
      targets: recordTargets(guide.oathConditions),
    },
    {
      id: "prophecies",
      targets: recordTargets(guide.prophecies),
    },
    {
      id: "relationships",
      targets: recordTargets(guide.relationships),
    },
    {
      id: "status-elements",
      targets: recordTargets(guide.statusElements),
    },
    {
      id: "weapon-aspects",
      targets: recordTargets(dataset.domains.weapons.aspects),
    },
  ].sort((left, right) => compareStrings(left.id, right.id));
  for (const targetSet of targetSets) {
    if (targetSet.targets.length === 0) throw new Error(`Observation target set ${targetSet.id} is empty.`);
    const ids = targetSet.targets.map((entry) => entry.id);
    if (new Set(ids).size !== ids.length) throw new Error(`Observation target set ${targetSet.id} repeats an id.`);
  }
  return targetSets;
}

function sessionFor(task: ManualVerificationTask, check: ManualVerificationKind): string {
  if (check === "spoiler-review") return "spoiler-review";
  if (task.claimKind === "editorial") return "editorial-evaluation";
  const session = observationSessions[task.id as keyof typeof observationSessions];
  if (session === undefined) throw new Error(`Manual observation task ${task.id} has no assigned session.`);
  return session;
}

export function createObservationPlan(
  dataset: CombinedDataset,
  tasks: readonly ManualVerificationTask[],
  sourceDatasetAcquisitionId: string,
): ObservationPlan {
  const targetSets = buildTargetSets(dataset);
  const targetSetIds = new Set(targetSets.map((entry) => entry.id));
  const taskIds = new Set(tasks.map((task) => task.id));
  const configuredTaskIds = Object.keys(taskTargetSets);
  const staleTask = configuredTaskIds.find((taskId) => !taskIds.has(taskId));
  if (staleTask !== undefined) throw new Error(`Observation plan contains stale task ${staleTask}.`);
  const sessionIds = new Set<string>(sessions.map((session) => session.id));
  const assignments = tasks.flatMap((task) => {
    const targetSetId = taskTargetSets[task.id as keyof typeof taskTargetSets];
    if (targetSetId === undefined) throw new Error(`Manual verification task ${task.id} has no target set.`);
    if (!targetSetIds.has(targetSetId)) throw new Error(`Manual verification task ${task.id} has a missing target set.`);
    return task.requiredChecks.map((check) => {
      const sessionId = sessionFor(task, check);
      if (!sessionIds.has(sessionId)) throw new Error(`Manual verification task ${task.id} has a missing session.`);
      return { taskId: task.id, check, targetSetId, sessionId };
    });
  }).sort((left, right) => compareStrings(`${left.taskId}\u0000${left.check}`, `${right.taskId}\u0000${right.check}`));
  return {
    schema: "neodes2-observation-plan-1",
    sourceDatasetAcquisitionId,
    sessions,
    targetSets,
    assignments,
  };
}
