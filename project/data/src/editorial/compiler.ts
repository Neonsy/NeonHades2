import type { JsonValue } from "../boons/index.js";
import type { CombinedDataset } from "../dataset/index.js";
import {
  arcanaProfiles,
  aspectProfiles,
  familiarProfiles,
  hexProfiles,
  pageDefinitions,
  preferredHammersByAspect,
  progressionStages,
} from "./content.js";
import type {
  AspectBuildVariantRecord,
  AspectGuideRecord,
  AspectProfile,
  BuildPowerBreakpoint,
  BuildTargetReference,
  BuildInteraction,
  BoonRatingRecord,
  BuildGoal,
  CombatFocus,
  ContentReport,
  EditorialContext,
  EditorialDataset,
  EditorialJudgment,
  EditorialRating,
  EditorialReference,
  KeepsakePriorityRecord,
  KeepsakeLifecycle,
  ProgressionStageRecord,
  ProgressionStageSource,
  ProgressionPriority,
  RatedReference,
  ResourceAdviceRecord,
  SearchAliasRecord,
  TierProfile,
  TierRatingRecord,
  WeaponGuideRecord,
} from "./types.js";

export interface EditorialSourceIdentity {
  readonly datasetAcquisitionId: string;
  readonly datasetSha256: string;
  readonly dataReadyAcquisitionId: string;
  readonly verificationAcquisitionId: string;
}

interface NamedRecord {
  readonly recordType: string;
  readonly id: string;
  readonly name: string;
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function key(reference: EditorialReference): string {
  return `${reference.recordType}:${reference.id}`;
}

function reference(recordType: string, id: string): EditorialReference {
  return { recordType, id };
}

function context(
  dataset: CombinedDataset,
  progressionStage: string,
  aspectId?: string,
): EditorialContext {
  return {
    steamBuildId: dataset.source.steamBuildId,
    executableVersion: dataset.source.executableVersion,
    packageVersion: dataset.source.packageVersion,
    reader: "new-player",
    progressionStage,
    route: "any",
    ...(aspectId === undefined ? {} : { aspectId }),
  };
}

function verificationNote(identity: EditorialSourceIdentity): string {
  return `Checked against normalized dataset ${identity.datasetAcquisitionId} and completed Phase 5 verification ${identity.verificationAcquisitionId}.`;
}

function catalog(dataset: CombinedDataset): readonly NamedRecord[] {
  const { arcana, boons, guide, loadouts, weapons } = dataset.domains;
  return [
    ...arcana.cards.map((record) => ({
      recordType: "mechanics/arcana-card",
      id: record.id,
      name: record.name,
    })),
    ...boons.gods.map((record) => ({
      recordType: "mechanics/god",
      id: record.id,
      name: record.name,
    })),
    ...boons.boons.map((record) => ({
      recordType: "mechanics/boon",
      id: record.id,
      name: record.name,
    })),
    ...weapons.weapons.map((record) => ({
      recordType: "mechanics/weapon",
      id: record.id,
      name: record.name,
    })),
    ...weapons.aspects.map((record) => ({
      recordType: "mechanics/weapon-aspect",
      id: record.id,
      name: record.name,
    })),
    ...weapons.hammers.map((record) => ({
      recordType: "mechanics/hammer-upgrade",
      id: record.id,
      name: record.name,
    })),
    ...loadouts.keepsakes.map((record) => ({
      recordType: "mechanics/keepsake",
      id: record.id,
      name: record.displayName,
    })),
    ...loadouts.familiars.map((record) => ({
      recordType: "mechanics/familiar",
      id: record.id,
      name: record.displayName,
    })),
    ...loadouts.hexes.map((record) => ({
      recordType: "mechanics/hex",
      id: record.id,
      name: record.displayName,
    })),
    ...loadouts.incantations.map((record) => ({
      recordType: "mechanics/incantation",
      id: record.id,
      name: record.displayName,
    })),
    ...guide.resources.map((record) => ({
      recordType: "mechanics/resource",
      id: record.id,
      name: record.displayName ?? "",
    })),
    ...guide.statusElements.map((record) => ({
      recordType: "mechanics/status-element",
      id: record.id,
      name: record.displayName ?? "",
    })),
    ...guide.regions.map((record) => ({
      recordType: "world-progression/region",
      id: record.id,
      name: record.displayName ?? "",
    })),
    ...guide.encounters.map((record) => ({
      recordType: "world-progression/encounter",
      id: record.id,
      name: record.displayName ?? "",
    })),
    ...guide.enemies.map((record) => ({
      recordType: "world-progression/enemy",
      id: record.id,
      name: record.displayName ?? "",
    })),
    ...guide.oathConditions.map((record) => ({
      recordType: "world-progression/oath-condition",
      id: record.id,
      name: record.displayName ?? "",
    })),
    ...guide.bounties.map((record) => ({
      recordType: "world-progression/testament-bounty",
      id: record.id,
      name: record.displayName ?? "",
    })),
    ...guide.relationships.map((record) => ({
      recordType: "world-progression/relationship",
      id: record.id,
      name: record.displayName ?? "",
    })),
    ...guide.prophecies.map((record) => ({
      recordType: "world-progression/prophecy",
      id: record.id,
      name: record.displayName ?? "",
    })),
    ...guide.narrative.map((record) => ({
      recordType: "world-progression/narrative-milestone",
      id: record.id,
      name: record.displayName ?? "",
    })),
    ...guide.achievements.map((record) => ({
      recordType: "world-progression/achievement",
      id: record.id,
      name: record.displayName,
    })),
  ].sort((left, right) =>
    compareStrings(
      `${left.recordType}:${left.id}`,
      `${right.recordType}:${right.id}`,
    ),
  );
}

function progressionRecords(
  dataset: CombinedDataset,
  identity: EditorialSourceIdentity,
  stages: readonly ProgressionStageSource[],
): readonly ProgressionStageRecord[] {
  return stages.map((stage, index) => ({
    recordType: "editorial/progression-stage",
    id: stage.id,
    order: stage.order,
    title: stage.title,
    endpoint: stage.endpoint,
    spoilerLevel: stage.spoilerLevel,
    context: context(dataset, stage.id),
    readerKnowledge: stage.readerKnowledge,
    actionSequence: stage.actionSequence,
    recommendation: stage.nextObjective,
    reason: stage.reason,
    limitation:
      "Random offers and story sequencing can change the number of nights needed, so milestone evidence takes priority over run counts.",
    prerequisiteReferences:
      index === 0 ? [] : (stages[index - 1]?.completionReferences ?? []),
    fallback: stage.fallback,
    verificationNotes: verificationNote(identity),
    purchaseUpgradePriorities: stage.purchaseUpgradePriorities,
    resourcePolicy: stage.resourcePolicy,
    loadoutReferences: stage.loadoutReferences,
    priorityReferences: stage.priorityReferences,
    boonEncounterPriorities: stage.boonEncounterPriorities,
    parallelObjectiveReferences: stage.parallelObjectiveReferences,
    routeLateGame: stage.routeLateGame,
    completionChecklist: stage.completionChecklist,
    completionReferences: stage.completionReferences,
  }));
}

function ratingFromProfile(
  profile: AspectProfile,
  rank: "rank-one" | "maximum",
): EditorialRating {
  if (rank === "maximum")
    return profile.contextRatings.consistency === "C"
      ? "A"
      : profile.contextRatings.consistency;
  if (profile.beginnerDifficulty <= 2) return "A";
  if (profile.beginnerDifficulty === 3) return "B";
  return "C";
}

function boonFocus(id: string): CombatFocus | null {
  if (/WeaponBoon$/.test(id)) return "attack";
  if (/SpecialBoon$/.test(id)) return "special";
  if (/CastBoon$|Cast.*Boon$/.test(id)) return "cast";
  if (/SprintBoon$|Sprint.*Boon$/.test(id)) return "sprint";
  if (/ManaBoon$|Mana.*Boon$/.test(id)) return "omega";
  return null;
}

const actionRangeByWeapon = {
  WeaponAxe: { attack: "near", special: "near" },
  WeaponDagger: { attack: "near", special: "ranged" },
  WeaponLob: { attack: "ranged", special: "near" },
  WeaponStaffSwing: { attack: "near", special: "ranged" },
  WeaponSuit: { attack: "near", special: "ranged" },
  WeaponTorch: { attack: "ranged", special: "near" },
} as const;

const actionRangeOverrides = {
  LobCloseAttackAspect: { attack: "near" },
} as const;

const proximityCoreBoons = new Map<string, "attack" | "special">([
  ["AphroditeWeaponBoon", "attack"],
  ["AphroditeSpecialBoon", "special"],
]);

function planActionRange(
  dataset: CombinedDataset,
  aspectId: string,
  slot: "attack" | "special",
): "near" | "ranged" | null {
  const override =
    actionRangeOverrides[aspectId as keyof typeof actionRangeOverrides]?.[
      slot as keyof (typeof actionRangeOverrides)[keyof typeof actionRangeOverrides]
    ];
  if (override !== undefined) return override;
  const weaponId = dataset.domains.weapons.aspects.find(
    (aspect) => aspect.id === aspectId,
  )?.weaponId;
  if (weaponId === undefined) return null;
  const weaponRange =
    actionRangeByWeapon[weaponId as keyof typeof actionRangeByWeapon];
  return weaponRange?.[slot] ?? null;
}

function assertPlanBoonFit(
  dataset: CombinedDataset,
  profile: AspectProfile,
  goal: BuildGoal,
): void {
  for (const id of [...profile.primaryBoonIds, ...profile.fallbackBoonIds]) {
    if (!proximityBoonConflictsWithPlan(dataset, profile, id)) continue;
    const slot = proximityCoreBoons.get(id);
    throw new Error(
      `${profile.aspectId} ${goal} recommends ${id} for a ranged ${slot ?? "move"}; proximity-only Boons require an explicitly near-range action.`,
    );
  }
}

function proximityBoonConflictsWithPlan(
  dataset: CombinedDataset,
  profile: AspectProfile,
  boonId: string,
): boolean {
  const slot = proximityCoreBoons.get(boonId);
  return (
    slot !== undefined &&
    planActionRange(dataset, profile.aspectId, slot) === "ranged"
  );
}

function coreBoonAliasSlot(id: string): CombatFocus | null {
  const match =
    /^(?:Aphrodite|Apollo|Ares|Demeter|Hephaestus|Hera|Hestia|Poseidon|Zeus)(Weapon|Special|Cast|Sprint|Mana)Boon$/u.exec(
      id,
    );
  if (match === null) return null;
  return (
    {
      Weapon: "attack",
      Special: "special",
      Cast: "cast",
      Sprint: "sprint",
      Mana: "omega",
    } as const
  )[match[1] as "Weapon" | "Special" | "Cast" | "Sprint" | "Mana"];
}

function ratingScore(rating: EditorialRating): number {
  return ({ S: 5, A: 4, B: 3, C: 2, D: 1 } as const)[rating];
}

function overallRating(
  ratings: Readonly<
    Record<"consistency" | "speed" | "safety" | "high-fear", EditorialRating>
  >,
): EditorialRating {
  const average =
    Object.values(ratings).reduce(
      (sum, rating) => sum + ratingScore(rating),
      0,
    ) / 4;
  if (average >= 4.5) return "S";
  if (average >= 4.25) return "A";
  if (average >= 3) return "B";
  if (average >= 2) return "C";
  return "D";
}

function contextReason(
  profile: AspectProfile,
  ratingContext: "consistency" | "speed" | "safety" | "high-fear",
): string {
  if (ratingContext === "consistency")
    return (
      profile.strengths[0] ??
      "The combat loop remains reliable when its setup is available."
    );
  if (ratingContext === "speed")
    return (
      profile.strengths[1] ??
      profile.strengths[0] ??
      "The combat loop clears efficiently when its setup is available."
    );
  if (ratingContext === "safety") return profile.bossConsideration;
  return profile.routeConsideration;
}

function contextLimitation(
  profile: AspectProfile,
  ratingContext: "consistency" | "speed" | "safety" | "high-fear",
): string {
  if (ratingContext === "speed")
    return (
      profile.weaknesses[1] ??
      profile.weaknesses[0] ??
      "A missed setup lowers clear speed."
    );
  if (ratingContext === "safety")
    return (
      profile.weaknesses[0] ??
      "Unsafe timing can still lose the defensive advantage."
    );
  if (ratingContext === "high-fear") return profile.weaknesses.join(" ");
  return (
    profile.weaknesses[0] ??
    "The rating assumes the recommended attack sequence is repeated reliably."
  );
}

function rankedHammers(
  dataset: CombinedDataset,
  profile: AspectProfile,
): readonly RatedReference[] {
  const preferred: readonly string[] =
    preferredHammersByAspect[
      profile.aspectId as keyof typeof preferredHammersByAspect
    ] ?? [];
  const hammerById = new Map(
    dataset.domains.weapons.hammers.map((hammer) => [hammer.id, hammer]),
  );
  const selected =
    preferred.length > 0
      ? preferred
      : dataset.domains.weapons.hammers
          .filter((hammer) =>
            hammer.compatibility.allowedAspectIds.includes(profile.aspectId),
          )
          .map((hammer) => hammer.id)
          .slice(0, 3);
  return selected.flatMap((id, preferredIndex): RatedReference[] => {
    const hammer = hammerById.get(id);
    if (hammer === undefined) return [];
    return [
      {
        reference: reference("mechanics/hammer-upgrade", hammer.id),
        rating: preferredIndex === 0 ? ("S" as const) : ("A" as const),
        reason: hammer.description,
        limitation:
          "Choose the core Boon and required Magick recovery before changing the weapon around a Hammer.",
        prerequisiteReferences: [
          reference("mechanics/weapon-aspect", profile.aspectId),
        ],
      },
    ];
  });
}

function arcanaRecommendation(
  dataset: CombinedDataset,
  profile: AspectProfile,
  id: string,
) {
  const core =
    id === "BonusHealth" ||
    id === "LastStand" ||
    ((id === "CastBuff" || id === "CastCount") &&
      profile.focuses.includes("cast")) ||
    ((id === "ChanneledCast" || id === "ManaOverTime") &&
      profile.focuses.includes("omega")) ||
    (id === "SprintShield" && profile.focuses.includes("sprint")) ||
    id === "ChanneledBlock" ||
    (id === "SorceryRegenUpgrade" && profile.focuses.includes("hex"));
  const reasons: Readonly<Record<string, string>> = {
    BonusHealth:
      "Persistence adds a reliable Life buffer without changing the aspect's combat sequence.",
    LastStand:
      "Death protects route progress while the aspect's positioning and boss windows are still being learned.",
    ChanneledCast:
      "The Sorceress makes Omega moves channel 20% faster, reducing how long the aspect remains exposed while charging.",
    ManaOverTime:
      "The Unseen restores the Magick needed to repeat the aspect's Omega sequence.",
    CastBuff:
      "The Furies adds damage to the Cast that already controls the aspect's target area.",
    CastCount:
      "Eternity supports repeated Cast placement when the aspect relies on keeping targets inside a controlled area.",
    ChanneledBlock:
      "The Lovers reduces damage during the charged or blocking window used by this aspect.",
    SprintShield:
      "The Swift Runner protects the repositioning step between the aspect's attack sequences.",
    SorceryRegenUpgrade:
      "The Moon improves Hex availability for an aspect whose loop explicitly includes Hex use.",
  };
  const card = dataset.domains.arcana.cards.find(
    (candidate) => candidate.id === id,
  );
  return {
    reference: reference("mechanics/arcana-card", id),
    rating: core ? ("S" as const) : ("A" as const),
    role: core ? ("core" as const) : ("support" as const),
    reason:
      reasons[id] ??
      `${card?.name ?? id} supports the recommended attack sequence.`,
    limitation: core
      ? "Its Grasp cost must fit alongside the other core cards before support cards are added."
      : "Remove this support card first when current Grasp cannot hold the full loadout.",
    prerequisiteReferences: [],
  };
}

function rewardPriorities(profile: AspectProfile) {
  const usesMagick =
    profile.focuses.includes("omega") || profile.focuses.includes("hex");
  const rewards = usesMagick
    ? ([
        "core-boon",
        "magick-recovery",
        "hammer",
        "maximum-life",
        "pom",
        "duo-legendary",
      ] as const)
    : ([
        "core-boon",
        "hammer",
        "maximum-life",
        "pom",
        "magick-recovery",
        "duo-legendary",
      ] as const);
  const reasons = {
    "core-boon": `Fill the aspect's ${profile.focuses[0] ?? "main"} damage slot before spending rewards on optional scaling.`,
    "magick-recovery": usesMagick
      ? "Secure recovery before repeated Omega or Hex use makes the combat loop stall."
      : "Take recovery only after the normal-move plan and immediate survival needs are covered.",
    hammer:
      "Take a compatible top-ranked Hammer after the first core Boon. No Hammer is required to make the build function.",
    "maximum-life":
      "Move maximum Life ahead of damage rewards when the current route cannot survive the next guardian reliably.",
    pom: "Use Poms after the core Boon exists so levels land on an effect the build repeatedly uses.",
    "duo-legendary":
      "Pursue a Duo or Legendary only after the build already contains a valid choice from every prerequisite set.",
  } as const;
  return rewards.map((reward, index) => ({
    order: index + 1,
    reward,
    reason: reasons[reward],
  }));
}

function rewardDecisionRules(profile: AspectProfile) {
  const usesMagick =
    profile.focuses.includes("omega") || profile.focuses.includes("hex");
  return [
    {
      condition:
        "The aspect's primary Attack, Special, Cast, Sprint, or Omega slot is still empty.",
      choose: "core-boon" as const,
      over: ["hammer", "pom", "duo-legendary"] as const,
      reason:
        "A functional core move adds reliable damage now and unlocks later scaling choices.",
    },
    ...(usesMagick
      ? [
          {
            condition:
              "The combat sequence spends Magick repeatedly and no recovery source sustains one full room.",
            choose: "magick-recovery" as const,
            over: ["hammer", "pom", "duo-legendary"] as const,
            reason:
              "The build stops working when Magick runs out, so recovery comes before optional damage.",
          },
        ]
      : []),
    {
      condition:
        "The core Boon is secured and one of the three recommended compatible Hammers is offered.",
      choose: "hammer" as const,
      over: ["pom", "core-boon"] as const,
      reason:
        "A top Hammer changes the weapon itself and is harder to replace than another non-core Boon or one level.",
    },
    {
      condition:
        "Current Life or Death Defiance cannot reliably cover the next guardian.",
      choose: "maximum-life" as const,
      over: ["hammer", "pom", "duo-legendary"] as const,
      reason:
        "Surviving the route preserves all existing build value and progression rewards.",
    },
    {
      condition:
        "A named permanent unlock is the current progression target and the build already clears ordinary rooms safely.",
      choose: "permanent-resource" as const,
      over: ["pom", "duo-legendary"] as const,
      reason:
        "The permanent resource advances the A-to-Z route without sacrificing a required combat fix.",
    },
    {
      condition:
        "The core Boon exists, the build survives, and no top Hammer or missing resource loop is offered.",
      choose: "pom" as const,
      over: ["core-boon"] as const,
      reason:
        "A level on the repeatedly used core effect is more reliable than filling an unused move slot.",
    },
    {
      condition:
        "Every prerequisite set is satisfied and the offered Duo or Legendary directly supports the completed package.",
      choose: "duo-legendary" as const,
      over: ["pom", "core-boon"] as const,
      reason:
        "The rare target is worth taking only after the build already functions without it.",
    },
  ];
}

function prerequisiteIds(
  value: JsonValue | null,
  boonIds: ReadonlySet<string>,
  output = new Set<string>(),
): ReadonlySet<string> {
  if (typeof value === "string") {
    if (boonIds.has(value)) output.add(value);
  } else if (Array.isArray(value)) {
    for (const entry of value) prerequisiteIds(entry, boonIds, output);
  } else if (value !== null && typeof value === "object") {
    for (const entry of Object.values(value)) {
      if (entry !== undefined) prerequisiteIds(entry, boonIds, output);
    }
  }
  return output;
}

function prerequisiteSets(
  value: JsonValue | null,
): readonly (readonly string[])[] {
  if (value === null || Array.isArray(value) || typeof value !== "object")
    return [];
  const sets = (value as { readonly OneFromEachSet?: JsonValue })
    .OneFromEachSet;
  if (!Array.isArray(sets)) return [];
  return sets.filter(
    (entry): entry is readonly string[] =>
      Array.isArray(entry) && entry.every((id) => typeof id === "string"),
  );
}

function boonPrerequisiteReferences(
  boon: CombinedDataset["domains"]["boons"]["boons"][number],
  boonIds: ReadonlySet<string>,
): readonly EditorialReference[] {
  return [...prerequisiteIds(boon.prerequisites, boonIds)]
    .sort(compareStrings)
    .map((id) => reference("mechanics/boon", id));
}

function compatiblePrerequisiteMatches(
  sets: readonly (readonly string[])[],
  profile: AspectProfile,
): readonly string[] | null {
  const planned = [
    ...new Set([...profile.primaryBoonIds, ...profile.fallbackBoonIds]),
  ];
  const plannedOrder = new Map(planned.map((id, index) => [id, index]));
  const candidates = sets.map((set) =>
    set
      .filter((id) => plannedOrder.has(id))
      .sort(
        (left, right) =>
          (plannedOrder.get(left) ?? 0) - (plannedOrder.get(right) ?? 0),
      ),
  );
  if (candidates.some((set) => set.length === 0)) return null;

  function select(
    index: number,
    occupiedSlots: ReadonlyMap<CombatFocus, string>,
    matches: readonly string[],
  ): readonly string[] | null {
    if (index === candidates.length) return matches;
    for (const id of candidates[index] ?? []) {
      const slot = boonFocus(id);
      const occupiedBy = slot === null ? undefined : occupiedSlots.get(slot);
      if (occupiedBy !== undefined && occupiedBy !== id) continue;
      const nextSlots = new Map(occupiedSlots);
      if (slot !== null) nextSlots.set(slot, id);
      const result = select(index + 1, nextSlots, [...matches, id]);
      if (result !== null) return result;
    }
    return null;
  }

  return select(0, new Map(), []);
}

function compatibleTargets(
  dataset: CombinedDataset,
  profile: AspectProfile,
): readonly BuildTargetReference[] {
  const boonNames = new Map(
    dataset.domains.boons.boons.map((boon) => [boon.id, boon.name]),
  );
  return dataset.domains.boons.boons
    .filter((boon) => boon.kind === "duo" || boon.kind === "legendary")
    .map((boon) => ({ boon, sets: prerequisiteSets(boon.prerequisites) }))
    .map(({ boon, sets }) => ({
      boon,
      sets,
      matches:
        sets.length === 0 ? null : compatiblePrerequisiteMatches(sets, profile),
    }))
    .filter(
      (
        entry,
      ): entry is typeof entry & { readonly matches: readonly string[] } =>
        entry.matches !== null,
    )
    .map(({ boon, sets, matches }) => {
      const selected = [...matches];
      const uniqueSelected = [...new Set(selected)];
      return {
        reference: reference("mechanics/boon", boon.id),
        rating: "A" as const,
        reason: `This plan can open the target with ${uniqueSelected.map((id) => boonNames.get(id) ?? id).join(" + ")} after its main actions are funded.`,
        limitation:
          "Do not chase this target before the main plan works, because an unseeded run may not offer every required god or Boon.",
        prerequisiteReferences: [...new Set(sets.flat())]
          .sort(compareStrings)
          .map((id) => reference("mechanics/boon", id)),
        requirementGroups: sets.map((set) =>
          set.map((id) => reference("mechanics/boon", id)),
        ),
        selectedPrerequisites: selected.map((id) =>
          reference("mechanics/boon", id),
        ),
        requirementSummary:
          sets.length === 1
            ? "Choose one Boon from this prerequisite group."
            : `Choose one Boon from each of ${sets.length} prerequisite groups.`,
      };
    })
    .sort((left, right) =>
      compareStrings(left.reference.id, right.reference.id),
    );
}

const boonSlots = ["attack", "special", "cast", "sprint", "omega"] as const;
const explicitlyPrioritizedResourceIds = new Set([
  "CharonPoints",
  "CosmeticsPoints",
  "DreamPoints",
  "GemPoints",
  "MemPointsCommon",
  "MetaCurrency",
  "Mixer5Common",
  "PlantFNightshadeSeed",
  "SuperGiftPoints",
]);

function slotSelections(
  dataset: CombinedDataset,
  slot: (typeof boonSlots)[number],
  ids: readonly string[],
  group: "preferred" | "fallback",
  profile: AspectProfile,
  goal: BuildGoal,
): readonly RatedReference[] {
  const boonIds = new Set(dataset.domains.boons.boons.map((boon) => boon.id));
  const boonById = new Map(
    dataset.domains.boons.boons.map((boon) => [boon.id, boon]),
  );
  const candidates = ids
    .filter((id) => boonFocus(id) === slot)
    .map((id) => boonById.get(id))
    .filter(
      (boon): boon is (typeof dataset.domains.boons.boons)[number] =>
        boon !== undefined,
    );
  return candidates.map((boon, index) => ({
    reference: reference("mechanics/boon", boon.id),
    rating: group === "preferred" ? (index === 0 ? "S" : "A") : "B",
    reason:
      profile.boonReasons[boon.id] ??
      selectionReason(profile, goal, slot, group, index),
    limitation: `Another ${slot === "omega" ? "Magick recovery" : slot} boon would replace this choice rather than stack with it.`,
    prerequisiteReferences: boonPrerequisiteReferences(boon, boonIds),
  }));
}

function planStepFor(profile: AspectProfile, slot: CombatFocus): string {
  const pattern =
    slot === "omega"
      ? /\b(?:Omega|Magick|charge|recovery|restore)\b/iu
      : new RegExp(`\\b${slot}\\b`, "iu");
  return (
    profile.combatSequence.find((step) => pattern.test(step)) ??
    profile.combatSequence[0] ??
    "repeat the aspect's main sequence"
  );
}

function selectionReason(
  profile: AspectProfile,
  goal: BuildGoal,
  slot: CombatFocus,
  group: "preferred" | "fallback",
  index: number,
): string {
  const core = profile.focuses.includes(slot);
  const planLabel = goal === "strongest" ? "damage" : "reliability";
  if (!core) {
    return group === "fallback"
      ? `Use this if the preferred ${slot} choice does not appear. It keeps the complete five-slot package coherent without changing the plan's higher priorities.`
      : `This is the recommended ${slot} choice for the complete five-slot package. Take it after the ${profile.focuses.join(", ")} choices only when offers compete.`;
  }
  const step = planStepFor(profile, slot);
  if (group === "fallback") {
    return `Use this only when the preferred ${slot} choice is unavailable. It preserves “${step}” without changing the ${planLabel} loop.`;
  }
  if (index > 0) {
    return `This can fill the same ${slot} role when its condition matches “${step}”; keep the rest of the ${planLabel} plan unchanged.`;
  }
  return `This is a breakpoint for “${step}”. It powers a move the ${planLabel} plan already repeats instead of splitting upgrades across unrelated actions.`;
}

function aspectBoonRankings(
  dataset: CombinedDataset,
  profile: AspectProfile,
  targets: readonly RatedReference[],
  goal: BuildGoal,
): readonly RatedReference[] {
  const primary = new Set(profile.primaryBoonIds);
  const fallback = new Set(profile.fallbackBoonIds);
  const targetIds = new Set(targets.map((entry) => entry.reference.id));
  const boonIds = new Set(dataset.domains.boons.boons.map((boon) => boon.id));
  return dataset.domains.boons.boons
    .map((boon) => {
      const focus = boonFocus(boon.id);
      const prerequisiteReferences = boonPrerequisiteReferences(boon, boonIds);
      if (primary.has(boon.id))
        return {
          reference: reference("mechanics/boon", boon.id),
          rating: "S" as const,
          reason:
            profile.boonReasons[boon.id] ??
            selectionReason(
              profile,
              goal,
              focus ?? "omega",
              "preferred",
              profile.primaryBoonIds
                .filter((id) => boonFocus(id) === focus)
                .indexOf(boon.id),
            ),
          limitation:
            focus === null
              ? "Take it after the core Attack, Special, Cast, and Magick needs are covered."
              : `Another ${focus} boon would replace this preferred choice rather than stack with it.`,
          prerequisiteReferences,
        };
      if (fallback.has(boon.id))
        return {
          reference: reference("mechanics/boon", boon.id),
          rating: "A" as const,
          reason:
            profile.boonReasons[boon.id] ??
            selectionReason(profile, goal, focus ?? "omega", "fallback", 0),
          limitation:
            focus === null
              ? "Use it only when the preferred support package does not appear."
              : `It keeps the ${focus} slot functional, but the preferred choice fits the combat sequence better.`,
          prerequisiteReferences,
        };
      if (targetIds.has(boon.id))
        return {
          reference: reference("mechanics/boon", boon.id),
          rating: "A" as const,
          reason:
            "This is an optional ceiling target after its exact prerequisite groups and the core loop are complete.",
          limitation:
            "It is a late target rather than a functional starting point, and the run may not offer every prerequisite.",
          prerequisiteReferences,
        };
      if (proximityBoonConflictsWithPlan(dataset, profile, boon.id))
        return {
          reference: reference("mechanics/boon", boon.id),
          rating: "D" as const,
          reason: `This proximity-only effect conflicts with “${planStepFor(profile, focus ?? "omega")}”, which keeps the carrying move at range.`,
          limitation:
            "Its damage condition asks the player to abandon the spacing this aspect plan is built to preserve.",
          prerequisiteReferences,
        };
      if (focus !== null && profile.focuses.includes(focus))
        return {
          reference: reference("mechanics/boon", boon.id),
          rating: "B" as const,
          reason: `This can support “${planStepFor(profile, focus)}”, but it ranks behind the named ${goal} choices for that slot.`,
          limitation:
            "Choosing it can close the core slot before a stronger recommended option appears.",
          prerequisiteReferences,
        };
      if (focus !== null)
        return {
          reference: reference("mechanics/boon", boon.id),
          rating: "D" as const,
          reason: `This fills an optional ${focus} slot that the ${goal} plan does not rely on.`,
          limitation:
            "It consumes a core slot and future upgrades without strengthening the aspect's recommended move.",
          prerequisiteReferences,
        };
      return {
        reference: reference("mechanics/boon", boon.id),
        rating: "C" as const,
        reason:
          "This is situational support rather than part of the aspect's core action loop.",
        limitation:
          "Its situational value depends on the rest of the run and cannot replace the aspect's core package.",
        prerequisiteReferences,
      };
    })
    .sort(
      (left, right) =>
        ratingScore(right.rating) - ratingScore(left.rating) ||
        compareStrings(left.reference.id, right.reference.id),
    );
}

function excludedUpgradeConflicts(
  dataset: CombinedDataset,
  profile: AspectProfile,
) {
  const aspect = dataset.domains.weapons.aspects.find(
    (candidate) => candidate.id === profile.aspectId,
  );
  if (aspect === undefined) return [];
  const hammers = dataset.domains.weapons.hammers.filter(
    (hammer) => hammer.weaponId === aspect.weaponId,
  );
  const conflicts = hammers
    .filter((hammer) =>
      hammer.compatibility.excludedAspectIds.includes(profile.aspectId),
    )
    .map((hammer) => ({
      references: [reference("mechanics/hammer-upgrade", hammer.id)],
      reason: "This Hammer cannot appear for this aspect.",
    }));
  const pairs = hammers.flatMap((hammer) =>
    hammer.compatibility.incompatibleHammerIds
      .filter((id) => compareStrings(hammer.id, id) < 0)
      .map((id) => ({
        references: [
          reference("mechanics/hammer-upgrade", hammer.id),
          reference("mechanics/hammer-upgrade", id),
        ],
        reason: "These Hammers cannot be used together.",
      })),
  );
  return [...conflicts, ...pairs];
}

function forceKeepsake(
  dataset: CombinedDataset,
  boonId: string,
): string | null {
  const boon = dataset.domains.boons.boons.find(
    (candidate) => candidate.id === boonId,
  );
  const godId = boon?.godIds[0];
  if (godId === undefined) return null;
  const candidate = `Force${godId.replace(/Upgrade$/, "")}BoonKeepsake`;
  return dataset.domains.loadouts.keepsakes.some(
    (keepsake) => keepsake.id === candidate,
  )
    ? candidate
    : null;
}

function keepsakeLifecycle(id: string): KeepsakeLifecycle {
  if (/TempHammer|TimedBuff/.test(id)) return "timed";
  if (/DecayingBoost/.test(id)) return "decaying";
  if (/ArmorGain|DoorHealReserve|ManaOverTimeRefund/.test(id))
    return "depleting";
  if (
    /^Force.*BoonKeepsake$|Reincarnation|BonusMoney|AthenaEncounter|BossMetaUpgrade|BossPreDamage|FountainRarity|SpellTalent|Rarify/.test(
      id,
    )
  ) {
    return "limited-use";
  }
  return "persistent";
}

function keepsakeRarifyUses(dataset: CombinedDataset, id: string): number {
  const keepsake = dataset.domains.loadouts.keepsakes.find(
    (candidate) => candidate.id === id,
  );
  const rarityUpgradeData = keepsake?.mechanics?.RarityUpgradeData;
  if (
    rarityUpgradeData === null ||
    rarityUpgradeData === undefined ||
    Array.isArray(rarityUpgradeData) ||
    typeof rarityUpgradeData !== "object"
  ) {
    return 0;
  }
  const uses = (rarityUpgradeData as Readonly<Record<string, JsonValue>>).Uses;
  return typeof uses === "number" && Number.isInteger(uses) && uses > 0
    ? uses
    : 0;
}

function keepsakeInactiveSwitch(
  id: string,
  lifecycle: KeepsakeLifecycle,
  rarifyUses = 0,
): string {
  if (/^Force.*BoonKeepsake$/.test(id)) {
    if (rarifyUses === 0)
      return "At the next keepsake cabinet, replace it after its god offer is consumed.";
    const charges =
      rarifyUses === 1
        ? "its Rarify charge is"
        : `all ${rarifyUses} Rarify charges are`;
    return `At the next keepsake cabinet, replace it after its god offer is consumed and ${charges} spent. Switch earlier only when you intentionally abandon the unused Rarify benefit.`;
  }
  if (id === "ReincarnationKeepsake")
    return "At the next keepsake cabinet, replace it after its Last Stand has triggered because the spent keepsake adds no second recovery.";
  if (id === "BonusMoneyKeepsake")
    return "At the next keepsake cabinet, replace it after the starting Gold has been granted.";
  if (id === "BossPreDamageKeepsake")
    return "At the next keepsake cabinet, replace it after its limited guardian effect has been consumed and another guardian remains.";
  if (
    /AthenaEncounter|BossMetaUpgrade|FountainRarity|SpellTalent|Rarify/.test(id)
  )
    return "At the next keepsake cabinet, replace it after its remaining uses reach zero.";
  if (lifecycle === "timed")
    return "At the next keepsake cabinet, replace it after its timer or room duration expires.";
  if (lifecycle === "decaying")
    return "At the next keepsake cabinet, replace it after the remaining bonus falls below the value of the planned alternative.";
  if (lifecycle === "depleting")
    return "At the next keepsake cabinet, replace it after its Armor, healing, or Magick reserve is empty.";
  return "Keep it while its condition supports the current route, then replace it when another keepsake solves a more immediate constraint.";
}

function buildInteractions(dataset: CombinedDataset, profile: AspectProfile) {
  const boonName = new Map(
    dataset.domains.boons.boons.map((boon) => [boon.id, boon.name]),
  );
  const interactions: BuildInteraction[] = [];
  if (profile.arcanaIds.includes("StatusVulnerability")) {
    const curseCandidates = profile.primaryBoonIds.filter(
      (id) =>
        (dataset.domains.boons.boons.find((boon) => boon.id === id)?.godIds
          .length ?? 0) > 0,
    );
    if (curseCandidates.length >= 2) {
      interactions.push({
        kind: "synergy",
        references: [
          reference("mechanics/arcana-card", "StatusVulnerability"),
          ...curseCandidates.map((id) => reference("mechanics/boon", id)),
        ],
        reason:
          "Origination converts the primary package's different Olympian effects into a direct damage multiplier after two curses remain on the same foe.",
        condition:
          "Keep one reliable curse from each of two Olympians active on the priority target before evaluating Origination as part of the damage plan.",
      });
    }
  }
  for (const slot of boonSlots) {
    const preferred = profile.primaryBoonIds.find(
      (id) => boonFocus(id) === slot,
    );
    const fallback = profile.fallbackBoonIds.find(
      (id) => boonFocus(id) === slot,
    );
    if (
      preferred === undefined ||
      fallback === undefined ||
      preferred === fallback
    )
      continue;
    interactions.push({
      kind: "conflict",
      references: [
        reference("mechanics/boon", preferred),
        reference("mechanics/boon", fallback),
      ],
      reason: `${boonName.get(preferred) ?? preferred} and ${boonName.get(fallback) ?? fallback} both fill the ${slot} slot, so the fallback cannot stack with the preferred core choice.`,
      condition:
        "Choose the preferred option when both appear before the slot is filled. Choose the fallback only when the primary package is unavailable.",
    });
  }
  return interactions;
}

function buildPowerBreakpoints(
  dataset: CombinedDataset,
  profile: AspectProfile,
  boonPriorities: AspectBuildVariantRecord["boonPriorities"],
  hammers: AspectBuildVariantRecord["hammerRankings"],
): readonly BuildPowerBreakpoint[] {
  const boonNames = new Map(
    dataset.domains.boons.boons.map((boon) => [boon.id, boon.name]),
  );
  const hammerNames = new Map(
    dataset.domains.weapons.hammers.map((hammer) => [hammer.id, hammer.name]),
  );
  const coreChoices = boonPriorities
    .filter((priority) => priority.role === "core")
    .flatMap((priority) => priority.preferred.slice(0, 1));
  const foundation = coreChoices[0];
  if (foundation === undefined)
    throw new Error(`${profile.aspectId} has no main build breakpoint.`);
  const topHammer = hammers[0];
  const breakpoints: BuildPowerBreakpoint[] = [
    {
      stage: "foundation",
      title: "The main move is funded",
      condition: `Secure ${boonNames.get(foundation.reference.id) ?? foundation.reference.id}.`,
      effect:
        "The carrying action now has its required Boon, so the basic sequence works without filling unrelated slots.",
      references: [foundation.reference],
    },
    {
      stage: "online",
      title: "The build is online",
      condition:
        coreChoices.length === 1
          ? `Use the funded move in its intended sequence: ${profile.combatSequence[0] ?? "repeat the aspect's main action safely"}`
          : `Secure the main choices: ${coreChoices.map((choice) => boonNames.get(choice.reference.id) ?? choice.reference.id).join(" + ")}.`,
      effect:
        coreChoices.length === 1
          ? `${profile.strengths[0] ?? "The aspect's main mechanic is active."} The funded action now carries the complete damage plan.`
          : `${profile.strengths[0] ?? "The aspect's main mechanic is active."} The named choices now reinforce the same sequence instead of competing for upgrades.`,
      references: coreChoices.map((choice) => choice.reference),
    },
  ];
  if (topHammer !== undefined) {
    breakpoints.push({
      stage: "power-spike",
      title: "The first major power spike",
      condition: `Take ${hammerNames.get(topHammer.reference.id) ?? topHammer.reference.id} if it appears.`,
      effect:
        "This upgrades the action already carrying the plan; it improves the existing loop but is not required for the build to function.",
      references: [topHammer.reference],
    });
  }
  return breakpoints;
}

function aspectBuildVariant(
  dataset: CombinedDataset,
  identity: EditorialSourceIdentity,
  profile: AspectProfile,
  goal: BuildGoal,
): AspectBuildVariantRecord {
  assertPlanBoonFit(dataset, profile, goal);
  const preferredKeepsake = forceKeepsake(
    dataset,
    profile.primaryBoonIds[0] ?? "",
  );
  const openingKeepsake = preferredKeepsake ?? "ReincarnationKeepsake";
  const openingLifecycle = keepsakeLifecycle(openingKeepsake);
  const openingRarifyUses = keepsakeRarifyUses(dataset, openingKeepsake);
  const keepsakeRoute = [
    {
      stage: "opening" as const,
      reference: reference("mechanics/keepsake", openingKeepsake),
      reason:
        preferredKeepsake === null
          ? "Start with predictable survival when no god keepsake matches the first preferred Boon."
          : "Use the opening region to secure the first preferred god and core Boon.",
      switchCondition: keepsakeInactiveSwitch(
        openingKeepsake,
        openingLifecycle,
        openingRarifyUses,
      ),
      lifecycle: openingLifecycle,
    },
    {
      stage: "later-region" as const,
      reference: reference("mechanics/keepsake", "ReincarnationKeepsake"),
      reason:
        "Use the extra Death Defiance after the core Boon is secured when ordinary rooms still threaten the run.",
      switchCondition: `${keepsakeInactiveSwitch("ReincarnationKeepsake", "limited-use")} Equip it after the opening god is secured if room damage is consuming Death Defiance or maximum Life.`,
      lifecycle: "limited-use" as const,
    },
    {
      stage: "final-region" as const,
      reference: reference("mechanics/keepsake", "BossPreDamageKeepsake"),
      reason:
        "Use the guardian-focused effect when the final encounter is the remaining route constraint.",
      switchCondition: `${keepsakeInactiveSwitch("BossPreDamageKeepsake", "limited-use")} Equip it before the final region only when the run already survives normal rooms reliably.`,
      lifecycle: "limited-use" as const,
    },
  ];
  const boonPriorities = profile.boonPriorityOrder.map((slot) => ({
    slot,
    role: profile.focuses.includes(slot)
      ? ("core" as const)
      : ("support" as const),
    preferred: slotSelections(
      dataset,
      slot,
      profile.primaryBoonIds,
      "preferred",
      profile,
      goal,
    ),
    fallback: slotSelections(
      dataset,
      slot,
      profile.fallbackBoonIds,
      "fallback",
      profile,
      goal,
    ),
  }));
  const targets = compatibleTargets(dataset, profile);
  const hammers = rankedHammers(dataset, profile);
  const powerBreakpoints = buildPowerBreakpoints(
    dataset,
    profile,
    boonPriorities,
    hammers,
  );
  const familiar = familiarProfiles.find(
    (entry) => entry.id === profile.familiarId,
  );
  const hex = hexProfiles.find((entry) => entry.id === profile.hexId);
  return {
    goal,
    recommendation:
      goal === "strongest"
        ? `Maximize practical high-Fear damage through ${profile.focuses.join(", ")} and the aspect's own mechanic.`
        : `Maximize high-Fear clear reliability through ${profile.focuses.join(", ")} without abandoning the aspect's damage mechanic.`,
    reason:
      profile.strengths[0] ??
      "The profile keeps the aspect's primary mechanic central.",
    limitation:
      profile.weaknesses[0] ?? "The aspect still depends on safe execution.",
    prerequisiteReferences: [
      reference("mechanics/weapon-aspect", profile.aspectId),
    ],
    fallback:
      "If a preferred core Boon does not appear, keep the strongest compatible core Boon already offered and use the named alternatives in that slot on the build page.",
    verificationNotes: verificationNote(identity),
    overallRating: overallRating(profile.contextRatings),
    overallReason:
      profile.strengths[0] ??
      "The combat loop gives this aspect a reliable plan.",
    overallLimitation:
      profile.weaknesses[0] ?? "The aspect still depends on safe execution.",
    strengths: profile.strengths,
    weaknesses: profile.weaknesses,
    playstyleCombatSequence: profile.combatSequence,
    powerBreakpoints,
    arcanaLoadout: profile.arcanaIds.map((id) =>
      arcanaRecommendation(dataset, profile, id),
    ),
    arcanaGraspCost: profile.arcanaIds.reduce(
      (sum, id) =>
        sum +
        (dataset.domains.arcana.cards.find((card) => card.id === id)
          ?.graspCost ?? 0),
      0,
    ),
    arcanaConstraint:
      "If current Grasp cannot hold the full list, keep core cards first, then add Persistence and Death before other support cards.",
    keepsakeRoute,
    familiarHex: [
      {
        reference: reference("mechanics/familiar", profile.familiarId),
        rating: familiar?.rating ?? "B",
        reason:
          familiar?.reason ??
          "The Familiar supports the recommended combat sequence.",
        limitation:
          familiar?.limitation ??
          "The Familiar cannot replace the aspect's core Boon and Arcana package.",
        prerequisiteReferences: [],
      },
      {
        reference: reference("mechanics/hex", profile.hexId),
        rating: hex?.rating ?? "B",
        reason:
          hex?.reason ?? "The Hex supports the recommended combat sequence.",
        limitation:
          hex?.limitation ??
          "The Hex cannot replace the aspect's core Boon and Magick loop.",
        prerequisiteReferences: [],
      },
    ],
    boonPriorities,
    boonRankings: aspectBoonRankings(dataset, profile, targets, goal),
    duoLegendaryTargets: targets,
    hammerRankings: hammers,
    buildInteractions: buildInteractions(dataset, profile),
    rewardPriorities: rewardPriorities(profile),
    rewardDecisionRules: rewardDecisionRules(profile),
    conflicts: [
      "Do not split Poms and rarity upgrades across both Attack and Special unless the aspect sequence needs both.",
      "Avoid a Magick-heavy fallback when no regeneration source is secured.",
    ],
    upgradeConflicts: excludedUpgradeConflicts(dataset, profile),
    bossRouteConsiderations: [
      profile.bossConsideration,
      profile.routeConsideration,
    ],
    contextRatings: Object.entries(profile.contextRatings).map(
      ([ratingContext, rating]) => ({
        context: ratingContext as
          "consistency" | "speed" | "safety" | "high-fear",
        rating,
        reason: contextReason(
          profile,
          ratingContext as "consistency" | "speed" | "safety" | "high-fear",
        ),
        limitation: contextLimitation(
          profile,
          ratingContext as "consistency" | "speed" | "safety" | "high-fear",
        ),
      }),
    ),
  };
}

function aspectRecords(
  dataset: CombinedDataset,
  identity: EditorialSourceIdentity,
  profiles: readonly AspectProfile[],
): readonly AspectGuideRecord[] {
  return profiles.map((profile) => {
    const strongest = aspectBuildVariant(
      dataset,
      identity,
      profile,
      "strongest",
    );
    const safestProfile: AspectProfile = {
      ...profile,
      ...profile.safest,
      safest: profile.safest,
    };
    const safest = aspectBuildVariant(
      dataset,
      identity,
      safestProfile,
      "safest",
    );
    const { goal: _goal, ...strongestFields } = strongest;

    return {
      recordType: "editorial/aspect-guide",
      id: profile.aspectId,
      aspectReference: reference("mechanics/weapon-aspect", profile.aspectId),
      context: context(dataset, "main-story", profile.aspectId),
      ...strongestFields,
      rankEvaluations: [
        {
          rank: "rank-one",
          rating: ratingFromProfile(profile, "rank-one"),
          reason: profile.rankOneEvaluation,
          limitation:
            profile.weaknesses[0] ??
            "Rank I still requires the recommended attack sequence.",
        },
        {
          rank: "maximum",
          rating: ratingFromProfile(profile, "maximum"),
          reason: profile.maximumRankEvaluation,
          limitation:
            profile.weaknesses[1] ??
            profile.weaknesses[0] ??
            "Maximum rank does not remove the aspect's execution requirement.",
        },
      ],
      beginnerDifficulty: profile.beginnerDifficulty,
      buildVariants: { strongest, safest },
    };
  });
}

function scoreRating(score: number): EditorialRating {
  if (score >= 4.5) return "S";
  if (score >= 3.5) return "A";
  if (score >= 2.5) return "B";
  if (score >= 1.5) return "C";
  return "D";
}

function weaponRecords(
  dataset: CombinedDataset,
  identity: EditorialSourceIdentity,
  aspects: readonly AspectGuideRecord[],
): readonly WeaponGuideRecord[] {
  const aspectById = new Map(aspects.map((record) => [record.id, record]));
  const aspectNameById = new Map(
    dataset.domains.weapons.aspects.map((record) => [record.id, record.name]),
  );
  return dataset.domains.weapons.weapons.map((weapon) => {
    const weaponAspects = dataset.domains.weapons.aspects
      .filter((record) => record.weaponId === weapon.id)
      .map((record) => aspectById.get(record.id))
      .filter((record): record is AspectGuideRecord => record !== undefined);
    const selectedCounts = new Map<
      string,
      { preferred: number; fallback: number }
    >();
    for (const aspectGuide of weaponAspects) {
      const preferredIds = new Set<string>();
      const fallbackIds = new Set<string>();
      for (const priority of aspectGuide.boonPriorities) {
        for (const entry of priority.preferred) {
          preferredIds.add(entry.reference.id);
        }
        for (const entry of priority.fallback) {
          fallbackIds.add(entry.reference.id);
        }
      }
      for (const target of aspectGuide.duoLegendaryTargets) {
        preferredIds.add(target.reference.id);
      }
      for (const id of preferredIds) {
        const counts = selectedCounts.get(id) ?? { preferred: 0, fallback: 0 };
        counts.preferred += 1;
        selectedCounts.set(id, counts);
      }
      for (const id of fallbackIds) {
        if (preferredIds.has(id)) continue;
        const counts = selectedCounts.get(id) ?? { preferred: 0, fallback: 0 };
        counts.fallback += 1;
        selectedCounts.set(id, counts);
      }
    }
    const boonRankings = dataset.domains.boons.boons
      .map((boon) => {
        const counts = selectedCounts.get(boon.id) ?? {
          preferred: 0,
          fallback: 0,
        };
        const rating: EditorialRating =
          counts.preferred >= Math.max(2, weaponAspects.length)
            ? "S"
            : counts.preferred > 0
              ? "A"
              : counts.fallback > 0
                ? "B"
                : "C";
        const reason =
          counts.preferred > 0
            ? "This Boon directly supports the core move used by at least one of this weapon’s recommended aspect plans."
            : counts.fallback > 0
              ? "This Boon preserves a compatible combat loop when a preferred god or core-slot blessing does not appear."
              : "This Boon is not part of the default plan for this weapon; judge it through the selected aspect instead.";
        return {
          reference: reference("mechanics/boon", boon.id),
          rating,
          reason,
          limitation:
            counts.preferred > 0
              ? "The weapon-level rating combines different aspect plans, so use the selected aspect guide for the final build."
              : "This rating does not imply the Boon is unusable in a situational or unlisted build.",
          prerequisiteReferences: boonPrerequisiteReferences(
            boon,
            new Set(dataset.domains.boons.boons.map((entry) => entry.id)),
          ),
        };
      })
      .sort(
        (left, right) =>
          ratingScore(right.rating) - ratingScore(left.rating) ||
          compareStrings(left.reference.id, right.reference.id),
      );
    const contexts = ["consistency", "speed", "safety", "high-fear"] as const;
    const contextRatings = contexts.map((ratingContext) => {
      const scores = weaponAspects.map((record) =>
        ratingScore(
          record.contextRatings.find((entry) => entry.context === ratingContext)
            ?.rating ?? "D",
        ),
      );
      const average =
        scores.length === 0
          ? 1
          : scores.reduce((sum, score) => sum + score, 0) / scores.length;
      const strongest = [...weaponAspects].sort((left, right) => {
        const leftRating =
          left.contextRatings.find((entry) => entry.context === ratingContext)
            ?.rating ?? "D";
        const rightRating =
          right.contextRatings.find((entry) => entry.context === ratingContext)
            ?.rating ?? "D";
        return (
          ratingScore(rightRating) - ratingScore(leftRating) ||
          compareStrings(left.id, right.id)
        );
      })[0];
      return {
        context: ratingContext,
        rating: scoreRating(average),
        reason:
          strongest === undefined
            ? "No authored aspect plan is available for this context."
            : ratingContext === "speed"
              ? `${aspectNameById.get(strongest.id) ?? strongest.id} gives this weapon its highest practical output for faster clears.`
              : `${aspectNameById.get(strongest.id) ?? strongest.id} is this weapon's safest option for learning and recovering from mistakes.`,
        limitation:
          "A weapon-level average hides aspect-specific strengths, weaknesses, and execution requirements.",
      };
    });
    const strongestAspect = [...weaponAspects].sort((left, right) => {
      const leftRating =
        left.contextRatings.find((entry) => entry.context === "consistency")
          ?.rating ?? "D";
      const rightRating =
        right.contextRatings.find((entry) => entry.context === "consistency")
          ?.rating ?? "D";
      return (
        ratingScore(rightRating) - ratingScore(leftRating) ||
        compareStrings(left.id, right.id)
      );
    })[0];
    return {
      recordType: "editorial/weapon-guide",
      id: weapon.id,
      weaponReference: reference("mechanics/weapon", weapon.id),
      context: context(dataset, "main-story"),
      overallRating: scoreRating(
        contextRatings.reduce(
          (sum, entry) => sum + ratingScore(entry.rating),
          0,
        ) / contextRatings.length,
      ),
      overallReason:
        "The overall rating balances consistency, speed, safety, and high-Fear performance across the weapon’s distinct aspect plans.",
      recommendation:
        strongestAspect === undefined
          ? "Choose the aspect whose main move matches the player's safest combat sequence."
          : `Start with ${aspectNameById.get(strongestAspect.id) ?? strongestAspect.id} for the weapon's most consistent plan.`,
      reason:
        "The weapon rating represents its full set of aspect plans; the chosen aspect determines the actual build and combat loop.",
      limitation:
        "A weapon-level average hides aspect-specific mechanics, so use the selected aspect guide for the final build.",
      prerequisiteReferences: [reference("mechanics/weapon", weapon.id)],
      fallback:
        "If the recommended aspect is still locked, use the unlocked aspect with the highest consistency rating and follow that aspect's Boon rankings.",
      verificationNotes: verificationNote(identity),
      aspectReferences: weaponAspects.map((record) => record.aspectReference),
      boonRankings,
      contextRatings,
    };
  });
}

function selectedAspectCounts(
  profiles: readonly AspectProfile[],
  field: "arcanaIds" | "familiarId" | "hexId",
): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();
  for (const profile of profiles) {
    const values = Array.isArray(profile[field])
      ? (profile[field] as readonly string[])
      : [profile[field] as string];
    for (const id of new Set(values)) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

function usageRating(count: number, total: number): EditorialRating {
  if (count >= Math.ceil(total * 0.5)) return "S";
  if (count >= Math.ceil(total * 0.2)) return "A";
  if (count > 0) return "B";
  return "C";
}

function tierRecords(
  dataset: CombinedDataset,
  identity: EditorialSourceIdentity,
  recordType: TierRatingRecord["recordType"],
  factualRecordType: string,
  records: readonly { readonly id: string }[],
  counts: ReadonlyMap<string, number>,
  aspectCount: number,
  profiles: readonly TierProfile[] = [],
): readonly TierRatingRecord[] {
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  return records.map((record) => {
    const selectionCount = counts.get(record.id) ?? 0;
    const profile = profileById.get(record.id);
    const rating = profile?.rating ?? usageRating(selectionCount, aspectCount);
    return {
      recordType,
      id: record.id,
      subjectReference: reference(factualRecordType, record.id),
      context: context(dataset, "first-route-clear"),
      rating,
      evaluationDimension: "new-player-value",
      recommendation:
        profile?.recommendation ??
        (selectionCount > 0
          ? "Prioritize it when it supports the selected aspect's recommended attack sequence."
          : "Treat it as a specialized option after the first reliable Arcana layout is complete."),
      reason:
        profile?.reason ??
        (selectionCount > 0
          ? "It supports one or more authored aspect plans without replacing their core combat loop."
          : "It is a specialized choice outside the default beginner aspect plans."),
      limitation:
        profile?.limitation ??
        "Its value still depends on the selected aspect, route, and current progression stage.",
      prerequisiteReferences: [],
      fallback:
        profile?.fallback ??
        "If this option does not support the selected aspect or is unavailable at the current progression stage, use the highest-rated available option that does.",
      verificationNotes: verificationNote(identity),
      recommendedByAspectCount: selectionCount,
      aspectCount,
    };
  });
}

function classifyBoon(
  id: string,
  kind: "duo" | "infusion" | "legendary" | "normal",
): {
  readonly rating: EditorialRating;
  readonly recommendation: string;
  readonly reason: string;
  readonly limitation: string;
  readonly fallback: string;
} {
  if (kind === "duo")
    return {
      rating: "B",
      recommendation:
        "Take it when the existing build already satisfies its prerequisite path.",
      reason:
        "Duo effects usually add a high-impact interaction without replacing a functioning core slot.",
      limitation:
        "It is too prerequisite-dependent to be the starting plan of an unseeded run.",
      fallback:
        "Keep improving the stronger prerequisite boon if the Duo never appears.",
    };
  if (kind === "legendary")
    return {
      rating: "S",
      recommendation:
        "Take it when offered unless it conflicts with the build's active combat loop.",
      reason:
        "Legendary effects are unique capstones with enough immediate ceiling to define a finished build.",
      limitation:
        "Its prerequisites make it unreliable to chase, but that availability cost does not reduce its pick value once offered.",
      fallback:
        "Take immediate scaling or defense rather than spending the run chasing its final prerequisite.",
    };
  if (kind === "infusion")
    return {
      rating: "C",
      recommendation:
        "Take it only when the current element count already reaches or can reliably reach its threshold.",
      reason:
        "An active Infusion can be efficient because existing elemental choices pay for the effect.",
      limitation:
        "Without the threshold, the pick contributes no dependable immediate value.",
      fallback:
        "Choose a boon that works immediately and preserve only elements already supporting the main build.",
    };
  if (/ManaBoon$|Mana.*Boon$/.test(id))
    return {
      rating: "A",
      recommendation:
        "Prioritize it when the aspect's main sequence repeatedly spends Magick.",
      reason:
        "Stable Magick recovery keeps Omega, Hex, and other resource-dependent actions available.",
      limitation:
        "Its value falls on a normal-move build that rarely spends Magick.",
      fallback:
        "Use a low-cost combat loop and take another recovery source when available.",
    };
  if (/LowHealth|MissingHealth|Alone|Sacrifice|TradeOff/.test(id))
    return {
      rating: "C",
      recommendation:
        "Use it only when the stated condition already matches the run plan.",
      reason:
        "The conditional payoff can be strong when no extra risk or rebuild is required.",
      limitation:
        "Forcing the condition can reduce consistency or invalidate a safer build.",
      fallback: "Take unconditional damage, health, or Magick value.",
    };
  if (/Armor|Shield|Heal|Health|Defense|Block/.test(id))
    return {
      rating: "B",
      recommendation:
        "Take it when survival is the current limit or the build already has enough damage.",
      reason:
        "Defensive value protects progress and makes unfamiliar encounters more repeatable.",
      limitation:
        "Too much defense can leave bosses and timed encounters underpowered.",
      fallback:
        "Take a compatible core damage boon if the current Life buffer is already comfortable.",
    };
  if (boonFocus(id) !== null)
    return {
      rating: "B",
      recommendation:
        "Use it when its slot is the aspect's primary damage move.",
      reason:
        "A compatible core-slot boon gives immediate, repeatable value and enables later synergy.",
      limitation:
        "The general rating cannot account for the speed, range, and hit pattern of every aspect.",
      fallback:
        "Choose the aspect guide's next compatible core boon instead of filling an unused slot.",
    };
  return {
    rating: "B",
    recommendation:
      "Take it when its effect strengthens the established build without delaying a missing core slot.",
    reason:
      "The effect offers useful general value once the run's main damage and resource loop function.",
    limitation:
      "Its exact value depends on the current aspect, route, and acquired prerequisites.",
    fallback:
      "Prioritize core damage, Magick recovery, or survival according to the run's current weakness.",
  };
}

function boonRecords(
  dataset: CombinedDataset,
  identity: EditorialSourceIdentity,
  profiles: readonly AspectProfile[],
): readonly BoonRatingRecord[] {
  const boonIds = new Set(dataset.domains.boons.boons.map((boon) => boon.id));
  const godNames = new Map(
    dataset.domains.boons.gods.map((god) => [god.id, god.name]),
  );
  const primaryCounts = new Map<string, number>();
  const fallbackCounts = new Map<string, number>();
  const documentedStandouts = new Set(["HeraManaBoon"]);
  for (const profile of profiles) {
    for (const id of new Set(profile.primaryBoonIds))
      primaryCounts.set(id, (primaryCounts.get(id) ?? 0) + 1);
    for (const id of new Set(profile.fallbackBoonIds))
      fallbackCounts.set(id, (fallbackCounts.get(id) ?? 0) + 1);
  }
  return dataset.domains.boons.boons.map((boon) => {
    const evaluation = classifyBoon(boon.id, boon.kind);
    const primaryCount = primaryCounts.get(boon.id) ?? 0;
    const fallbackCount = fallbackCounts.get(boon.id) ?? 0;
    const focus = boonFocus(boon.id);
    const owner =
      boon.godIds.length > 0
        ? ` from ${boon.godIds.map((id) => godNames.get(id) ?? id).join(" and ")}`
        : "";
    const rating: EditorialRating =
      boon.kind === "legendary" || documentedStandouts.has(boon.id)
        ? "S"
        : primaryCount >= Math.ceil(profiles.length * 0.25)
          ? "S"
          : primaryCount > 0
            ? "A"
            : fallbackCount > 0
              ? "B"
              : evaluation.rating;
    const reason =
      boon.kind === "legendary"
        ? `${boon.name} is a build-capstone Legendary Boon${owner}; its offer already proves the prerequisite package is present.`
        : documentedStandouts.has(boon.id)
          ? `${boon.name} provides broadly efficient Magick recovery and supports Omega-heavy plans across multiple weapon families.`
          : primaryCount > 0
            ? `${boon.name} is a primary recommendation${focus === null ? "" : ` for the ${focus} slot`} in at least one authored aspect plan.`
            : fallbackCount > 0
              ? `${boon.name} keeps at least one authored aspect plan functional when its preferred package is unavailable.`
              : `${boon.name} is a ${boon.kind} Boon${owner}. ${evaluation.reason}`;
    return {
      recordType: "editorial/boon-rating",
      id: `general:${boon.id}`,
      subjectReference: reference("mechanics/boon", boon.id),
      context: context(dataset, "main-story"),
      evaluationDimension: "general-value",
      rating,
      recommendation: evaluation.recommendation,
      reason,
      limitation: evaluation.limitation,
      prerequisiteReferences: [...prerequisiteIds(boon.prerequisites, boonIds)]
        .sort(compareStrings)
        .map((id) => reference("mechanics/boon", id)),
      fallback: evaluation.fallback,
      verificationNotes: verificationNote(identity),
    };
  });
}

function keepsakeJudgment(
  id: string,
  relationshipName: string | undefined,
  rarifyUses: number,
): Pick<KeepsakePriorityRecord, "priority" | keyof EditorialJudgment> {
  if (/^Force.*BoonKeepsake$/.test(id)) {
    if (relationshipName === undefined)
      throw new Error(`God keepsake ${id} has no public god name.`);
    return {
      priority: "A",
      recommendation: `Equip it in the first region when the build calls for a specific ${relationshipName} boon.`,
      reason: `It makes ${relationshipName} likely to appear${rarifyUses > 0 ? ` and lets you improve ${rarifyUses === 1 ? "one" : String(rarifyUses)} Common ${relationshipName} ${rarifyUses === 1 ? "boon" : "boons"}` : ""}, giving the build a reliable opening without spending rerolls just to find that god.`,
      limitation:
        rarifyUses > 0
          ? `The forced ${relationshipName} offer and ${rarifyUses === 1 ? "the one-use Rarify charge are" : `the ${rarifyUses} Rarify charges are`} separate benefits. The keepsake has finished its job only after both are spent.`
          : `The keepsake has finished its job after the forced ${relationshipName} offer is consumed.`,
      prerequisiteReferences: [],
      fallback:
        "Use Luckier Tooth when the build does not need to force its opening god.",
      verificationNotes:
        "Policy reviewed against the normalized keepsake effect and acquisition record.",
    };
  }
  const judgments: Readonly<
    Record<
      string,
      Pick<KeepsakePriorityRecord, "priority" | keyof EditorialJudgment>
    >
  > = {
    ArmorGainKeepsake: {
      priority: "A",
      recommendation:
        "Take it through early regions while you can preserve its Armor between chambers.",
      reason:
        "The starting Armor absorbs mistakes, and every chamber cleared before it breaks adds more Armor.",
      limitation:
        "After all Armor is lost, it cannot rebuild itself and should be replaced at the next cabinet.",
      prerequisiteReferences: [],
      fallback:
        "Use Luckier Tooth when chip damage makes preserving Armor unrealistic.",
      verificationNotes: "Reviewed against the keepsake effect and route use.",
    },
    AthenaEncounterKeepsake: {
      priority: "B",
      recommendation:
        "Equip it only after every Death Defiance is gone and an Athena encounter can rescue the night.",
      reason:
        "It can add one Athena encounter with defensive boons when the run has no Death Defiance left.",
      limitation:
        "It does nothing while any Death Defiance remains and can trigger only once per night.",
      prerequisiteReferences: [],
      fallback:
        "Use Luckier Tooth before the run if you still have a keepsake cabinet and need a guaranteed recovery.",
      verificationNotes:
        "Reviewed against the keepsake effect and Athena encounter condition.",
    },
    BlockDeathKeepsake: {
      priority: "A",
      recommendation:
        "Level it early when one difficult room, not steady chip damage, is ending promising nights.",
      reason:
        "The first fatal hit becomes a timed chance to clear the encounter and return with 30 Life.",
      limitation:
        "If the room cannot be cleared before the invulnerability expires, it provides no recovery.",
      prerequisiteReferences: [],
      fallback:
        "Use Luckier Tooth for an automatic recovery that does not depend on clearing the room in time.",
      verificationNotes:
        "Reviewed against the keepsake effect and survival use.",
    },
    BonusMoneyKeepsake: {
      priority: "B",
      recommendation:
        "Start with it when an early shop or expensive Well purchase is part of the route plan.",
      reason:
        "Its 100 Gold is granted immediately, so the keepsake can be replaced at the first cabinet without losing value.",
      limitation:
        "It adds no combat power unless the extra Gold is converted into a useful purchase.",
      prerequisiteReferences: [],
      fallback:
        "Use the build's god keepsake when securing the first core boon matters more than an early purchase.",
      verificationNotes:
        "Reviewed against the keepsake effect and early-shop timing.",
    },
    BossMetaUpgradeKeepsake: {
      priority: "B",
      recommendation:
        "Equip it before a Guardian when two random inactive Arcana Cards could improve the rest of the night.",
      reason:
        "Defeating the next Guardian activates two inactive Arcana Cards at the keepsake's current rank.",
      limitation:
        "The cards are random, and the effect is wasted if the inactive pool offers little value.",
      prerequisiteReferences: [],
      fallback:
        "Use Knuckle Bones when defeating that Guardian is less certain than benefiting from the reward afterward.",
      verificationNotes:
        "Reviewed against the keepsake effect and Guardian timing.",
    },
    BossPreDamageKeepsake: {
      priority: "A",
      recommendation:
        "Equip it before the region whose Guardian is the run's remaining obstacle.",
      reason:
        "The next Guardian starts with 5% less Life, and all Guardian damage against you is reduced by 10%.",
      limitation:
        "It contributes little in ordinary rooms, so do not equip it early when reaching the Guardian is still unreliable.",
      prerequisiteReferences: [],
      fallback:
        "Use Luckier Tooth when ordinary rooms are consuming more Life than the Guardian.",
      verificationNotes:
        "Reviewed against the keepsake effect and Guardian use.",
    },
    DamagedDamageBoostKeepsake: {
      priority: "B",
      recommendation:
        "Use it on an Omega-heavy build only when taking 250 damage during the night is plausible.",
      reason:
        "After the damage threshold is met, its permanent Omega damage bonus can carry the remaining regions.",
      limitation:
        "It offers nothing before activation and rewards a damage total that safer runs may never reach.",
      prerequisiteReferences: [],
      fallback:
        "Use the opening god keepsake when the Omega build still lacks its core boon or Magick recovery.",
      verificationNotes:
        "Reviewed against the keepsake threshold and Omega bonus.",
    },
    DeathVengeanceKeepsake: {
      priority: "B",
      recommendation:
        "Equip it for a rematch when one known foe or Guardian ended the previous night.",
      reason:
        "Its 20% damage bonus applies directly to the last foe that defeated you.",
      limitation:
        "It adds no damage against other foes and loses purpose after the targeted obstacle is overcome.",
      prerequisiteReferences: [],
      fallback:
        "Use Knuckle Bones for a broader Guardian bonus when the previous defeat is not the only problem.",
      verificationNotes:
        "Reviewed against the keepsake target and rematch use.",
    },
    DecayingBoostKeepsake: {
      priority: "B",
      recommendation:
        "Start with it when immediate early-region damage matters more than power that lasts all night.",
      reason:
        "The 30% opening damage bonus is strongest before encounters reduce it.",
      limitation:
        "Losing 5 percentage points after every encounter makes it a poor late-region keepsake.",
      prerequisiteReferences: [],
      fallback:
        "Use a god keepsake when the build needs a core boon more than temporary damage.",
      verificationNotes:
        "Reviewed against the keepsake's decaying damage bonus.",
    },
    DoorHealReserveKeepsake: {
      priority: "A",
      recommendation:
        "Use it while learning a region when repeated small hits are the main source of lost Life.",
      reason:
        "It restores Life after each chamber until its 50-Life reserve is exhausted.",
      limitation:
        "Large bursts can still cause a Death Defiance before the next chamber exit, and the reserve does not refill.",
      prerequisiteReferences: [],
      fallback:
        "Use Luckier Tooth when a single fatal mistake is more likely than steady chip damage.",
      verificationNotes: "Reviewed against the keepsake's healing reserve.",
    },
    EscalatingKeepsake: {
      priority: "C",
      recommendation:
        "Use it only on a confident clear where growing damage is worth taking equally more damage.",
      reason:
        "Every encounter raises both outgoing and incoming damage, so its benefit grows with the length of the night.",
      limitation:
        "The incoming-damage increase makes it a poor progression choice when survival is not already stable.",
      prerequisiteReferences: [],
      fallback:
        "Use Knuckle Bones for boss damage without increasing all damage taken.",
      verificationNotes:
        "Reviewed against the escalating outgoing and incoming damage modifiers.",
    },
    FountainRarityKeepsake: {
      priority: "B",
      recommendation:
        "Equip it before a region where the next Fountain is likely and a Common core boon still needs improvement.",
      reason:
        "It improves Fountain healing and upgrades one random Common boon to Rare at the next Fountain.",
      limitation:
        "The boon upgrade is random and provides no value if no Common boon remains when the Fountain appears.",
      prerequisiteReferences: [],
      fallback:
        "Use the relevant god keepsake when the needed core boon has not appeared yet.",
      verificationNotes:
        "Reviewed against the Fountain healing and rarity effects.",
    },
    GoldifyKeepsake: {
      priority: "B",
      recommendation:
        "Use it for a Gold-focused night when unwanted chamber rewards can be converted into planned purchases.",
      reason:
        "It can purge up to two eligible rewards for Gold while the Fates' Whim is active.",
      limitation:
        "It is unavailable outside that condition and trades the skipped reward for spending power rather than permanent progress.",
      prerequisiteReferences: [],
      fallback:
        "Take the chamber reward normally when it advances the build or the current permanent-resource target.",
      verificationNotes:
        "Reviewed against the reward-purge condition and use limit.",
    },
    HadesAndPersephoneKeepsake: {
      priority: "B",
      recommendation:
        "Use it during the Fates' Whim when a random Hades blessing and an immediate boon-level boost fit the run.",
      reason:
        "It supplies a Hades blessing and raises most existing boons by one level.",
      limitation:
        "It is unavailable outside the Fates' Whim, and the random blessing may not support the chosen build.",
      prerequisiteReferences: [],
      fallback:
        "Use a god keepsake when the build still needs a particular core boon.",
      verificationNotes:
        "Reviewed against the conditional Hades blessing and boon-level effect.",
    },
    LowHealthCritKeepsake: {
      priority: "C",
      recommendation:
        "Use it for one region only when the build can avoid damage and convert 20% Critical chance into a fast clear.",
      reason: "It grants a large Critical chance for the region.",
      limitation:
        "Maximum Life is capped at 30, turning small mistakes into fatal ones.",
      prerequisiteReferences: [],
      fallback:
        "Use Knuckle Bones for safer Guardian damage or Luckier Tooth for survival.",
      verificationNotes:
        "Reviewed against the regional Critical bonus and Life cap.",
    },
    ManaOverTimeRefundKeepsake: {
      priority: "B",
      recommendation:
        "Use it when an Omega or Hex build needs a larger Magick pool before its recovery is established.",
      reason:
        "The additional 50 maximum Magick lets the build channel more before recovery becomes the limiting factor.",
      limitation:
        "Maximum Magick does not replace reliable regeneration during long encounters.",
      prerequisiteReferences: [],
      fallback:
        "Use the god keepsake for a Magick-recovery boon when sustained channeling matters more than the larger pool.",
      verificationNotes: "Reviewed against the maximum-Magick effect.",
    },
    RandomBlessingKeepsake: {
      priority: "B",
      recommendation:
        "Use it when the build is already functional and can accept a changing Chaos bonus.",
      reason:
        "It grants a Common Chaos blessing immediately and replaces it after every eight encounters.",
      limitation:
        "The blessing is random and may change away from an effect the build was using.",
      prerequisiteReferences: [],
      fallback:
        "Use a god keepsake when the run still needs a predictable core boon.",
      verificationNotes: "Reviewed against the random Chaos blessing cycle.",
    },
    RarifyKeepsake: {
      priority: "B",
      recommendation:
        "Use it during the Fates' Whim when two already-useful Olympian boons are worth improving.",
      reason: "It can raise the rarity of up to two eligible Olympian boons.",
      limitation:
        "It is unavailable outside the Fates' Whim and cannot rescue a build that lacks the right boons.",
      prerequisiteReferences: [],
      fallback:
        "Use the matching god keepsake when finding the core boon is still the first problem.",
      verificationNotes:
        "Reviewed against the rarity-upgrade condition and use limit.",
    },
    ReincarnationKeepsake: {
      priority: "A",
      recommendation:
        "Level it early and equip it after the opening god is secured when one extra recovery can preserve a clear.",
      reason:
        "It automatically restores Life once after a fatal hit, with no timing or room-clear condition.",
      limitation:
        "After it triggers, it provides no second recovery and should be replaced at the next cabinet.",
      prerequisiteReferences: [],
      fallback:
        "Use Silken Sash or Ghost Onion when preventing steady room damage is more valuable than recovering once.",
      verificationNotes: "Reviewed against the one-use recovery effect.",
    },
    SkipEncounterKeepsake: {
      priority: "B",
      recommendation:
        "Use it when shortening a difficult or time-limited route matters more than adding direct combat power.",
      reason:
        "It can remove one combat encounter from one or more regions according to its rank.",
      limitation:
        "The skipped encounter also removes a chance to earn its normal reward.",
      prerequisiteReferences: [],
      fallback:
        "Use a combat keepsake when the build needs power more than a shorter route.",
      verificationNotes: "Reviewed against the regional encounter-skip effect.",
    },
    SpellTalentKeepsake: {
      priority: "B",
      recommendation:
        "Start with it when the planned build depends on a particular Hex and Path of Stars upgrades.",
      reason:
        "It makes a Selene reward likely, and the next Path of Stars grants three additional upgrades.",
      limitation:
        "It adds little if the build does not intend to spend Magick often enough to charge a Hex.",
      prerequisiteReferences: [],
      fallback:
        "Use the build's Olympian keepsake when the core boon package is still missing.",
      verificationNotes:
        "Reviewed against the Selene and Path of Stars effects.",
    },
    TempHammerKeepsake: {
      priority: "B",
      recommendation:
        "Use it early when the weapon benefits from almost any compatible Hammer and ten encounters cover the needed route segment.",
      reason:
        "It grants one random compatible Hammer immediately for ten encounters.",
      limitation:
        "The Hammer is random and disappears when the encounter timer ends.",
      prerequisiteReferences: [],
      fallback:
        "Use a god keepsake when a predictable boon matters more than a temporary weapon upgrade.",
      verificationNotes: "Reviewed against the random Hammer and timer.",
    },
    TimedBuffKeepsake: {
      priority: "B",
      recommendation:
        "Use it at the start of a route or timed challenge where the next 200 seconds contain meaningful combat.",
      reason:
        "The movement, attack, and channel-speed bonus is immediate and can accelerate several early encounters.",
      limitation:
        "The effect expires after 200 seconds whether or not that time was spent fighting.",
      prerequisiteReferences: [],
      fallback:
        "Use Lion Fang for an encounter-based early damage bonus that does not count down in real time.",
      verificationNotes: "Reviewed against the timed speed effect.",
    },
    UnpickedBoonKeepsake: {
      priority: "B",
      recommendation:
        "Use it after the core slots are safe to fill with an unpredictable extra boon.",
      reason:
        "Once per night, a boon choice has a 25% chance to grant one additional random option from the same offering.",
      limitation:
        "The extra boon is random and can occupy a core slot the build intended to reserve.",
      prerequisiteReferences: [],
      fallback:
        "Use a god keepsake while the build still needs a specific opening boon.",
      verificationNotes:
        "Reviewed against the one-use random extra-boon effect.",
    },
  };
  const judgment = judgments[id];
  if (judgment === undefined)
    throw new Error(`Keepsake ${id} has no authored public judgment.`);
  return judgment;
}

function keepsakeRecords(
  dataset: CombinedDataset,
  identity: EditorialSourceIdentity,
): readonly KeepsakePriorityRecord[] {
  return dataset.domains.loadouts.keepsakes.map((keepsake) => {
    const godName = dataset.domains.boons.gods.find(
      (god) => god.id === keepsake.relationshipId,
    )?.name;
    const judgment = keepsakeJudgment(
      keepsake.id,
      godName ?? keepsake.relationshipName,
      keepsakeRarifyUses(dataset, keepsake.id),
    );
    const lifecycle = keepsakeLifecycle(keepsake.id);
    return {
      recordType: "mechanics/keepsake",
      id: keepsake.id,
      subjectReference: reference("mechanics/keepsake", keepsake.id),
      context: context(dataset, "first-route-clear"),
      ...judgment,
      reason: judgment.reason,
      lifecycle,
      switchWhenInactive: keepsakeInactiveSwitch(
        keepsake.id,
        lifecycle,
        keepsakeRarifyUses(dataset, keepsake.id),
      ),
      verificationNotes: `${judgment.verificationNotes} ${verificationNote(identity)}`,
    };
  });
}

function resourceIdsForReference(
  dataset: CombinedDataset,
  item: EditorialReference,
): readonly string[] {
  if (item.recordType === "mechanics/weapon") {
    return (
      dataset.domains.weapons.weapons
        .find((record) => record.id === item.id)
        ?.unlockCosts?.map((cost) => cost.resourceId) ?? []
    );
  }
  if (item.recordType === "mechanics/weapon-aspect") {
    return (
      dataset.domains.weapons.aspects
        .find((record) => record.id === item.id)
        ?.ranks?.flatMap((rank) => rank.costs.map((cost) => cost.resourceId)) ??
      []
    );
  }
  if (item.recordType === "mechanics/arcana-card") {
    const card = dataset.domains.arcana.cards.find(
      (record) => record.id === item.id,
    );
    return card === undefined
      ? []
      : [
          ...(card.unlockCosts ?? []),
          ...(card.ranks?.flatMap((rank) => rank.upgradeFromPreviousCosts) ??
            []),
        ].map((cost) => cost.resourceId);
  }
  if (item.recordType === "mechanics/familiar") {
    return (
      dataset.domains.loadouts.familiars
        .find((record) => record.id === item.id)
        ?.upgrades?.flatMap((upgrade) =>
          upgrade.ranks.flatMap((rank) =>
            rank.costs.map((cost) => cost.resourceId),
          ),
        ) ?? []
    );
  }
  if (item.recordType === "mechanics/incantation") {
    return (
      dataset.domains.loadouts.incantations
        .find((record) => record.id === item.id)
        ?.costs?.map((cost) => cost.resourceId) ?? []
    );
  }
  return [];
}

function resourceRecords(
  dataset: CombinedDataset,
  identity: EditorialSourceIdentity,
  stages: readonly ProgressionStageSource[],
): readonly ResourceAdviceRecord[] {
  const explicitAdvice = {
    MemPointsCommon: {
      stage: "first-route-clear",
      priority: "S",
      policy: "spend-for-next-target",
      recommendation:
        "Spend it on Grasp until the first complete Arcana loadout fits, then fund the next planned capacity increase.",
      reason:
        "Grasp determines how many Arcana Cards can be active and is the first permanent capacity constraint.",
    },
    MetaCurrency: {
      stage: "first-route-clear",
      priority: "A",
      policy: "spend-for-next-target",
      recommendation:
        "Trade it only for the resource shortage blocking the next named permanent upgrade.",
      reason:
        "Its exchange value is most useful when it closes an exact weapon, Arcana, incantation, or relationship cost.",
    },
    PlantFNightshadeSeed: {
      stage: "main-story",
      priority: "B",
      policy: "reserve",
      recommendation:
        "Grow and reserve it for the next revealed incantation or tracked Grasp objective before planting surplus seeds.",
      reason:
        "Its known use overlaps permanent progression and a Grasp prophecy rather than immediate run power.",
    },
    CharonPoints: {
      stage: "main-story",
      priority: "B",
      policy: "spend-for-next-target",
      recommendation:
        "Redeem it when Charon's Crossroads stash is available instead of carrying an unused balance.",
      reason:
        "The currency has one known reward path and a related prophecy, so delaying redemption adds no route value.",
    },
    SuperGiftPoints: {
      stage: "main-story",
      priority: "B",
      policy: "reserve",
      recommendation:
        "Reserve it for the next relationship or Familiar objective named by the current story and completion checklist.",
      reason:
        "Its known uses advance late relationships, Familiar upgrades, and hidden-aspect objectives.",
    },
    GemPoints: {
      stage: "practical-postgame",
      priority: "B",
      policy: "reserve",
      recommendation:
        "Reserve it for the next Chaos Trial package or tracked Fear objective.",
      reason:
        "Its known uses belong to challenge packages and a Fear-related prophecy after ordinary route progress is stable.",
    },
    Mixer5Common: {
      stage: "practical-postgame",
      priority: "B",
      policy: "reserve",
      recommendation:
        "Reserve it for the next maximum aspect rank or all-weapon completion target.",
      reason:
        "Its known uses support maximum weapon strength and broad aspect or Familiar completion.",
    },
    CosmeticsPoints: {
      stage: "exhaustive-completion",
      priority: "D",
      policy: "optional",
      recommendation:
        "Spend it only on a tracked decoration requirement after combat and story purchases are funded.",
      reason: "Its known use is cosmetic completion rather than route power.",
    },
    DreamPoints: {
      stage: "exhaustive-completion",
      priority: "D",
      policy: "optional",
      recommendation:
        "Spend it only on a tracked decorative requirement after practical completion.",
      reason:
        "Its known use is decorative and does not strengthen a normal progression run.",
    },
  } as const;
  const prioritizedUses = new Map<
    string,
    {
      readonly stage: ProgressionStageSource;
      readonly priority: ProgressionPriority;
    }[]
  >();
  for (const stage of stages) {
    for (const priority of stage.priorityReferences) {
      for (const resourceId of new Set(
        resourceIdsForReference(dataset, priority.reference),
      )) {
        const uses = prioritizedUses.get(resourceId) ?? [];
        uses.push({ stage, priority });
        prioritizedUses.set(resourceId, uses);
      }
    }
  }
  return dataset.domains.guide.resources.map((resource) => {
    const uses = [...(prioritizedUses.get(resource.id) ?? [])].sort(
      (left, right) =>
        left.stage.order - right.stage.order ||
        left.priority.order - right.priority.order,
    );
    const recommendedUseReferences = uses
      .map((entry) => entry.priority.reference)
      .filter(
        (item, index, values) =>
          values.findIndex((candidate) => key(candidate) === key(item)) ===
          index,
      );
    const firstUse = uses[0];
    const explicit = explicitAdvice[resource.id as keyof typeof explicitAdvice];
    const optional = /Cosmetic|Badge|Music|Gift/.test(resource.id);
    const scarce = /Boss|WeaponPoint|CardUpgrade|Familiar|Nightmare|Mixer/.test(
      resource.id,
    );
    const policy =
      explicit?.policy ??
      (optional ? "optional" : scarce ? "reserve" : "spend-for-next-target");
    const priority: EditorialRating =
      explicit?.priority ??
      (firstUse?.priority.required === true && firstUse.stage.order === 1
        ? "S"
        : firstUse !== undefined && firstUse.stage.order <= 2
          ? "A"
          : firstUse !== undefined || scarce
            ? "B"
            : optional
              ? "D"
              : "C");
    const recommendation =
      explicit?.recommendation ??
      (policy === "optional"
        ? "Spend it only after the current progression purchase is funded."
        : policy === "reserve"
          ? "Reserve it for the next named unlock or rank and avoid unplanned sidegrades."
          : "Spend it on the next permanent progression target rather than accumulating it without a plan.");
    return {
      recordType: "mechanics/resource",
      id: resource.id,
      subjectReference: reference("mechanics/resource", resource.id),
      context: context(
        dataset,
        explicit?.stage ?? firstUse?.stage.endpoint ?? "main-story",
      ),
      policy,
      priority,
      earliestRecommendedStage:
        explicit?.stage ?? firstUse?.stage.endpoint ?? "unprioritized",
      recommendedUseReferences,
      recommendation,
      reason:
        explicit?.reason ??
        (firstUse !== undefined
          ? `The first ordered guide target that spends this resource is ${firstUse.priority.reference.recordType}:${firstUse.priority.reference.id}.`
          : resource.useReferences.length > 0
            ? "The resource has concrete uses, so tying spending to the next target prevents duplicate farming."
            : "No current use is known, so this resource should not drive the primary route until one appears."),
      limitation:
        "A newly revealed incantation or upgrade can change the nearest useful target on a later night.",
      prerequisiteReferences: [],
      fallback: "Hold the resource and recheck its uses after the next unlock.",
      verificationNotes: verificationNote(identity),
    };
  });
}

function usefulAlias(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function aliasRecords(dataset: CombinedDataset): readonly SearchAliasRecord[] {
  const weaponNames = new Map(
    dataset.domains.weapons.weapons.map((weapon) => [weapon.id, weapon.name]),
  );
  const godNames = new Map(
    dataset.domains.boons.gods.map((god) => [god.id, god.name]),
  );
  const records: SearchAliasRecord[] = [];
  const aspectShortNames = dataset.domains.weapons.aspects.map((aspect) =>
    aspect.name.replace(/^Aspect of (the )?/i, ""),
  );
  for (const aspect of dataset.domains.weapons.aspects) {
    const shortName = aspect.name.replace(/^Aspect of (the )?/i, "");
    const weaponName = weaponNames.get(aspect.weaponId) ?? "weapon";
    const aliases = [usefulAlias(`${shortName} ${weaponName}`)];
    if (aspectShortNames.filter((name) => name === shortName).length === 1)
      aliases.push(usefulAlias(`${shortName} aspect`));
    records.push({
      recordType: "foundation/record-metadata",
      id: `mechanics/weapon-aspect:${aspect.id}`,
      subjectReference: reference("mechanics/weapon-aspect", aspect.id),
      aliases,
    });
  }
  for (const boon of dataset.domains.boons.boons) {
    const focus = coreBoonAliasSlot(boon.id);
    if (focus === null || boon.godIds.length !== 1) continue;
    const godName = godNames.get(boon.godIds[0] ?? "");
    if (godName === undefined) continue;
    const slot = focus === "omega" ? "magick gain" : focus;
    records.push({
      recordType: "foundation/record-metadata",
      id: `mechanics/boon:${boon.id}`,
      subjectReference: reference("mechanics/boon", boon.id),
      aliases: [usefulAlias(`${godName} ${slot}`)],
    });
  }
  for (const keepsake of dataset.domains.loadouts.keepsakes) {
    const relationshipName =
      godNames.get(keepsake.relationshipId) ?? keepsake.relationshipName;
    records.push({
      recordType: "foundation/record-metadata",
      id: `mechanics/keepsake:${keepsake.id}`,
      subjectReference: reference("mechanics/keepsake", keepsake.id),
      aliases: [usefulAlias(`${relationshipName} keepsake`)],
    });
  }
  return records.sort((left, right) => compareStrings(left.id, right.id));
}

function allReferences(
  dataset: EditorialDataset,
): readonly EditorialReference[] {
  return [
    ...dataset.progressionStages.flatMap((record) => [
      ...record.prerequisiteReferences,
      ...record.loadoutReferences,
      ...record.priorityReferences.map((entry) => entry.reference),
      ...record.parallelObjectiveReferences,
      ...record.completionReferences,
    ]),
    ...dataset.aspectGuides.flatMap((record) => [
      record.aspectReference,
      ...record.prerequisiteReferences,
      ...record.arcanaLoadout.flatMap((entry) => [
        entry.reference,
        ...entry.prerequisiteReferences,
      ]),
      ...record.keepsakeRoute.map((entry) => entry.reference),
      ...record.familiarHex.flatMap((entry) => [
        entry.reference,
        ...entry.prerequisiteReferences,
      ]),
      ...record.boonPriorities.flatMap((priority) =>
        [...priority.preferred, ...priority.fallback].flatMap((rating) => [
          rating.reference,
          ...rating.prerequisiteReferences,
        ]),
      ),
      ...record.boonRankings.flatMap((rating) => [
        rating.reference,
        ...rating.prerequisiteReferences,
      ]),
      ...record.duoLegendaryTargets.flatMap((rating) => [
        rating.reference,
        ...rating.prerequisiteReferences,
      ]),
      ...record.hammerRankings.flatMap((rating) => [
        rating.reference,
        ...rating.prerequisiteReferences,
      ]),
      ...record.buildInteractions.flatMap((entry) => entry.references),
      ...record.upgradeConflicts.flatMap((entry) => entry.references),
      ...Object.values(record.buildVariants).flatMap((variant) => [
        ...variant.prerequisiteReferences,
        ...variant.arcanaLoadout.flatMap((entry) => [
          entry.reference,
          ...entry.prerequisiteReferences,
        ]),
        ...variant.keepsakeRoute.map((entry) => entry.reference),
        ...variant.familiarHex.flatMap((entry) => [
          entry.reference,
          ...entry.prerequisiteReferences,
        ]),
        ...variant.boonPriorities.flatMap((priority) =>
          [...priority.preferred, ...priority.fallback].flatMap((rating) => [
            rating.reference,
            ...rating.prerequisiteReferences,
          ]),
        ),
        ...variant.boonRankings.flatMap((rating) => [
          rating.reference,
          ...rating.prerequisiteReferences,
        ]),
        ...variant.duoLegendaryTargets.flatMap((rating) => [
          rating.reference,
          ...rating.prerequisiteReferences,
        ]),
        ...variant.hammerRankings.flatMap((rating) => [
          rating.reference,
          ...rating.prerequisiteReferences,
        ]),
        ...variant.buildInteractions.flatMap((entry) => entry.references),
        ...variant.upgradeConflicts.flatMap((entry) => entry.references),
      ]),
    ]),
    ...dataset.weaponGuides.flatMap((record) => [
      record.weaponReference,
      ...record.prerequisiteReferences,
      ...record.aspectReferences,
      ...record.boonRankings.flatMap((rating) => [
        rating.reference,
        ...rating.prerequisiteReferences,
      ]),
    ]),
    ...dataset.boonRatings.flatMap((record) => [
      record.subjectReference,
      ...record.prerequisiteReferences,
    ]),
    ...[
      ...dataset.arcanaRatings,
      ...dataset.familiarRatings,
      ...dataset.hexRatings,
    ].flatMap((record) => [
      record.subjectReference,
      ...record.prerequisiteReferences,
    ]),
    ...dataset.keepsakePriorities.map((record) => record.subjectReference),
    ...dataset.resourceAdvice.flatMap((record) => [
      record.subjectReference,
      ...record.recommendedUseReferences,
    ]),
    ...dataset.searchAliases.map((record) => record.subjectReference),
  ];
}

function nonempty(value: string): boolean {
  return value.trim().length > 0;
}

function invalidRatedReference(record: RatedReference): boolean {
  return !nonempty(record.reason) || !nonempty(record.limitation);
}

function invalidBuildTarget(record: BuildTargetReference): boolean {
  return (
    invalidRatedReference(record) ||
    !nonempty(record.requirementSummary) ||
    record.requirementGroups.length === 0 ||
    record.requirementGroups.some((group) => group.length === 0) ||
    record.selectedPrerequisites.length !== record.requirementGroups.length
  );
}

function invalidPowerBreakpoint(record: BuildPowerBreakpoint): boolean {
  return (
    !nonempty(record.title) ||
    !nonempty(record.condition) ||
    !nonempty(record.effect) ||
    record.references.length === 0
  );
}

function invalidJudgment(
  record: EditorialJudgment & {
    readonly id: string;
    readonly context: EditorialContext;
  },
  source: EditorialDataset["source"],
): boolean {
  return (
    ![
      record.recommendation,
      record.reason,
      record.limitation,
      record.fallback,
      record.verificationNotes,
      record.context.progressionStage,
    ].every(nonempty) ||
    record.context.reader !== "new-player" ||
    record.context.steamBuildId !== source.steamBuildId ||
    record.context.executableVersion !== source.executableVersion ||
    record.context.packageVersion !== source.packageVersion
  );
}

function invalidRecords(
  editorial: EditorialDataset,
  combined: CombinedDataset,
): readonly string[] {
  const invalid: string[] = [];
  const boonIds = new Set(
    combined.domains.boons.boons.map((record) => record.id),
  );
  const aspectIdsByWeapon = new Map(
    combined.domains.weapons.weapons.map((weapon) => [
      weapon.id,
      new Set(
        combined.domains.weapons.aspects
          .filter((aspect) => aspect.weaponId === weapon.id)
          .map((aspect) => aspect.id),
      ),
    ]),
  );
  const requiredLoadoutTypes = [
    "mechanics/weapon",
    "mechanics/weapon-aspect",
    "mechanics/arcana-card",
    "mechanics/keepsake",
    "mechanics/familiar",
    "mechanics/hex",
  ];
  const requiredBoonSlots = new Set(boonSlots);
  const arcanaProfileIds = new Set<string>(
    arcanaProfiles.map((profile) => profile.id),
  );
  for (const record of editorial.progressionStages) {
    const loadoutTypes = new Set(
      record.loadoutReferences.map((entry) => entry.recordType),
    );
    const priorityOrders = record.priorityReferences.map(
      (entry) => entry.order,
    );
    if (
      invalidJudgment(record, editorial.source) ||
      record.readerKnowledge.length === 0 ||
      record.actionSequence.length < 5 ||
      requiredLoadoutTypes.some(
        (recordType) => !loadoutTypes.has(recordType),
      ) ||
      record.purchaseUpgradePriorities.length === 0 ||
      record.resourcePolicy.length === 0 ||
      record.loadoutReferences.length === 0 ||
      record.priorityReferences.length === 0 ||
      priorityOrders.some((order, index) => order !== index + 1) ||
      record.priorityReferences.some((entry) => !nonempty(entry.reason)) ||
      record.boonEncounterPriorities.length === 0 ||
      record.routeLateGame.length === 0 ||
      record.completionChecklist.length === 0 ||
      record.completionReferences.length === 0
    ) {
      invalid.push(`${record.recordType}:${record.id}`);
    }
  }
  for (const record of editorial.weaponGuides) {
    const rankedBoonIds = new Set(
      record.boonRankings.map((entry) => entry.reference.id),
    );
    const referencedAspectIds = new Set(
      record.aspectReferences.map((entry) => entry.id),
    );
    const expectedAspectIds =
      aspectIdsByWeapon.get(record.id) ?? new Set<string>();
    if (
      invalidJudgment(record, editorial.source) ||
      !nonempty(record.overallReason) ||
      record.aspectReferences.length === 0 ||
      record.boonRankings.length !== boonIds.size ||
      rankedBoonIds.size !== boonIds.size ||
      [...rankedBoonIds].some((id) => !boonIds.has(id)) ||
      referencedAspectIds.size !== expectedAspectIds.size ||
      [...referencedAspectIds].some((id) => !expectedAspectIds.has(id)) ||
      record.boonRankings.some(invalidRatedReference) ||
      record.contextRatings.length !== 4 ||
      record.contextRatings.some(
        (entry) => !nonempty(entry.reason) || !nonempty(entry.limitation),
      )
    ) {
      invalid.push(`${record.recordType}:${record.id}`);
    }
  }
  for (const record of editorial.aspectGuides) {
    const rankedBoonIds = new Set(
      record.boonRankings.map((entry) => entry.reference.id),
    );
    const excludedHammerIds = new Set(
      combined.domains.weapons.hammers
        .filter((hammer) =>
          hammer.compatibility.excludedAspectIds.includes(record.id),
        )
        .map((hammer) => hammer.id),
    );
    const conflictHammerIds = new Set(
      record.upgradeConflicts.flatMap((entry) =>
        entry.references.map((item) => item.id),
      ),
    );
    const expectedGrasp = record.arcanaLoadout.reduce(
      (sum, entry) =>
        sum +
        (combined.domains.arcana.cards.find(
          (card) => card.id === entry.reference.id,
        )?.graspCost ?? 0),
      0,
    );
    const keepsakeStages = new Set(
      record.keepsakeRoute.map((entry) => entry.stage),
    );
    const preferredHammerIds = new Set(
      preferredHammersByAspect[
        record.id as keyof typeof preferredHammersByAspect
      ] ?? [],
    );
    const rewardKinds = new Set(
      record.rewardPriorities.map((entry) => entry.reward),
    );
    const boonPrioritySlots = new Set(
      record.boonPriorities.map((priority) => priority.slot),
    );
    const rewardRuleKinds = new Set<string>(
      record.rewardDecisionRules.map((entry) => entry.choose),
    );
    const requiredRewardRuleKinds = new Set<string>([
      "core-boon",
      "hammer",
      "maximum-life",
      "permanent-resource",
      "pom",
      "duo-legendary",
    ]);
    const variantEntries = Object.entries(record.buildVariants) as readonly [
      BuildGoal,
      AspectBuildVariantRecord,
    ][];
    const invalidVariant = variantEntries.some(([goal, variant]) => {
      const slots = new Set(
        variant.boonPriorities.map((priority) => priority.slot),
      );
      const variantRankedBoonIds = new Set(
        variant.boonRankings.map((entry) => entry.reference.id),
      );
      const variantRewardKinds = new Set(
        variant.rewardPriorities.map((entry) => entry.reward),
      );
      const variantRewardRuleKinds = new Set<string>(
        variant.rewardDecisionRules.map((entry) => entry.choose),
      );
      const variantKeepsakeStages = new Set(
        variant.keepsakeRoute.map((entry) => entry.stage),
      );
      const variantExpectedGrasp = variant.arcanaLoadout.reduce(
        (sum, entry) =>
          sum +
          (combined.domains.arcana.cards.find(
            (card) => card.id === entry.reference.id,
          )?.graspCost ?? 0),
        0,
      );
      return (
        variant.goal !== goal ||
        invalidJudgment(
          { ...variant, id: record.id, context: record.context },
          editorial.source,
        ) ||
        !nonempty(variant.overallReason) ||
        !nonempty(variant.overallLimitation) ||
        variant.strengths.length === 0 ||
        variant.weaknesses.length === 0 ||
        variant.playstyleCombatSequence.length === 0 ||
        variant.powerBreakpoints.length < 2 ||
        variant.powerBreakpoints.some(invalidPowerBreakpoint) ||
        variant.arcanaLoadout.length === 0 ||
        variant.arcanaLoadout.some(invalidRatedReference) ||
        variant.arcanaGraspCost !== variantExpectedGrasp ||
        !nonempty(variant.arcanaConstraint) ||
        variant.keepsakeRoute.length !== 3 ||
        variantKeepsakeStages.size !== 3 ||
        variant.keepsakeRoute.some(
          (entry) =>
            !nonempty(entry.reason) ||
            !nonempty(entry.switchCondition) ||
            (entry.lifecycle !== "persistent" &&
              !entry.switchCondition.includes("next keepsake cabinet")),
        ) ||
        variant.familiarHex.length !== 2 ||
        variant.familiarHex.some(invalidRatedReference) ||
        variant.boonPriorities.length !== boonSlots.length ||
        slots.size !== boonSlots.length ||
        [...requiredBoonSlots].some((slot) => !slots.has(slot)) ||
        variant.boonPriorities.some(
          (priority) =>
            !requiredBoonSlots.has(priority.slot) ||
            priority.preferred.length === 0 ||
            priority.fallback.length === 0 ||
            [...priority.preferred, ...priority.fallback].some(
              invalidRatedReference,
            ),
        ) ||
        variant.boonRankings.length !== boonIds.size ||
        variantRankedBoonIds.size !== boonIds.size ||
        [...variantRankedBoonIds].some((id) => !boonIds.has(id)) ||
        variant.boonRankings.some(invalidRatedReference) ||
        variant.duoLegendaryTargets.some(invalidBuildTarget) ||
        variant.hammerRankings.length === 0 ||
        variant.hammerRankings.some(invalidRatedReference) ||
        variant.buildInteractions.some(
          (entry) =>
            entry.references.length === 0 ||
            !nonempty(entry.reason) ||
            !nonempty(entry.condition),
        ) ||
        variant.rewardPriorities.length !== 6 ||
        variantRewardKinds.size !== 6 ||
        variant.rewardPriorities.some(
          (entry, index) =>
            entry.order !== index + 1 || !nonempty(entry.reason),
        ) ||
        [...requiredRewardRuleKinds].some(
          (kind) => !variantRewardRuleKinds.has(kind),
        ) ||
        variant.rewardDecisionRules.some(
          (entry) =>
            !nonempty(entry.condition) ||
            !nonempty(entry.reason) ||
            entry.over.length === 0,
        ) ||
        variant.conflicts.length === 0 ||
        variant.bossRouteConsiderations.length < 2 ||
        variant.upgradeConflicts.some(
          (entry) => entry.references.length === 0 || !nonempty(entry.reason),
        ) ||
        variant.contextRatings.length !== 4 ||
        variant.contextRatings.some(
          (entry) => !nonempty(entry.reason) || !nonempty(entry.limitation),
        )
      );
    });
    if (
      invalidJudgment(record, editorial.source) ||
      variantEntries.length !== 2 ||
      !record.buildVariants.strongest ||
      !record.buildVariants.safest ||
      invalidVariant ||
      record.context.aspectId !== record.id ||
      !nonempty(record.overallReason) ||
      record.rankEvaluations.length !== 2 ||
      record.rankEvaluations.some(
        (entry) => !nonempty(entry.reason) || !nonempty(entry.limitation),
      ) ||
      record.strengths.length === 0 ||
      record.weaknesses.length === 0 ||
      record.beginnerDifficulty < 1 ||
      record.beginnerDifficulty > 5 ||
      record.playstyleCombatSequence.length === 0 ||
      record.powerBreakpoints.length < 2 ||
      record.powerBreakpoints.some(invalidPowerBreakpoint) ||
      record.arcanaLoadout.length === 0 ||
      record.arcanaLoadout.some(invalidRatedReference) ||
      record.arcanaGraspCost !== expectedGrasp ||
      !nonempty(record.arcanaConstraint) ||
      record.keepsakeRoute.length !== 3 ||
      keepsakeStages.size !== 3 ||
      record.keepsakeRoute.some(
        (entry) =>
          !nonempty(entry.reason) ||
          !nonempty(entry.switchCondition) ||
          (entry.lifecycle !== "persistent" &&
            !entry.switchCondition.includes("next keepsake cabinet")),
      ) ||
      record.familiarHex.length === 0 ||
      record.familiarHex.some(invalidRatedReference) ||
      record.boonPriorities.length !== boonSlots.length ||
      boonPrioritySlots.size !== boonSlots.length ||
      [...requiredBoonSlots].some((slot) => !boonPrioritySlots.has(slot)) ||
      record.boonPriorities.some(
        (priority) =>
          !requiredBoonSlots.has(priority.slot) ||
          priority.preferred.length === 0,
      ) ||
      record.boonPriorities.some((priority) =>
        [...priority.preferred, ...priority.fallback].some(
          invalidRatedReference,
        ),
      ) ||
      record.boonRankings.length !== boonIds.size ||
      rankedBoonIds.size !== boonIds.size ||
      [...rankedBoonIds].some((id) => !boonIds.has(id)) ||
      record.boonRankings.some(invalidRatedReference) ||
      record.duoLegendaryTargets.some(invalidBuildTarget) ||
      record.hammerRankings.length === 0 ||
      record.hammerRankings.some(invalidRatedReference) ||
      (preferredHammerIds.size > 0 &&
        record.hammerRankings.length !== preferredHammerIds.size) ||
      [...preferredHammerIds].some(
        (id) =>
          !record.hammerRankings.some((entry) => entry.reference.id === id),
      ) ||
      record.buildInteractions.some(
        (entry) =>
          entry.references.length === 0 ||
          !nonempty(entry.reason) ||
          !nonempty(entry.condition),
      ) ||
      record.rewardPriorities.length !== 6 ||
      rewardKinds.size !== 6 ||
      record.rewardPriorities.some(
        (entry, index) => entry.order !== index + 1 || !nonempty(entry.reason),
      ) ||
      [...requiredRewardRuleKinds].some((kind) => !rewardRuleKinds.has(kind)) ||
      record.rewardDecisionRules.some(
        (entry) =>
          !nonempty(entry.condition) ||
          !nonempty(entry.reason) ||
          entry.over.length === 0,
      ) ||
      record.conflicts.length === 0 ||
      record.bossRouteConsiderations.length < 2 ||
      [...excludedHammerIds].some((id) => !conflictHammerIds.has(id)) ||
      record.upgradeConflicts.some(
        (entry) => entry.references.length === 0 || !nonempty(entry.reason),
      ) ||
      record.contextRatings.length !== 4 ||
      record.contextRatings.some(
        (entry) => !nonempty(entry.reason) || !nonempty(entry.limitation),
      )
    ) {
      invalid.push(`${record.recordType}:${record.id}`);
    }
  }
  for (const record of editorial.boonRatings) {
    if (
      invalidJudgment(record, editorial.source) ||
      record.evaluationDimension !== "general-value"
    ) {
      invalid.push(`${record.recordType}:${record.id}`);
    }
  }
  for (const record of [
    ...editorial.arcanaRatings,
    ...editorial.familiarRatings,
    ...editorial.hexRatings,
  ]) {
    if (
      invalidJudgment(record, editorial.source) ||
      record.evaluationDimension !== "new-player-value" ||
      record.aspectCount <= 0 ||
      record.recommendedByAspectCount < 0 ||
      record.recommendedByAspectCount > record.aspectCount
    ) {
      invalid.push(`${record.recordType}:${record.id}`);
    }
  }
  for (const record of editorial.arcanaRatings) {
    if (
      !arcanaProfileIds.has(record.id) ||
      record.reason.startsWith("Selected by ")
    )
      invalid.push(`${record.recordType}:${record.id}`);
  }
  for (const record of editorial.keepsakePriorities) {
    if (
      invalidJudgment(record, editorial.source) ||
      !nonempty(record.switchWhenInactive)
    )
      invalid.push(`${record.recordType}:${record.id}`);
  }
  for (const record of editorial.resourceAdvice) {
    if (
      invalidJudgment(record, editorial.source) ||
      ((record.recommendedUseReferences.length > 0 ||
        explicitlyPrioritizedResourceIds.has(record.id)) &&
        record.earliestRecommendedStage === "unprioritized")
    ) {
      invalid.push(`${record.recordType}:${record.id}`);
    }
  }
  for (const record of editorial.searchAliases) {
    const lowered = record.aliases.map((alias) =>
      alias.trim().toLocaleLowerCase("en-US"),
    );
    if (
      lowered.length === 0 ||
      lowered.some((alias) => alias.length === 0) ||
      new Set(lowered).size !== lowered.length
    ) {
      invalid.push(`${record.recordType}:${record.id}`);
    }
  }
  for (const definition of editorial.pageDefinitions) {
    const aliases = definition.aliases.map((alias) =>
      alias.trim().toLocaleLowerCase("en-US"),
    );
    if (
      !nonempty(definition.id) ||
      !nonempty(definition.title) ||
      definition.sourceRecordTypes.length === 0 ||
      aliases.length === 0 ||
      aliases.some((alias) => alias.length === 0) ||
      new Set(aliases).size !== aliases.length
    ) {
      invalid.push(`page-definition:${definition.id}`);
    }
  }
  const arcanaPage = editorial.pageDefinitions.find(
    (definition) => definition.id === "reference/arcana",
  );
  if (
    arcanaPage === undefined ||
    !arcanaPage.aliases
      .map((alias) => alias.toLocaleLowerCase("en-US"))
      .includes("tarot cards")
  ) {
    invalid.push("page-definition:reference/arcana");
  }
  const aliasOwners = new Map<string, string>();
  for (const record of editorial.searchAliases) {
    for (const alias of record.aliases) {
      const normalized = alias.trim().toLocaleLowerCase("en-US");
      const owner = `${record.recordType}:${record.id}`;
      const existing = aliasOwners.get(normalized);
      if (existing !== undefined && existing !== owner)
        invalid.push(existing, owner);
      aliasOwners.set(normalized, owner);
    }
  }
  for (const definition of editorial.pageDefinitions) {
    for (const alias of definition.aliases) {
      const normalized = alias.trim().toLocaleLowerCase("en-US");
      const owner = `page-definition:${definition.id}`;
      const existing = aliasOwners.get(normalized);
      if (existing !== undefined && existing !== owner)
        invalid.push(existing, owner);
      aliasOwners.set(normalized, owner);
    }
  }
  return [...new Set(invalid)].sort(compareStrings);
}

export function createContentReport(
  editorial: EditorialDataset,
  combined: CombinedDataset,
  requiredStages: readonly ProgressionStageSource[] = progressionStages,
): ContentReport {
  const factual = new Set(
    catalog(combined).map((record) => `${record.recordType}:${record.id}`),
  );
  const missingReferences = [
    ...new Set(
      allReferences(editorial)
        .filter((item) => !factual.has(key(item)))
        .map(key),
    ),
  ].sort(compareStrings);
  const aliasSubjects = new Set(
    editorial.searchAliases.map((record) => key(record.subjectReference)),
  );
  const requiredAliases = [
    ...combined.domains.weapons.aspects.map(
      (record) => `mechanics/weapon-aspect:${record.id}`,
    ),
    ...combined.domains.loadouts.keepsakes.map(
      (record) => `mechanics/keepsake:${record.id}`,
    ),
    ...combined.domains.boons.boons
      .filter(
        (record) =>
          coreBoonAliasSlot(record.id) !== null && record.godIds.length === 1,
      )
      .map((record) => `mechanics/boon:${record.id}`),
  ];
  const missingAliases = requiredAliases
    .filter((item) => !aliasSubjects.has(item))
    .sort(compareStrings);
  const weaponIds = new Set(
    combined.domains.weapons.weapons.map((record) => record.id),
  );
  const aspectIds = new Set(
    combined.domains.weapons.aspects.map((record) => record.id),
  );
  const boonIds = new Set(
    combined.domains.boons.boons.map((record) => record.id),
  );
  const arcanaIds = new Set(
    combined.domains.arcana.cards.map((record) => record.id),
  );
  const keepsakeIds = new Set(
    combined.domains.loadouts.keepsakes.map((record) => record.id),
  );
  const familiarIds = new Set(
    combined.domains.loadouts.familiars.map((record) => record.id),
  );
  const hexIds = new Set(
    combined.domains.loadouts.hexes.map((record) => record.id),
  );
  const resourceIds = new Set(
    combined.domains.guide.resources.map((record) => record.id),
  );
  const orphanRecordIds = [
    ...editorial.weaponGuides
      .filter((record) => !weaponIds.has(record.id))
      .map((record) => `editorial/weapon-guide:${record.id}`),
    ...editorial.aspectGuides
      .filter((record) => !aspectIds.has(record.id))
      .map((record) => `editorial/aspect-guide:${record.id}`),
    ...editorial.boonRatings
      .filter((record) => !boonIds.has(record.subjectReference.id))
      .map((record) => `editorial/boon-rating:${record.id}`),
    ...editorial.arcanaRatings
      .filter((record) => !arcanaIds.has(record.id))
      .map((record) => `editorial/arcana-rating:${record.id}`),
    ...editorial.familiarRatings
      .filter((record) => !familiarIds.has(record.id))
      .map((record) => `editorial/familiar-rating:${record.id}`),
    ...editorial.hexRatings
      .filter((record) => !hexIds.has(record.id))
      .map((record) => `editorial/hex-rating:${record.id}`),
    ...editorial.keepsakePriorities
      .filter((record) => !keepsakeIds.has(record.id))
      .map((record) => `mechanics/keepsake:${record.id}`),
    ...editorial.resourceAdvice
      .filter((record) => !resourceIds.has(record.id))
      .map((record) => `mechanics/resource:${record.id}`),
  ].sort(compareStrings);
  const covered = new Set([
    ...editorial.pageDefinitions.map(
      (record) => `page-definition:${record.id}`,
    ),
    ...editorial.progressionStages.map(
      (record) => `editorial/progression-stage:${record.id}`,
    ),
    ...editorial.weaponGuides.map(
      (record) => `editorial/weapon-guide:${record.id}`,
    ),
    ...editorial.aspectGuides.map(
      (record) => `editorial/aspect-guide:${record.id}`,
    ),
    ...editorial.boonRatings.map(
      (record) => `editorial/boon-rating:${record.subjectReference.id}`,
    ),
    ...editorial.arcanaRatings.map(
      (record) => `editorial/arcana-rating:${record.id}`,
    ),
    ...editorial.familiarRatings.map(
      (record) => `editorial/familiar-rating:${record.id}`,
    ),
    ...editorial.hexRatings.map(
      (record) => `editorial/hex-rating:${record.id}`,
    ),
    ...editorial.keepsakePriorities.map(
      (record) => `mechanics/keepsake:${record.id}`,
    ),
    ...editorial.resourceAdvice.map(
      (record) => `mechanics/resource:${record.id}`,
    ),
  ]);
  const requiredPages = [
    ...pageDefinitions.map((record) => `page-definition:${record.id}`),
    ...requiredStages.map(
      (record) => `editorial/progression-stage:${record.id}`,
    ),
    ...combined.domains.weapons.weapons.map(
      (record) => `editorial/weapon-guide:${record.id}`,
    ),
    ...combined.domains.weapons.aspects.map(
      (record) => `editorial/aspect-guide:${record.id}`,
    ),
    ...combined.domains.boons.boons.map(
      (record) => `editorial/boon-rating:${record.id}`,
    ),
    ...combined.domains.arcana.cards.map(
      (record) => `editorial/arcana-rating:${record.id}`,
    ),
    ...combined.domains.loadouts.familiars.map(
      (record) => `editorial/familiar-rating:${record.id}`,
    ),
    ...combined.domains.loadouts.hexes.map(
      (record) => `editorial/hex-rating:${record.id}`,
    ),
    ...combined.domains.loadouts.keepsakes.map(
      (record) => `mechanics/keepsake:${record.id}`,
    ),
    ...combined.domains.guide.resources.map(
      (record) => `mechanics/resource:${record.id}`,
    ),
  ];
  const requiredPagesWithoutEditorialCoverage = requiredPages
    .filter((item) => !covered.has(item))
    .sort(compareStrings);
  const recordIds = [
    ...editorial.pageDefinitions.map(
      (record) => `page-definition:${record.id}`,
    ),
    ...editorial.progressionStages.map(
      (record) => `${record.recordType}:${record.id}`,
    ),
    ...editorial.weaponGuides.map(
      (record) => `${record.recordType}:${record.id}`,
    ),
    ...editorial.aspectGuides.map(
      (record) => `${record.recordType}:${record.id}`,
    ),
    ...editorial.boonRatings.map(
      (record) => `${record.recordType}:${record.id}`,
    ),
    ...editorial.arcanaRatings.map(
      (record) => `${record.recordType}:${record.id}`,
    ),
    ...editorial.familiarRatings.map(
      (record) => `${record.recordType}:${record.id}`,
    ),
    ...editorial.hexRatings.map(
      (record) => `${record.recordType}:${record.id}`,
    ),
    ...editorial.keepsakePriorities.map(
      (record) => `${record.recordType}:${record.id}`,
    ),
    ...editorial.resourceAdvice.map(
      (record) => `${record.recordType}:${record.id}`,
    ),
    ...editorial.searchAliases.map(
      (record) => `${record.recordType}:${record.id}`,
    ),
  ];
  const seen = new Set<string>();
  const duplicateRecordIds = [
    ...new Set(recordIds.filter((id) => seen.has(id) || !seen.add(id))),
  ].sort(compareStrings);
  const invalidEditorialRecords = invalidRecords(editorial, combined);
  const counts = {
    progressionStages: editorial.progressionStages.length,
    pageDefinitions: editorial.pageDefinitions.length,
    weaponGuides: editorial.weaponGuides.length,
    aspectGuides: editorial.aspectGuides.length,
    boonRatings: editorial.boonRatings.length,
    arcanaRatings: editorial.arcanaRatings.length,
    familiarRatings: editorial.familiarRatings.length,
    hexRatings: editorial.hexRatings.length,
    keepsakePriorities: editorial.keepsakePriorities.length,
    resourceAdvice: editorial.resourceAdvice.length,
    searchAliases: editorial.searchAliases.length,
  };
  const complete =
    [
      missingReferences,
      missingAliases,
      orphanRecordIds,
      requiredPagesWithoutEditorialCoverage,
      duplicateRecordIds,
      invalidEditorialRecords,
    ].every((issues) => issues.length === 0) &&
    counts.progressionStages === requiredStages.length &&
    counts.pageDefinitions === pageDefinitions.length &&
    counts.weaponGuides === weaponIds.size &&
    counts.aspectGuides === aspectIds.size &&
    counts.boonRatings === boonIds.size &&
    counts.arcanaRatings === arcanaIds.size &&
    counts.familiarRatings === familiarIds.size &&
    counts.hexRatings === hexIds.size &&
    counts.keepsakePriorities === keepsakeIds.size &&
    counts.resourceAdvice === resourceIds.size;
  return {
    schema: "neodes2-content-report-1",
    sourceDatasetAcquisitionId: editorial.source.datasetAcquisitionId,
    counts,
    missingReferences,
    missingAliases,
    orphanRecordIds,
    requiredPagesWithoutEditorialCoverage,
    duplicateRecordIds,
    invalidEditorialRecords,
    complete,
  };
}

export function compileEditorialDataset(
  combined: CombinedDataset,
  identity: EditorialSourceIdentity,
  profiles: readonly AspectProfile[] = aspectProfiles,
  stages: readonly ProgressionStageSource[] = progressionStages,
): { readonly dataset: EditorialDataset; readonly report: ContentReport } {
  const compiledAspectGuides = aspectRecords(combined, identity, profiles);
  const arcanaCounts = selectedAspectCounts(profiles, "arcanaIds");
  const familiarCounts = selectedAspectCounts(profiles, "familiarId");
  const hexCounts = selectedAspectCounts(profiles, "hexId");
  const dataset: EditorialDataset = {
    schema: "neodes2-editorial-1",
    source: {
      ...identity,
      steamBuildId: combined.source.steamBuildId,
      executableVersion: combined.source.executableVersion,
      packageVersion: combined.source.packageVersion,
    },
    progressionStages: progressionRecords(combined, identity, stages),
    pageDefinitions,
    weaponGuides: weaponRecords(combined, identity, compiledAspectGuides),
    aspectGuides: compiledAspectGuides,
    boonRatings: boonRecords(combined, identity, profiles),
    arcanaRatings: tierRecords(
      combined,
      identity,
      "editorial/arcana-rating",
      "mechanics/arcana-card",
      combined.domains.arcana.cards,
      arcanaCounts,
      profiles.length,
      arcanaProfiles,
    ),
    familiarRatings: tierRecords(
      combined,
      identity,
      "editorial/familiar-rating",
      "mechanics/familiar",
      combined.domains.loadouts.familiars,
      familiarCounts,
      profiles.length,
      familiarProfiles,
    ),
    hexRatings: tierRecords(
      combined,
      identity,
      "editorial/hex-rating",
      "mechanics/hex",
      combined.domains.loadouts.hexes,
      hexCounts,
      profiles.length,
      hexProfiles,
    ),
    keepsakePriorities: keepsakeRecords(combined, identity),
    resourceAdvice: resourceRecords(combined, identity, stages),
    searchAliases: aliasRecords(combined),
  };
  return { dataset, report: createContentReport(dataset, combined, stages) };
}
