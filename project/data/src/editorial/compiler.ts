import type { JsonValue } from "../boons/index.js";
import type { CombinedDataset } from "../dataset/index.js";
import { arcanaProfiles, aspectProfiles, familiarProfiles, hexProfiles, pageDefinitions, preferredHammersByAspect, progressionStages } from "./content.js";
import type {
  AspectGuideRecord,
  AspectProfile,
  BuildInteraction,
  BoonRatingRecord,
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

function context(dataset: CombinedDataset, progressionStage: string, aspectId?: string): EditorialContext {
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
    ...arcana.cards.map((record) => ({ recordType: "mechanics/arcana-card", id: record.id, name: record.name })),
    ...boons.gods.map((record) => ({ recordType: "mechanics/god", id: record.id, name: record.name })),
    ...boons.boons.map((record) => ({ recordType: "mechanics/boon", id: record.id, name: record.name })),
    ...weapons.weapons.map((record) => ({ recordType: "mechanics/weapon", id: record.id, name: record.name })),
    ...weapons.aspects.map((record) => ({ recordType: "mechanics/weapon-aspect", id: record.id, name: record.name })),
    ...weapons.hammers.map((record) => ({ recordType: "mechanics/hammer-upgrade", id: record.id, name: record.name })),
    ...loadouts.keepsakes.map((record) => ({ recordType: "mechanics/keepsake", id: record.id, name: record.displayName })),
    ...loadouts.familiars.map((record) => ({ recordType: "mechanics/familiar", id: record.id, name: record.displayName })),
    ...loadouts.hexes.map((record) => ({ recordType: "mechanics/hex", id: record.id, name: record.displayName })),
    ...loadouts.incantations.map((record) => ({ recordType: "mechanics/incantation", id: record.id, name: record.displayName })),
    ...guide.resources.map((record) => ({ recordType: "mechanics/resource", id: record.id, name: record.displayName ?? "" })),
    ...guide.statusElements.map((record) => ({ recordType: "mechanics/status-element", id: record.id, name: record.displayName ?? "" })),
    ...guide.regions.map((record) => ({ recordType: "world-progression/region", id: record.id, name: record.displayName ?? "" })),
    ...guide.encounters.map((record) => ({ recordType: "world-progression/encounter", id: record.id, name: record.displayName ?? "" })),
    ...guide.enemies.map((record) => ({ recordType: "world-progression/enemy", id: record.id, name: record.displayName ?? "" })),
    ...guide.oathConditions.map((record) => ({ recordType: "world-progression/oath-condition", id: record.id, name: record.displayName ?? "" })),
    ...guide.bounties.map((record) => ({ recordType: "world-progression/testament-bounty", id: record.id, name: record.displayName ?? "" })),
    ...guide.relationships.map((record) => ({ recordType: "world-progression/relationship", id: record.id, name: record.displayName ?? "" })),
    ...guide.prophecies.map((record) => ({ recordType: "world-progression/prophecy", id: record.id, name: record.displayName ?? "" })),
    ...guide.narrative.map((record) => ({ recordType: "world-progression/narrative-milestone", id: record.id, name: record.displayName ?? "" })),
    ...guide.achievements.map((record) => ({ recordType: "world-progression/achievement", id: record.id, name: record.displayName })),
  ].sort((left, right) => compareStrings(`${left.recordType}:${left.id}`, `${right.recordType}:${right.id}`));
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
    limitation: "Random offers and story sequencing can change the number of nights needed, so milestone evidence takes priority over run counts.",
    prerequisiteReferences: index === 0 ? [] : (stages[index - 1]?.completionReferences ?? []),
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

function ratingFromProfile(profile: AspectProfile, rank: "rank-one" | "maximum"): EditorialRating {
  if (rank === "maximum") return profile.contextRatings.consistency === "C" ? "A" : profile.contextRatings.consistency;
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

function coreBoonAliasSlot(id: string): CombatFocus | null {
  const match = /^(?:Aphrodite|Apollo|Ares|Demeter|Hephaestus|Hera|Hestia|Poseidon|Zeus)(Weapon|Special|Cast|Sprint|Mana)Boon$/u.exec(id);
  if (match === null) return null;
  return ({ Weapon: "attack", Special: "special", Cast: "cast", Sprint: "sprint", Mana: "omega" } as const)[match[1] as "Weapon" | "Special" | "Cast" | "Sprint" | "Mana"];
}

function ratingScore(rating: EditorialRating): number {
  return ({ S: 5, A: 4, B: 3, C: 2, D: 1 } as const)[rating];
}

function overallRating(ratings: Readonly<Record<"consistency" | "speed" | "safety" | "high-fear", EditorialRating>>): EditorialRating {
  return scoreRating(Object.values(ratings).reduce((sum, rating) => sum + ratingScore(rating), 0) / 4);
}

function contextReason(profile: AspectProfile, ratingContext: "consistency" | "speed" | "safety" | "high-fear"): string {
  if (ratingContext === "consistency") return `${profile.strengths[0]} The main limit is that ${profile.weaknesses[0]?.toLowerCase() ?? "execution can still fail"}.`;
  if (ratingContext === "speed") return `${profile.strengths[1] ?? profile.strengths[0]} Clear speed falls when ${profile.weaknesses[0]?.toLowerCase() ?? "the main sequence misses"}.`;
  if (ratingContext === "safety") return `${profile.bossConsideration} This rating assumes the listed sequence is not extended through an unsafe opening.`;
  return `${profile.routeConsideration} Higher Fear magnifies ${profile.weaknesses[0]?.toLowerCase() ?? "the aspect's execution requirement"}.`;
}

function contextLimitation(profile: AspectProfile, ratingContext: "consistency" | "speed" | "safety" | "high-fear"): string {
  if (ratingContext === "speed") return profile.weaknesses[1] ?? profile.weaknesses[0] ?? "A missed setup lowers clear speed.";
  if (ratingContext === "safety") return profile.weaknesses[0] ?? "Unsafe timing can still lose the defensive advantage.";
  if (ratingContext === "high-fear") return profile.weaknesses.join(" ");
  return profile.weaknesses[0] ?? "The rating assumes the documented combat sequence is executed reliably.";
}

function hammerRating(description: string, focuses: readonly CombatFocus[]): EditorialRating {
  const text = description.toLowerCase();
  const matches = focuses.filter((focus) => {
    if (focus === "omega") return text.includes("omega") || text.includes("hold") || text.includes("charge");
    if (focus === "hex") return false;
    return text.includes(focus);
  }).length;
  return matches >= 2 ? "S" : matches === 1 ? "A" : "B";
}

function hammerImpact(id: string): string {
  if (/Ammo|Magnetism/.test(id)) return "It improves Shell availability or retrieval, which shortens the time between loaded Attack sequences.";
  if (/RaiseDead|Shade/.test(id)) return "It strengthens the aspect's summoned Shade instead of diverting upgrades into an unrelated move.";
  if (/Rally|Frenzy/.test(id)) return "It extends or strengthens the aspect's Frenzy and recovery window.";
  if (/Combo|BlockBuff/.test(id)) return "It converts the aspect's block or combo setup into a stronger follow-up window.";
  if (/Gun|Overheat/.test(id)) return "It directly improves the aspect's gun form and its Overheat sequence.";
  if (/Charge|Speed|Fast|Rapid|Recovery|Discount|StartUp/.test(id)) return "It shortens or reduces the cost of the move that starts the aspect's damage sequence.";
  if (/Duration|Longevity|Enhanced|Linger/.test(id)) return "It keeps the aspect's projectile or damage field active longer, increasing overlap with later actions.";
  if (/Sturdy|Armor|Block/.test(id)) return "It protects an exposed action or improves the weapon's answer to Armor.";
  if (/Range|Size|AoE|Jump|Bounce|Fan|Spread|Split|Triple|Double|Count|Orbit|Line/.test(id)) return "It increases coverage or repeated hits, so the main move reaches more of the controlled target area.";
  return "It adds direct damage to a move already used in the aspect's repeatable sequence.";
}

function rankedHammers(dataset: CombinedDataset, profile: AspectProfile): readonly RatedReference[] {
  const aspect = dataset.domains.weapons.aspects.find((candidate) => candidate.id === profile.aspectId);
  if (aspect === undefined) return [];
  const preferred: readonly string[] = preferredHammersByAspect[profile.aspectId as keyof typeof preferredHammersByAspect] ?? [];
  return dataset.domains.weapons.hammers
    .filter((hammer) => hammer.weaponId === aspect.weaponId &&
      (hammer.compatibility.allowedAspectIds.length === 0 || hammer.compatibility.allowedAspectIds.includes(profile.aspectId)) &&
      !hammer.compatibility.excludedAspectIds.includes(profile.aspectId) &&
      (hammer.compatibility.requiredAspectIds.length === 0 || hammer.compatibility.requiredAspectIds.includes(profile.aspectId)))
    .map((hammer) => {
      const preferredIndex = preferred.indexOf(hammer.id);
      const rating: EditorialRating = preferredIndex >= 0 ? "S" : hammerRating(hammer.description, profile.focuses) === "A" ? "A" : "B";
      const matched = profile.focuses.filter((focus) => hammerRating(hammer.description, [focus]) === "A");
      return {
        reference: reference("mechanics/hammer-upgrade", hammer.id),
        rating,
        reason: preferredIndex >= 0
          ? `${hammer.name} is authored priority ${preferredIndex + 1}. ${hammerImpact(hammer.id)} It supports this step: ${profile.combatSequence[Math.min(preferredIndex, profile.combatSequence.length - 1)]}`
          : matched.length > 0
          ? `Directly supports the guide's ${matched.join(" and ")} plan.`
          : "Compatible utility, but it does not directly strengthen the aspect's main loop.",
        limitation: preferredIndex >= 0
          ? "The Hammer improves the build only after its core Boon and resource loop function."
          : "Taking this Hammer can forgo a stronger authored top choice later in the run.",
        prerequisiteReferences: [reference("mechanics/weapon-aspect", profile.aspectId)],
      };
    })
    .sort((left, right) => ratingScore(right.rating) - ratingScore(left.rating) || compareStrings(left.reference.id, right.reference.id));
}

function arcanaRecommendation(dataset: CombinedDataset, profile: AspectProfile, id: string) {
  const core = id === "BonusHealth" || id === "LastStand" ||
    (id === "CastBuff" || id === "CastCount") && profile.focuses.includes("cast") ||
    (id === "ChanneledCast" || id === "ManaOverTime") && profile.focuses.includes("omega") ||
    id === "SprintShield" && profile.focuses.includes("sprint") ||
    id === "ChanneledBlock" || id === "SorceryRegenUpgrade" && profile.focuses.includes("hex");
  const reasons: Readonly<Record<string, string>> = {
    BonusHealth: "Persistence adds a reliable Life buffer without changing the aspect's combat sequence.",
    LastStand: "Death protects route progress while the aspect's positioning and boss windows are still being learned.",
    ChanneledCast: "The Sorceress shortens enemy movement during Omega channels and reduces the risk of the aspect's charged actions.",
    ManaOverTime: "The Unseen restores the Magick needed to repeat the aspect's Omega sequence.",
    CastBuff: "The Furies adds damage to the Cast that already controls the aspect's target area.",
    CastCount: "Eternity supports repeated Cast placement when the aspect relies on keeping targets inside a controlled area.",
    ChanneledBlock: "The Lovers reduces damage during the charged or blocking window used by this aspect.",
    SprintShield: "The Swift Runner protects the repositioning step between the aspect's attack sequences.",
    SorceryRegenUpgrade: "The Moon improves Hex availability for an aspect whose loop explicitly includes Hex use.",
  };
  const card = dataset.domains.arcana.cards.find((candidate) => candidate.id === id);
  return {
    reference: reference("mechanics/arcana-card", id),
    rating: core ? "S" as const : "A" as const,
    role: core ? "core" as const : "support" as const,
    reason: reasons[id] ?? `${card?.name ?? id} supports the authored aspect sequence.`,
    limitation: core
      ? "Its Grasp cost must fit alongside the other core cards before support cards are added."
      : "Remove this support card first when current Grasp cannot hold the full loadout.",
    prerequisiteReferences: [],
  };
}

function rewardPriorities(profile: AspectProfile) {
  const usesMagick = profile.focuses.includes("omega") || profile.focuses.includes("hex");
  const rewards = usesMagick
    ? ["core-boon", "magick-recovery", "hammer", "maximum-life", "pom", "duo-legendary"] as const
    : ["core-boon", "hammer", "maximum-life", "pom", "magick-recovery", "duo-legendary"] as const;
  const reasons = {
    "core-boon": `Fill the aspect's ${profile.focuses[0] ?? "main"} damage slot before spending rewards on optional scaling.`,
    "magick-recovery": usesMagick ? "Secure recovery before repeated Omega or Hex use makes the combat loop stall." : "Take recovery only after the normal-move plan and immediate survival needs are covered.",
    hammer: "Take a compatible top-ranked Hammer after the first core Boon. No Hammer is required to make the authored build function.",
    "maximum-life": "Move maximum Life ahead of damage rewards when the current route cannot survive the next guardian reliably.",
    pom: "Use Poms after the core Boon exists so levels land on an effect the build repeatedly uses.",
    "duo-legendary": "Pursue a Duo or Legendary only after the build already contains a valid choice from every prerequisite set.",
  } as const;
  return rewards.map((reward, index) => ({ order: index + 1, reward, reason: reasons[reward] }));
}

function rewardDecisionRules(profile: AspectProfile) {
  const usesMagick = profile.focuses.includes("omega") || profile.focuses.includes("hex");
  return [
    {
      condition: "The aspect's primary Attack, Special, Cast, Sprint, or Omega slot is still empty.",
      choose: "core-boon" as const,
      over: ["hammer", "pom", "duo-legendary"] as const,
      reason: "A functional core move adds reliable damage now and unlocks later scaling choices.",
    },
    ...(usesMagick ? [{
      condition: "The combat sequence spends Magick repeatedly and no recovery source sustains one full room.",
      choose: "magick-recovery" as const,
      over: ["hammer", "pom", "duo-legendary"] as const,
      reason: "The aspect loses its documented loop when Magick runs out, so recovery comes before optional damage.",
    }] : []),
    {
      condition: "The core Boon is secured and an authored top-three compatible Hammer is offered.",
      choose: "hammer" as const,
      over: ["pom", "core-boon"] as const,
      reason: "A top Hammer changes the weapon itself and is harder to replace than another non-core Boon or one level.",
    },
    {
      condition: "Current Life or Death Defiance cannot reliably cover the next guardian.",
      choose: "maximum-life" as const,
      over: ["hammer", "pom", "duo-legendary"] as const,
      reason: "Surviving the route preserves all existing build value and progression rewards.",
    },
    {
      condition: "A named permanent unlock is the current progression target and the build already clears ordinary rooms safely.",
      choose: "permanent-resource" as const,
      over: ["pom", "duo-legendary"] as const,
      reason: "The permanent resource advances the A-to-Z route without sacrificing a required combat fix.",
    },
    {
      condition: "The core Boon exists, the build survives, and no top Hammer or missing resource loop is offered.",
      choose: "pom" as const,
      over: ["core-boon"] as const,
      reason: "A level on the repeatedly used core effect is more reliable than filling an unused move slot.",
    },
    {
      condition: "Every prerequisite set is satisfied and the offered Duo or Legendary directly supports the completed package.",
      choose: "duo-legendary" as const,
      over: ["pom", "core-boon"] as const,
      reason: "The rare target is worth taking only after the build already functions without it.",
    },
  ];
}

function prerequisiteIds(value: JsonValue | null, boonIds: ReadonlySet<string>, output = new Set<string>()): ReadonlySet<string> {
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

function prerequisiteSets(value: JsonValue | null): readonly (readonly string[])[] {
  if (value === null || Array.isArray(value) || typeof value !== "object") return [];
  const sets = (value as { readonly OneFromEachSet?: JsonValue }).OneFromEachSet;
  if (!Array.isArray(sets)) return [];
  return sets.filter((entry): entry is readonly string[] => Array.isArray(entry) && entry.every((id) => typeof id === "string"));
}

function boonPrerequisiteReferences(
  boon: CombinedDataset["domains"]["boons"]["boons"][number],
  boonIds: ReadonlySet<string>,
): readonly EditorialReference[] {
  return [...prerequisiteIds(boon.prerequisites, boonIds)]
    .sort(compareStrings)
    .map((id) => reference("mechanics/boon", id));
}

function compatibleTargets(dataset: CombinedDataset, profile: AspectProfile): readonly RatedReference[] {
  const planned = new Set([...profile.primaryBoonIds, ...profile.fallbackBoonIds]);
  return dataset.domains.boons.boons
    .filter((boon) => boon.kind === "duo" || boon.kind === "legendary")
    .map((boon) => ({ boon, sets: prerequisiteSets(boon.prerequisites) }))
    .filter(({ sets }) => sets.length > 0 && sets.every((set) => set.some((id) => planned.has(id))))
    .map(({ boon, sets }) => {
      const matches = sets.flatMap((set) => set.filter((id) => planned.has(id)));
      return {
        reference: reference("mechanics/boon", boon.id),
        rating: "A" as const,
        reason: `The aspect plan already includes a valid choice from each prerequisite set: ${matches.join(", ")}.`,
        limitation: "Do not chase this target before the core build works, because an unseeded run may not offer every required god or Boon.",
        prerequisiteReferences: [...new Set(sets.flat())].sort(compareStrings).map((id) => reference("mechanics/boon", id)),
      };
    })
    .sort((left, right) => compareStrings(left.reference.id, right.reference.id));
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

function plannedGodIds(dataset: CombinedDataset, ids: readonly string[]): ReadonlySet<string> {
  const planned = new Set(ids);
  return new Set(dataset.domains.boons.boons.filter((boon) => planned.has(boon.id)).flatMap((boon) => boon.godIds));
}

function slotSelections(
  dataset: CombinedDataset,
  slot: typeof boonSlots[number],
  ids: readonly string[],
  rating: "A" | "B",
  reason: string,
): readonly RatedReference[] {
  const boonIds = new Set(dataset.domains.boons.boons.map((boon) => boon.id));
  const explicit = new Set(ids.filter((id) => boonFocus(id) === slot));
  const gods = plannedGodIds(dataset, ids);
  const candidates = dataset.domains.boons.boons
    .filter((boon) => explicit.has(boon.id) || (coreBoonAliasSlot(boon.id) === slot && boon.godIds.some((id) => gods.has(id))))
    .sort((left, right) => Number(explicit.has(right.id)) - Number(explicit.has(left.id)) || compareStrings(left.id, right.id))
    .slice(0, 3);
  return candidates.map((boon) => ({
    reference: reference("mechanics/boon", boon.id),
    rating,
    reason: explicit.has(boon.id) ? reason : `Keeps the ${slot} slot inside the aspect's planned god pool without replacing its core move.`,
    limitation: explicit.has(boon.id)
      ? "Its value depends on using this slot in the documented combat sequence."
      : "This support-slot choice should not consume rerolls needed by the aspect's core move.",
    prerequisiteReferences: boonPrerequisiteReferences(boon, boonIds),
  }));
}

function aspectBoonRankings(
  dataset: CombinedDataset,
  profile: AspectProfile,
  targets: readonly RatedReference[],
): readonly RatedReference[] {
  const primary = new Set(profile.primaryBoonIds);
  const fallback = new Set(profile.fallbackBoonIds);
  const targetIds = new Set(targets.map((entry) => entry.reference.id));
  const boonIds = new Set(dataset.domains.boons.boons.map((boon) => boon.id));
  return dataset.domains.boons.boons.map((boon) => {
    const focus = boonFocus(boon.id);
    const prerequisiteReferences = boonPrerequisiteReferences(boon, boonIds);
    if (primary.has(boon.id)) return {
      reference: reference("mechanics/boon", boon.id), rating: "S" as const,
      reason: `${boon.name} is part of the authored primary package because it supports the ${focus ?? "support"} step in this sequence: ${profile.combatSequence.join(" Then ")}`,
      limitation: "Its value assumes the aspect repeatedly uses the move or resource loop this Boon supports.",
      prerequisiteReferences,
    };
    if (fallback.has(boon.id)) return {
      reference: reference("mechanics/boon", boon.id), rating: "A" as const,
      reason: `${boon.name} is the authored fallback for the ${focus ?? "support"} part of the build when the primary package does not appear.`,
      limitation: "It preserves the combat plan but provides less direct synergy than the primary package.",
      prerequisiteReferences,
    };
    if (targetIds.has(boon.id)) return {
      reference: reference("mechanics/boon", boon.id), rating: "A" as const,
      reason: "The authored package contains one valid boon from every prerequisite set for this Duo or Legendary target.",
      limitation: "It is a late target rather than a functional starting point, and the run may not offer every prerequisite.",
      prerequisiteReferences,
    };
    if (focus !== null && profile.focuses.includes(focus)) return {
      reference: reference("mechanics/boon", boon.id), rating: "B" as const,
      reason: `${boon.name} fills the ${focus} slot used by the aspect's main sequence, but it is not part of the preferred god package.`,
      limitation: "Choosing it can close the core slot before a stronger authored option appears.",
      prerequisiteReferences,
    };
    if (focus !== null) return {
      reference: reference("mechanics/boon", boon.id), rating: "D" as const,
      reason: `${boon.name} fills the ${focus} slot, which this aspect does not build around, so it diverts resources from the main sequence.`,
      limitation: "It consumes a core slot and future upgrades without strengthening the aspect's documented move.",
      prerequisiteReferences,
    };
    return {
      reference: reference("mechanics/boon", boon.id), rating: "C" as const,
      reason: `${boon.name} has no direct authored relationship to this aspect and should follow the completed core package.`,
      limitation: "Its situational value depends on the rest of the run and cannot replace the aspect's core package.",
      prerequisiteReferences,
    };
  }).sort((left, right) => ratingScore(right.rating) - ratingScore(left.rating) || compareStrings(left.reference.id, right.reference.id));
}

function excludedUpgradeConflicts(dataset: CombinedDataset, profile: AspectProfile) {
  const aspect = dataset.domains.weapons.aspects.find((candidate) => candidate.id === profile.aspectId);
  if (aspect === undefined) return [];
  const hammers = dataset.domains.weapons.hammers.filter((hammer) => hammer.weaponId === aspect.weaponId);
  const conflicts = hammers
    .filter((hammer) => hammer.compatibility.excludedAspectIds.includes(profile.aspectId))
    .map((hammer) => ({
      references: [reference("mechanics/hammer-upgrade", hammer.id)],
      reason: "The normalized Hammer compatibility record excludes this aspect.",
    }));
  const pairs = hammers.flatMap((hammer) => hammer.compatibility.incompatibleHammerIds
    .filter((id) => compareStrings(hammer.id, id) < 0)
    .map((id) => ({
      references: [reference("mechanics/hammer-upgrade", hammer.id), reference("mechanics/hammer-upgrade", id)],
      reason: "The normalized Hammer compatibility record marks this pair as mutually incompatible.",
    })));
  return [...conflicts, ...pairs];
}

function forceKeepsake(dataset: CombinedDataset, boonId: string): string | null {
  const boon = dataset.domains.boons.boons.find((candidate) => candidate.id === boonId);
  const godId = boon?.godIds[0];
  if (godId === undefined) return null;
  const candidate = `Force${godId.replace(/Upgrade$/, "")}BoonKeepsake`;
  return dataset.domains.loadouts.keepsakes.some((keepsake) => keepsake.id === candidate) ? candidate : null;
}

function keepsakeLifecycle(id: string): KeepsakeLifecycle {
  if (/TempHammer|TimedBuff/.test(id)) return "timed";
  if (/DecayingBoost/.test(id)) return "decaying";
  if (/ArmorGain|DoorHealReserve|ManaOverTimeRefund/.test(id)) return "depleting";
  if (/^Force.*BoonKeepsake$|Reincarnation|BonusMoney|AthenaEncounter|BossMetaUpgrade|BossPreDamage|FountainRarity|SpellTalent|Rarify/.test(id)) {
    return "limited-use";
  }
  return "persistent";
}

function keepsakeInactiveSwitch(id: string, lifecycle: KeepsakeLifecycle): string {
  if (/^Force.*BoonKeepsake$/.test(id)) return "At the next keepsake cabinet, replace it after its god offer is consumed or the required core Boon is secured.";
  if (id === "ReincarnationKeepsake") return "At the next keepsake cabinet, replace it after its Last Stand has triggered because the spent keepsake adds no second recovery.";
  if (id === "BonusMoneyKeepsake") return "At the next keepsake cabinet, replace it after the starting Gold has been granted.";
  if (id === "BossPreDamageKeepsake") return "At the next keepsake cabinet, replace it after its limited guardian effect has been consumed and another guardian remains.";
  if (/AthenaEncounter|BossMetaUpgrade|FountainRarity|SpellTalent|Rarify/.test(id)) return "At the next keepsake cabinet, replace it after all displayed uses have been consumed.";
  if (lifecycle === "timed") return "At the next keepsake cabinet, replace it after its timer or room duration expires.";
  if (lifecycle === "decaying") return "At the next keepsake cabinet, replace it after the remaining bonus falls below the value of the planned alternative.";
  if (lifecycle === "depleting") return "At the next keepsake cabinet, replace it after its Armor, healing, or Magick reserve is empty.";
  return "Keep it while its condition supports the current route, then replace it when another keepsake solves a more immediate constraint.";
}

function keepsakeLifecycleReason(lifecycle: KeepsakeLifecycle): string {
  if (lifecycle === "limited-use") return "Its value ends after the displayed use or trigger is consumed.";
  if (lifecycle === "timed") return "Its value lasts for a timer or fixed room duration.";
  if (lifecycle === "decaying") return "Its value falls as the run advances.";
  if (lifecycle === "depleting") return "Its value lasts until the granted reserve is empty.";
  return "Its effect remains available while the keepsake stays equipped and its condition is met.";
}

function buildInteractions(dataset: CombinedDataset, profile: AspectProfile) {
  const boonName = new Map(dataset.domains.boons.boons.map((boon) => [boon.id, boon.name]));
  const arcanaName = new Map(dataset.domains.arcana.cards.map((card) => [card.id, card.name]));
  const coreBoonNames = profile.primaryBoonIds.map((id) => boonName.get(id) ?? id);
  const coreArcanaNames = profile.arcanaIds.map((id) => arcanaName.get(id) ?? id);
  const interactions: BuildInteraction[] = [
    {
      kind: "synergy" as const,
      references: profile.primaryBoonIds.map((id) => reference("mechanics/boon", id)),
      reason: `${coreBoonNames.join(", ")} form the primary package across the ${profile.focuses.join(", ")} actions used by this aspect.`,
      condition: `Use the package while repeating this sequence: ${profile.combatSequence.join(" Then ")}`,
    },
    {
      kind: "synergy" as const,
      references: [
        ...profile.arcanaIds.map((id) => reference("mechanics/arcana-card", id)),
        ...profile.primaryBoonIds.map((id) => reference("mechanics/boon", id)),
      ],
      reason: `${coreArcanaNames.join(", ")} supply the survival, movement, and resource support needed by the primary Boon package.`,
      condition: "Keep core Arcana first when Grasp is limited, then add support cards only after the combat loop functions.",
    },
    {
      kind: "synergy" as const,
      references: [
        reference("mechanics/familiar", profile.familiarId),
        reference("mechanics/hex", profile.hexId),
        reference("mechanics/weapon-aspect", profile.aspectId),
      ],
      reason: `The selected Familiar and Hex cover a weakness without replacing the aspect's ${profile.focuses.join(" and ")} sequence.`,
      condition: "Use this pair unless survival, Magick, or a route-specific gathering target calls for the listed fallback.",
    },
  ];
  if (profile.arcanaIds.includes("StatusVulnerability")) {
    const curseCandidates = profile.primaryBoonIds.filter((id) => (dataset.domains.boons.boons.find((boon) => boon.id === id)?.godIds.length ?? 0) > 0);
    if (curseCandidates.length >= 2) {
      interactions.push({
        kind: "synergy",
        references: [reference("mechanics/arcana-card", "StatusVulnerability"), ...curseCandidates.map((id) => reference("mechanics/boon", id))],
        reason: "Origination converts the primary package's different Olympian effects into a direct damage multiplier after two curses remain on the same foe.",
        condition: "Keep one reliable curse from each of two Olympians active on the priority target before evaluating Origination as part of the damage plan.",
      });
    }
  }
  for (const slot of boonSlots) {
    const preferred = profile.primaryBoonIds.find((id) => boonFocus(id) === slot);
    const fallback = profile.fallbackBoonIds.find((id) => boonFocus(id) === slot);
    if (preferred === undefined || fallback === undefined || preferred === fallback) continue;
    interactions.push({
      kind: "conflict",
      references: [reference("mechanics/boon", preferred), reference("mechanics/boon", fallback)],
      reason: `${boonName.get(preferred) ?? preferred} and ${boonName.get(fallback) ?? fallback} both fill the ${slot} slot, so the fallback cannot stack with the preferred core choice.`,
      condition: "Choose the preferred option when both appear before the slot is filled. Choose the fallback only when the primary package is unavailable.",
    });
  }
  return interactions;
}

function aspectRecords(
  dataset: CombinedDataset,
  identity: EditorialSourceIdentity,
  profiles: readonly AspectProfile[],
): readonly AspectGuideRecord[] {
  return profiles.map((profile) => {
    const preferredKeepsake = forceKeepsake(dataset, profile.primaryBoonIds[0] ?? "");
    const openingKeepsake = preferredKeepsake ?? "ReincarnationKeepsake";
    const openingLifecycle = keepsakeLifecycle(openingKeepsake);
    const keepsakeRoute = [
      {
        stage: "opening" as const,
        reference: reference("mechanics/keepsake", openingKeepsake),
        reason: preferredKeepsake === null ? "Start with predictable survival when no god keepsake matches the first preferred Boon." : "Use the opening region to secure the first preferred god and core Boon.",
        switchCondition: keepsakeInactiveSwitch(openingKeepsake, openingLifecycle),
        lifecycle: openingLifecycle,
      },
      {
        stage: "later-region" as const,
        reference: reference("mechanics/keepsake", "ReincarnationKeepsake"),
        reason: "Use the extra Death Defiance after the core Boon is secured when ordinary rooms still threaten the run.",
        switchCondition: `${keepsakeInactiveSwitch("ReincarnationKeepsake", "limited-use")} Equip it after the opening god is secured if room damage is consuming Death Defiance or maximum Life.`,
        lifecycle: "limited-use" as const,
      },
      {
        stage: "final-region" as const,
        reference: reference("mechanics/keepsake", "BossPreDamageKeepsake"),
        reason: "Use the guardian-focused effect when the final encounter is the remaining route constraint.",
        switchCondition: `${keepsakeInactiveSwitch("BossPreDamageKeepsake", "limited-use")} Equip it before the final region only when the run already survives normal rooms reliably.`,
        lifecycle: "limited-use" as const,
      },
      {
        stage: "fallback" as const,
        reference: reference("mechanics/keepsake", "ReincarnationKeepsake"),
        reason: "Keep the survival option when the planned god does not appear or the route remains unstable.",
        switchCondition: `${keepsakeInactiveSwitch("ReincarnationKeepsake", "limited-use")} Use this fallback instead of forcing damage when the current Life and Death Defiance cannot cover the next region.`,
        lifecycle: "limited-use" as const,
      },
    ];
    const boonPriorities = boonSlots.map((slot) => ({
      slot,
      role: profile.focuses.includes(slot) ? "core" as const : "support" as const,
      preferred: slotSelections(dataset, slot, profile.primaryBoonIds, "A", `Supports the aspect's primary ${slot} sequence.`),
      fallback: slotSelections(dataset, slot, profile.fallbackBoonIds, "B", `Keeps the ${slot} slot functional when the preferred package does not appear.`),
    }));
    const targets = compatibleTargets(dataset, profile);
    const familiar = familiarProfiles.find((entry) => entry.id === profile.familiarId);
    const hex = hexProfiles.find((entry) => entry.id === profile.hexId);
    return {
      recordType: "editorial/aspect-guide",
      id: profile.aspectId,
      aspectReference: reference("mechanics/weapon-aspect", profile.aspectId),
      context: context(dataset, "main-story", profile.aspectId),
      recommendation: `Build around ${profile.focuses.join(", ")} and repeat the documented combat sequence before adding optional synergy.`,
      reason: profile.strengths[0] ?? "The profile keeps the aspect's primary mechanic central.",
      limitation: profile.weaknesses[0] ?? "The aspect still depends on safe execution.",
      prerequisiteReferences: [reference("mechanics/weapon-aspect", profile.aspectId)],
      fallback: "Keep the strongest compatible core-slot boon and use the listed fallback package instead of forcing a missing prerequisite.",
      verificationNotes: verificationNote(identity),
      rankEvaluations: [
        {
          rank: "rank-one",
          rating: ratingFromProfile(profile, "rank-one"),
          reason: profile.rankOneEvaluation,
          limitation: profile.weaknesses[0] ?? "Rank I still requires the documented combat sequence.",
        },
        {
          rank: "maximum",
          rating: ratingFromProfile(profile, "maximum"),
          reason: profile.maximumRankEvaluation,
          limitation: profile.weaknesses[1] ?? profile.weaknesses[0] ?? "Maximum rank does not remove the aspect's execution requirement.",
        },
      ],
      overallRating: overallRating(profile.contextRatings),
      overallReason: `The overall rating balances consistency, speed, safety, and high-Fear performance. ${profile.strengths[0]} The main cost is that ${profile.weaknesses[0]?.toLowerCase() ?? "execution remains important"}.`,
      strengths: profile.strengths,
      weaknesses: profile.weaknesses,
      beginnerDifficulty: profile.beginnerDifficulty,
      playstyleCombatSequence: profile.combatSequence,
      arcanaLoadout: profile.arcanaIds.map((id) => arcanaRecommendation(dataset, profile, id)),
      arcanaGraspCost: profile.arcanaIds.reduce((sum, id) => sum + (dataset.domains.arcana.cards.find((card) => card.id === id)?.graspCost ?? 0), 0),
      arcanaConstraint: "If current Grasp cannot hold the full list, keep core cards first, then add Persistence and Death before other support cards.",
      keepsakeRoute,
      familiarHex: [
        {
          reference: reference("mechanics/familiar", profile.familiarId),
          rating: familiar?.rating ?? "B",
          reason: `${familiar?.reason ?? "The Familiar supports the documented combat loop."} This complements the aspect's ${profile.focuses.join(" and ")} plan.`,
          limitation: familiar?.limitation ?? "The Familiar cannot replace the aspect's core Boon and Arcana package.",
          prerequisiteReferences: [],
        },
        {
          reference: reference("mechanics/hex", profile.hexId),
          rating: hex?.rating ?? "B",
          reason: `${hex?.reason ?? "The Hex supports the documented combat loop."} It fits the aspect without changing the listed sequence.`,
          limitation: hex?.limitation ?? "The Hex cannot replace the aspect's core Boon and Magick loop.",
          prerequisiteReferences: [],
        },
      ],
      boonPriorities,
      boonRankings: aspectBoonRankings(dataset, profile, targets),
      duoLegendaryTargets: targets,
      hammerRankings: rankedHammers(dataset, profile),
      buildInteractions: buildInteractions(dataset, profile),
      rewardPriorities: rewardPriorities(profile),
      rewardDecisionRules: rewardDecisionRules(profile),
      conflicts: [
        "Do not split Poms and rarity upgrades across both Attack and Special unless the aspect sequence needs both.",
        "Avoid a Magick-heavy fallback when no regeneration source is secured.",
      ],
      upgradeConflicts: excludedUpgradeConflicts(dataset, profile),
      bossRouteConsiderations: [profile.bossConsideration, profile.routeConsideration],
      contextRatings: Object.entries(profile.contextRatings).map(([ratingContext, rating]) => ({
        context: ratingContext as "consistency" | "speed" | "safety" | "high-fear",
        rating,
        reason: contextReason(profile, ratingContext as "consistency" | "speed" | "safety" | "high-fear"),
        limitation: contextLimitation(profile, ratingContext as "consistency" | "speed" | "safety" | "high-fear"),
      })),
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
  const aspectNameById = new Map(dataset.domains.weapons.aspects.map((record) => [record.id, record.name]));
  return dataset.domains.weapons.weapons.map((weapon) => {
    const weaponAspects = dataset.domains.weapons.aspects
      .filter((record) => record.weaponId === weapon.id)
      .map((record) => aspectById.get(record.id))
      .filter((record): record is AspectGuideRecord => record !== undefined);
    const selectedCounts = new Map<string, { preferred: number; fallback: number }>();
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
    const boonRankings = dataset.domains.boons.boons.map((boon) => {
      const counts = selectedCounts.get(boon.id) ?? { preferred: 0, fallback: 0 };
      const rating: EditorialRating = counts.preferred >= Math.max(2, weaponAspects.length)
        ? "S"
        : counts.preferred > 0
          ? "A"
          : counts.fallback > 0
            ? "B"
            : "C";
      const reason = counts.preferred > 0
        ? `Preferred by ${counts.preferred} of ${weaponAspects.length} aspect guides for this weapon.`
        : counts.fallback > 0
          ? `Listed as a fallback by ${counts.fallback} of ${weaponAspects.length} aspect guides for this weapon.`
          : "No authored aspect guide for this weapon selects it as a default boon.";
      return {
        reference: reference("mechanics/boon", boon.id),
        rating,
        reason,
        limitation: counts.preferred > 0
          ? "The weapon-level rating combines different aspect plans, so the chosen aspect ranking remains authoritative."
          : "This rating does not imply the Boon is unusable in a situational or unlisted build.",
        prerequisiteReferences: boonPrerequisiteReferences(boon, new Set(dataset.domains.boons.boons.map((entry) => entry.id))),
      };
    }).sort((left, right) => ratingScore(right.rating) - ratingScore(left.rating) || compareStrings(left.reference.id, right.reference.id));
    const contexts = ["consistency", "speed", "safety", "high-fear"] as const;
    const contextRatings = contexts.map((ratingContext) => {
      const scores = weaponAspects.map((record) => ratingScore(record.contextRatings.find((entry) => entry.context === ratingContext)?.rating ?? "D"));
      const average = scores.length === 0 ? 1 : scores.reduce((sum, score) => sum + score, 0) / scores.length;
      const strongest = [...weaponAspects].sort((left, right) => {
        const leftRating = left.contextRatings.find((entry) => entry.context === ratingContext)?.rating ?? "D";
        const rightRating = right.contextRatings.find((entry) => entry.context === ratingContext)?.rating ?? "D";
        return ratingScore(rightRating) - ratingScore(leftRating) || compareStrings(left.id, right.id);
      })[0];
      return {
        context: ratingContext,
        rating: scoreRating(average),
        reason: `This rating averages all ${weaponAspects.length} aspects. ${strongest === undefined ? "No aspect guide is available." : `${aspectNameById.get(strongest.id) ?? strongest.id} is the strongest authored ${ratingContext} option.`}`,
        limitation: "A weapon-level average hides aspect-specific strengths, weaknesses, and execution requirements.",
      };
    });
    const strongestAspect = [...weaponAspects].sort((left, right) => {
      const leftRating = left.contextRatings.find((entry) => entry.context === "consistency")?.rating ?? "D";
      const rightRating = right.contextRatings.find((entry) => entry.context === "consistency")?.rating ?? "D";
      return ratingScore(rightRating) - ratingScore(leftRating) || compareStrings(left.id, right.id);
    })[0];
    return {
      recordType: "editorial/weapon-guide",
      id: weapon.id,
      weaponReference: reference("mechanics/weapon", weapon.id),
      context: context(dataset, "main-story"),
      overallRating: scoreRating(contextRatings.reduce((sum, entry) => sum + ratingScore(entry.rating), 0) / contextRatings.length),
      overallReason: `The overall rating averages consistency, speed, safety, and high-Fear results across all ${weaponAspects.length} aspect guides.`,
      recommendation: strongestAspect === undefined
        ? "Choose the aspect whose main move matches the player's safest combat sequence."
        : `Start with ${aspectNameById.get(strongestAspect.id) ?? strongestAspect.id} for the weapon's most consistent authored plan.`,
      reason: `The weapon rating combines all ${weaponAspects.length} aspect guides instead of treating one aspect as the whole weapon.`,
      limitation: "A weapon-level average hides aspect-specific mechanics, so the selected aspect guide remains authoritative for the build.",
      prerequisiteReferences: [reference("mechanics/weapon", weapon.id)],
      fallback: "Use the highest-consistency unlocked aspect and follow its Boon rankings.",
      verificationNotes: verificationNote(identity),
      aspectReferences: weaponAspects.map((record) => record.aspectReference),
      boonRankings,
      contextRatings,
    };
  });
}

function selectedAspectCounts(profiles: readonly AspectProfile[], field: "arcanaIds" | "familiarId" | "hexId"): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();
  for (const profile of profiles) {
    const values = Array.isArray(profile[field]) ? profile[field] as readonly string[] : [profile[field] as string];
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
      recommendation: profile?.recommendation ?? (selectionCount > 0
        ? "Prioritize it when it supports the selected aspect's documented combat loop."
        : "Treat it as a specialized option after the first reliable Arcana layout is complete."),
      reason: profile?.reason ?? `Selected by ${selectionCount} of ${aspectCount} authored aspect guides.`,
      limitation: profile?.limitation ?? "Selection frequency measures coverage across the authored builds, not maximum value in every specialized setup.",
      prerequisiteReferences: [],
      fallback: profile?.fallback ?? "Use the highest-rated available option that supports the current aspect and progression stage.",
      verificationNotes: verificationNote(identity),
      recommendedByAspectCount: selectionCount,
      aspectCount,
    };
  });
}

function classifyBoon(id: string, kind: "duo" | "infusion" | "legendary" | "normal"): {
  readonly rating: EditorialRating;
  readonly recommendation: string;
  readonly reason: string;
  readonly limitation: string;
  readonly fallback: string;
} {
  if (kind === "duo") return {
    rating: "A",
    recommendation: "Take it when the existing build already satisfies its prerequisite path.",
    reason: "Duo effects usually add a high-impact interaction without replacing a functioning core slot.",
    limitation: "It is too prerequisite-dependent to be the starting plan of an unseeded run.",
    fallback: "Keep improving the stronger prerequisite boon if the Duo never appears.",
  };
  if (kind === "legendary") return {
    rating: "A",
    recommendation: "Treat it as a high-ceiling reward after the core build is complete.",
    reason: "Legendary effects can materially raise a finished build's ceiling.",
    limitation: "Rarity and prerequisite burden make it unreliable as a required progression choice.",
    fallback: "Take immediate scaling or defense rather than spending the run chasing its final prerequisite.",
  };
  if (kind === "infusion") return {
    rating: "C",
    recommendation: "Take it only when the current element count already reaches or can reliably reach its threshold.",
    reason: "An active Infusion can be efficient because existing elemental choices pay for the effect.",
    limitation: "Without the threshold, the pick contributes no dependable immediate value.",
    fallback: "Choose a boon that works immediately and preserve only elements already supporting the main build.",
  };
  if (/ManaBoon$|Mana.*Boon$/.test(id)) return {
    rating: "A",
    recommendation: "Prioritize it when the aspect's main sequence repeatedly spends Magick.",
    reason: "Stable Magick recovery keeps Omega, Hex, and other resource-dependent actions available.",
    limitation: "Its value falls on a normal-move build that rarely spends Magick.",
    fallback: "Use a low-cost combat loop and take another recovery source when available.",
  };
  if (/LowHealth|MissingHealth|Alone|Sacrifice|TradeOff/.test(id)) return {
    rating: "C",
    recommendation: "Use it only when the stated condition already matches the run plan.",
    reason: "The conditional payoff can be strong when no extra risk or rebuild is required.",
    limitation: "Forcing the condition can reduce consistency or invalidate a safer build.",
    fallback: "Take unconditional damage, health, or Magick value.",
  };
  if (/Armor|Shield|Heal|Health|Defense|Block/.test(id)) return {
    rating: "B",
    recommendation: "Take it when survival is the current limit or the build already has enough damage.",
    reason: "Defensive value protects progress and makes unfamiliar encounters more repeatable.",
    limitation: "Too much defense can leave bosses and timed encounters underpowered.",
    fallback: "Take a compatible core damage boon if the current Life buffer is already comfortable.",
  };
  if (boonFocus(id) !== null) return {
    rating: "B",
    recommendation: "Use it when its slot is the aspect's primary damage move.",
    reason: "A compatible core-slot boon gives immediate, repeatable value and enables later synergy.",
    limitation: "The general rating cannot account for the speed, range, and hit pattern of every aspect.",
    fallback: "Choose the aspect guide's next compatible core boon instead of filling an unused slot.",
  };
  return {
    rating: "B",
    recommendation: "Take it when its effect strengthens the established build without delaying a missing core slot.",
    reason: "The effect offers useful general value once the run's main damage and resource loop function.",
    limitation: "Its exact value depends on the current aspect, route, and acquired prerequisites.",
    fallback: "Prioritize core damage, Magick recovery, or survival according to the run's current weakness.",
  };
}

function boonRecords(
  dataset: CombinedDataset,
  identity: EditorialSourceIdentity,
  profiles: readonly AspectProfile[],
): readonly BoonRatingRecord[] {
  const boonIds = new Set(dataset.domains.boons.boons.map((boon) => boon.id));
  const godNames = new Map(dataset.domains.boons.gods.map((god) => [god.id, god.name]));
  const primaryCounts = new Map<string, number>();
  const fallbackCounts = new Map<string, number>();
  for (const profile of profiles) {
    for (const id of new Set(profile.primaryBoonIds)) primaryCounts.set(id, (primaryCounts.get(id) ?? 0) + 1);
    for (const id of new Set(profile.fallbackBoonIds)) fallbackCounts.set(id, (fallbackCounts.get(id) ?? 0) + 1);
  }
  return dataset.domains.boons.boons.map((boon) => {
    const evaluation = classifyBoon(boon.id, boon.kind);
    const primaryCount = primaryCounts.get(boon.id) ?? 0;
    const fallbackCount = fallbackCounts.get(boon.id) ?? 0;
    const focus = boonFocus(boon.id);
    const owner = boon.godIds.length > 0 ? ` from ${boon.godIds.map((id) => godNames.get(id) ?? id).join(" and ")}` : "";
    const rating: EditorialRating = primaryCount >= Math.ceil(profiles.length * 0.25)
      ? "S"
      : primaryCount > 0
        ? "A"
        : fallbackCount > 0
          ? "B"
          : evaluation.rating;
    const reason = primaryCount > 0
      ? `${boon.name} is a primary choice in ${primaryCount} of ${profiles.length} authored aspect builds${focus === null ? "" : ` for its ${focus} role`}.`
      : fallbackCount > 0
        ? `${boon.name} is a fallback in ${fallbackCount} of ${profiles.length} authored aspect builds when their preferred package is unavailable.`
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
      prerequisiteReferences: [...prerequisiteIds(boon.prerequisites, boonIds)].sort(compareStrings).map((id) => reference("mechanics/boon", id)),
      fallback: evaluation.fallback,
      verificationNotes: verificationNote(identity),
    };
  });
}

function keepsakeJudgment(id: string): Pick<KeepsakePriorityRecord, "priority" | keyof EditorialJudgment> {
  if (/^Force.*BoonKeepsake$/.test(id)) return {
    priority: "A",
    recommendation: "Acquire and level it early when its god is part of a planned aspect opener.",
    reason: "A god-forcing keepsake improves opening consistency and reduces reroll pressure.",
    limitation: "It is less useful after the build's god pool and core slots are already established.",
    prerequisiteReferences: [],
    fallback: "Use a survival keepsake when no specific opening god is required.",
    verificationNotes: "Policy reviewed against the normalized keepsake effect and acquisition record.",
  };
  if (/Reincarnation|BlockDeath|DoorHeal|ArmorGain/.test(id)) return {
    priority: "A",
    recommendation: "Level it early if survival is limiting route progress.",
    reason: "Its defensive purpose remains useful before a build has strong damage and encounter knowledge.",
    limitation: "It does not directly assemble a boon package or accelerate a comfortable clear.",
    prerequisiteReferences: [],
    fallback: "Switch to the planned god keepsake once survival is stable.",
    verificationNotes: "Policy reviewed against the normalized keepsake effect and acquisition record.",
  };
  if (/Boss|Hammer|Spell|Mana|Rarify|Fountain/.test(id)) return {
    priority: "B",
    recommendation: "Level it after the first defensive and god-forcing options used by the main build.",
    reason: "It supports a specific route phase or build system well but is not required on every night.",
    limitation: "Its narrower window makes early universal keepsakes more efficient.",
    prerequisiteReferences: [],
    fallback: "Use a god-forcing or survival keepsake that advances the current route objective.",
    verificationNotes: "Policy reviewed against the normalized keepsake effect and acquisition record.",
  };
  return {
    priority: "C",
    recommendation: "Acquire it when convenient and level it after the main route loadouts are covered.",
    reason: "It adds a useful alternative or completion option without being central to reliable early progress.",
    limitation: "Earlier investment competes with keepsakes used more often during progression.",
    prerequisiteReferences: [],
    fallback: "Keep leveling the currently used route or god keepsake.",
    verificationNotes: "Policy reviewed against the normalized keepsake effect and acquisition record.",
  };
}

function keepsakeRecords(dataset: CombinedDataset, identity: EditorialSourceIdentity): readonly KeepsakePriorityRecord[] {
  return dataset.domains.loadouts.keepsakes.map((keepsake) => {
    const judgment = keepsakeJudgment(keepsake.id);
    const lifecycle = keepsakeLifecycle(keepsake.id);
    return {
      recordType: "mechanics/keepsake",
      id: keepsake.id,
      subjectReference: reference("mechanics/keepsake", keepsake.id),
      context: context(dataset, "first-route-clear"),
      ...judgment,
      reason: `${keepsake.displayName} is rated ${judgment.priority}. ${judgment.reason} ${keepsakeLifecycleReason(lifecycle)}`,
      lifecycle,
      switchWhenInactive: keepsakeInactiveSwitch(keepsake.id, lifecycle),
      verificationNotes: `${judgment.verificationNotes} ${verificationNote(identity)}`,
    };
  });
}

function resourceIdsForReference(dataset: CombinedDataset, item: EditorialReference): readonly string[] {
  if (item.recordType === "mechanics/weapon") {
    return dataset.domains.weapons.weapons.find((record) => record.id === item.id)?.unlockCosts?.map((cost) => cost.resourceId) ?? [];
  }
  if (item.recordType === "mechanics/weapon-aspect") {
    return dataset.domains.weapons.aspects.find((record) => record.id === item.id)?.ranks?.flatMap((rank) => rank.costs.map((cost) => cost.resourceId)) ?? [];
  }
  if (item.recordType === "mechanics/arcana-card") {
    const card = dataset.domains.arcana.cards.find((record) => record.id === item.id);
    return card === undefined ? [] : [...(card.unlockCosts ?? []), ...(card.ranks?.flatMap((rank) => rank.upgradeFromPreviousCosts) ?? [])].map((cost) => cost.resourceId);
  }
  if (item.recordType === "mechanics/familiar") {
    return dataset.domains.loadouts.familiars.find((record) => record.id === item.id)?.upgrades?.flatMap((upgrade) => upgrade.ranks.flatMap((rank) => rank.costs.map((cost) => cost.resourceId))) ?? [];
  }
  if (item.recordType === "mechanics/incantation") {
    return dataset.domains.loadouts.incantations.find((record) => record.id === item.id)?.costs?.map((cost) => cost.resourceId) ?? [];
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
      stage: "first-route-clear", priority: "S", policy: "spend-for-next-target",
      recommendation: "Spend it on Grasp until the first complete Arcana loadout fits, then fund the next planned capacity increase.",
      reason: "Grasp determines how many Arcana Cards can be active and is the first permanent capacity constraint.",
    },
    MetaCurrency: {
      stage: "first-route-clear", priority: "A", policy: "spend-for-next-target",
      recommendation: "Trade it only for the resource shortage blocking the next named permanent upgrade.",
      reason: "Its exchange value is most useful when it closes an exact weapon, Arcana, incantation, or relationship cost.",
    },
    PlantFNightshadeSeed: {
      stage: "main-story", priority: "B", policy: "reserve",
      recommendation: "Grow and reserve it for the next revealed incantation or tracked Grasp objective before planting surplus seeds.",
      reason: "Its known use overlaps permanent progression and a Grasp prophecy rather than immediate run power.",
    },
    CharonPoints: {
      stage: "main-story", priority: "B", policy: "spend-for-next-target",
      recommendation: "Redeem it when Charon's Crossroads stash is available instead of carrying an unused balance.",
      reason: "The currency has one known reward path and a related prophecy, so delaying redemption adds no route value.",
    },
    SuperGiftPoints: {
      stage: "main-story", priority: "B", policy: "reserve",
      recommendation: "Reserve it for the next relationship or Familiar objective named by the current story and completion checklist.",
      reason: "Its known uses advance late relationships, Familiar upgrades, and hidden-aspect objectives.",
    },
    GemPoints: {
      stage: "practical-postgame", priority: "B", policy: "reserve",
      recommendation: "Reserve it for the next Chaos Trial package or tracked Fear objective.",
      reason: "Its known uses belong to challenge packages and a Fear-related prophecy after ordinary route progress is stable.",
    },
    Mixer5Common: {
      stage: "practical-postgame", priority: "B", policy: "reserve",
      recommendation: "Reserve it for the next maximum aspect rank or all-weapon completion target.",
      reason: "Its known uses support maximum weapon strength and broad aspect or Familiar completion.",
    },
    CosmeticsPoints: {
      stage: "exhaustive-completion", priority: "D", policy: "optional",
      recommendation: "Spend it only on a tracked decoration requirement after combat and story purchases are funded.",
      reason: "Its known use is cosmetic completion rather than route power.",
    },
    DreamPoints: {
      stage: "exhaustive-completion", priority: "D", policy: "optional",
      recommendation: "Spend it only on a tracked decorative requirement after practical completion.",
      reason: "Its known use is decorative and does not strengthen a normal progression run.",
    },
  } as const;
  const prioritizedUses = new Map<string, { readonly stage: ProgressionStageSource; readonly priority: ProgressionPriority }[]>();
  for (const stage of stages) {
    for (const priority of stage.priorityReferences) {
      for (const resourceId of new Set(resourceIdsForReference(dataset, priority.reference))) {
        const uses = prioritizedUses.get(resourceId) ?? [];
        uses.push({ stage, priority });
        prioritizedUses.set(resourceId, uses);
      }
    }
  }
  return dataset.domains.guide.resources.map((resource) => {
    const uses = [...(prioritizedUses.get(resource.id) ?? [])].sort((left, right) => left.stage.order - right.stage.order || left.priority.order - right.priority.order);
    const recommendedUseReferences = uses
      .map((entry) => entry.priority.reference)
      .filter((item, index, values) => values.findIndex((candidate) => key(candidate) === key(item)) === index);
    const firstUse = uses[0];
    const explicit = explicitAdvice[resource.id as keyof typeof explicitAdvice];
    const optional = /Cosmetic|Badge|Music|Gift/.test(resource.id);
    const scarce = /Boss|WeaponPoint|CardUpgrade|Familiar|Nightmare|Mixer/.test(resource.id);
    const policy = explicit?.policy ?? (optional ? "optional" : scarce ? "reserve" : "spend-for-next-target");
    const priority: EditorialRating = explicit?.priority ?? (firstUse?.priority.required === true && firstUse.stage.order === 1
      ? "S"
      : firstUse !== undefined && firstUse.stage.order <= 2
        ? "A"
        : firstUse !== undefined || scarce
          ? "B"
          : optional
            ? "D"
            : "C");
    const recommendation = explicit?.recommendation ?? (policy === "optional"
      ? "Spend it only after the current progression purchase is funded."
      : policy === "reserve"
        ? "Reserve it for the next named unlock or rank and avoid unplanned sidegrades."
        : "Spend it on the next permanent progression target rather than accumulating it without a plan.");
    return {
      recordType: "mechanics/resource",
      id: resource.id,
      subjectReference: reference("mechanics/resource", resource.id),
      context: context(dataset, explicit?.stage ?? firstUse?.stage.endpoint ?? "main-story"),
      policy,
      priority,
      earliestRecommendedStage: explicit?.stage ?? firstUse?.stage.endpoint ?? "unprioritized",
      recommendedUseReferences,
      recommendation,
      reason: explicit?.reason ?? (firstUse !== undefined
        ? `The first ordered guide target that spends this resource is ${firstUse.priority.reference.recordType}:${firstUse.priority.reference.id}.`
        : resource.useReferences.length > 0
        ? "The normalized record has concrete uses, so tying spending to the next target prevents duplicate farming."
        : "No current normalized use should be invented, so the resource should not drive the primary route until a verified use appears."),
      limitation: "A newly revealed incantation or upgrade can change the nearest useful target on a later night.",
      prerequisiteReferences: [],
      fallback: "Hold the resource and recheck the authoritative use list after the next unlock.",
      verificationNotes: verificationNote(identity),
    };
  });
}

function usefulAlias(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function aliasRecords(dataset: CombinedDataset): readonly SearchAliasRecord[] {
  const weaponNames = new Map(dataset.domains.weapons.weapons.map((weapon) => [weapon.id, weapon.name]));
  const godNames = new Map(dataset.domains.boons.gods.map((god) => [god.id, god.name]));
  const records: SearchAliasRecord[] = [];
  const aspectShortNames = dataset.domains.weapons.aspects.map((aspect) => aspect.name.replace(/^Aspect of (the )?/i, ""));
  for (const aspect of dataset.domains.weapons.aspects) {
    const shortName = aspect.name.replace(/^Aspect of (the )?/i, "");
    const weaponName = weaponNames.get(aspect.weaponId) ?? "weapon";
    const aliases = [usefulAlias(`${shortName} ${weaponName}`)];
    if (aspectShortNames.filter((name) => name === shortName).length === 1) aliases.push(usefulAlias(`${shortName} aspect`));
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
    records.push({
      recordType: "foundation/record-metadata",
      id: `mechanics/keepsake:${keepsake.id}`,
      subjectReference: reference("mechanics/keepsake", keepsake.id),
      aliases: [usefulAlias(`${keepsake.relationshipName} keepsake`)],
    });
  }
  return records.sort((left, right) => compareStrings(left.id, right.id));
}

function allReferences(dataset: EditorialDataset): readonly EditorialReference[] {
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
      ...record.arcanaLoadout.flatMap((entry) => [entry.reference, ...entry.prerequisiteReferences]),
      ...record.keepsakeRoute.map((entry) => entry.reference),
      ...record.familiarHex.flatMap((entry) => [entry.reference, ...entry.prerequisiteReferences]),
      ...record.boonPriorities.flatMap((priority) => [...priority.preferred, ...priority.fallback]
        .flatMap((rating) => [rating.reference, ...rating.prerequisiteReferences])),
      ...record.boonRankings.flatMap((rating) => [rating.reference, ...rating.prerequisiteReferences]),
      ...record.duoLegendaryTargets.flatMap((rating) => [rating.reference, ...rating.prerequisiteReferences]),
      ...record.hammerRankings.flatMap((rating) => [rating.reference, ...rating.prerequisiteReferences]),
      ...record.buildInteractions.flatMap((entry) => entry.references),
      ...record.upgradeConflicts.flatMap((entry) => entry.references),
    ]),
    ...dataset.weaponGuides.flatMap((record) => [
      record.weaponReference,
      ...record.prerequisiteReferences,
      ...record.aspectReferences,
      ...record.boonRankings.flatMap((rating) => [rating.reference, ...rating.prerequisiteReferences]),
    ]),
    ...dataset.boonRatings.flatMap((record) => [record.subjectReference, ...record.prerequisiteReferences]),
    ...[...dataset.arcanaRatings, ...dataset.familiarRatings, ...dataset.hexRatings]
      .flatMap((record) => [record.subjectReference, ...record.prerequisiteReferences]),
    ...dataset.keepsakePriorities.map((record) => record.subjectReference),
    ...dataset.resourceAdvice.flatMap((record) => [record.subjectReference, ...record.recommendedUseReferences]),
    ...dataset.searchAliases.map((record) => record.subjectReference),
  ];
}

function nonempty(value: string): boolean {
  return value.trim().length > 0;
}

function invalidRatedReference(record: RatedReference): boolean {
  return !nonempty(record.reason) || !nonempty(record.limitation);
}

function invalidJudgment(record: EditorialJudgment & { readonly id: string; readonly context: EditorialContext }, source: EditorialDataset["source"]): boolean {
  return ![
    record.recommendation,
    record.reason,
    record.limitation,
    record.fallback,
    record.verificationNotes,
    record.context.progressionStage,
  ].every(nonempty) || record.context.reader !== "new-player" ||
    record.context.steamBuildId !== source.steamBuildId ||
    record.context.executableVersion !== source.executableVersion ||
    record.context.packageVersion !== source.packageVersion;
}

function invalidRecords(editorial: EditorialDataset, combined: CombinedDataset): readonly string[] {
  const invalid: string[] = [];
  const boonIds = new Set(combined.domains.boons.boons.map((record) => record.id));
  const aspectIdsByWeapon = new Map(combined.domains.weapons.weapons.map((weapon) => [
    weapon.id,
    new Set(combined.domains.weapons.aspects.filter((aspect) => aspect.weaponId === weapon.id).map((aspect) => aspect.id)),
  ]));
  const requiredLoadoutTypes = [
    "mechanics/weapon",
    "mechanics/weapon-aspect",
    "mechanics/arcana-card",
    "mechanics/keepsake",
    "mechanics/familiar",
    "mechanics/hex",
  ];
  const requiredBoonSlots = new Set(boonSlots);
  const populatedBoonSlots = new Set(combined.domains.boons.boons.map((boon) => coreBoonAliasSlot(boon.id)).filter((slot): slot is typeof boonSlots[number] => slot !== null));
  const arcanaProfileIds = new Set<string>(arcanaProfiles.map((profile) => profile.id));
  for (const record of editorial.progressionStages) {
    const loadoutTypes = new Set(record.loadoutReferences.map((entry) => entry.recordType));
    const priorityOrders = record.priorityReferences.map((entry) => entry.order);
    if (invalidJudgment(record, editorial.source) || record.readerKnowledge.length === 0 ||
      record.actionSequence.length < 5 || requiredLoadoutTypes.some((recordType) => !loadoutTypes.has(recordType)) ||
      record.purchaseUpgradePriorities.length === 0 || record.resourcePolicy.length === 0 ||
      record.loadoutReferences.length === 0 || record.priorityReferences.length === 0 ||
      priorityOrders.some((order, index) => order !== index + 1) ||
      record.priorityReferences.some((entry) => !nonempty(entry.reason)) || record.boonEncounterPriorities.length === 0 ||
      record.routeLateGame.length === 0 || record.completionChecklist.length === 0 || record.completionReferences.length === 0) {
      invalid.push(`${record.recordType}:${record.id}`);
    }
  }
  for (const record of editorial.weaponGuides) {
    const rankedBoonIds = new Set(record.boonRankings.map((entry) => entry.reference.id));
    const referencedAspectIds = new Set(record.aspectReferences.map((entry) => entry.id));
    const expectedAspectIds = aspectIdsByWeapon.get(record.id) ?? new Set<string>();
    if (invalidJudgment(record, editorial.source) || !nonempty(record.overallReason) || record.aspectReferences.length === 0 ||
      record.boonRankings.length !== boonIds.size || rankedBoonIds.size !== boonIds.size ||
      [...rankedBoonIds].some((id) => !boonIds.has(id)) ||
      referencedAspectIds.size !== expectedAspectIds.size || [...referencedAspectIds].some((id) => !expectedAspectIds.has(id)) ||
      record.boonRankings.some(invalidRatedReference) ||
      record.contextRatings.length !== 4 || record.contextRatings.some((entry) => !nonempty(entry.reason) || !nonempty(entry.limitation))) {
      invalid.push(`${record.recordType}:${record.id}`);
    }
  }
  for (const record of editorial.aspectGuides) {
    const rankedBoonIds = new Set(record.boonRankings.map((entry) => entry.reference.id));
    const prioritySlots = new Set(record.boonPriorities.map((priority) => priority.slot));
    const excludedHammerIds = new Set(combined.domains.weapons.hammers
      .filter((hammer) => hammer.compatibility.excludedAspectIds.includes(record.id))
      .map((hammer) => hammer.id));
    const conflictHammerIds = new Set(record.upgradeConflicts.flatMap((entry) => entry.references.map((item) => item.id)));
    const expectedGrasp = record.arcanaLoadout.reduce((sum, entry) => sum + (combined.domains.arcana.cards.find((card) => card.id === entry.reference.id)?.graspCost ?? 0), 0);
    const keepsakeStages = new Set(record.keepsakeRoute.map((entry) => entry.stage));
    const preferredHammerIds = new Set(preferredHammersByAspect[record.id as keyof typeof preferredHammersByAspect] ?? []);
    const topHammerIds = new Set(record.hammerRankings.filter((entry) => entry.rating === "S").map((entry) => entry.reference.id));
    const rewardKinds = new Set(record.rewardPriorities.map((entry) => entry.reward));
    const rewardRuleKinds = new Set<string>(record.rewardDecisionRules.map((entry) => entry.choose));
    const requiredRewardRuleKinds = new Set<string>(["core-boon", "hammer", "maximum-life", "permanent-resource", "pom", "duo-legendary"]);
    if (invalidJudgment(record, editorial.source) || record.context.aspectId !== record.id ||
      !nonempty(record.overallReason) || record.rankEvaluations.length !== 2 ||
      record.rankEvaluations.some((entry) => !nonempty(entry.reason) || !nonempty(entry.limitation)) ||
      record.strengths.length === 0 || record.weaknesses.length === 0 ||
      record.beginnerDifficulty < 1 || record.beginnerDifficulty > 5 || record.playstyleCombatSequence.length === 0 ||
      record.arcanaLoadout.length === 0 || record.arcanaLoadout.some(invalidRatedReference) ||
      record.arcanaGraspCost !== expectedGrasp || !nonempty(record.arcanaConstraint) ||
      record.keepsakeRoute.length !== 4 || keepsakeStages.size !== 4 ||
      record.keepsakeRoute.some((entry) => !nonempty(entry.reason) || !nonempty(entry.switchCondition) ||
        entry.lifecycle !== "persistent" && !entry.switchCondition.includes("next keepsake cabinet")) || record.familiarHex.length === 0 ||
      record.familiarHex.some(invalidRatedReference) ||
      record.boonPriorities.length !== requiredBoonSlots.size || prioritySlots.size !== requiredBoonSlots.size ||
      [...prioritySlots].some((slot) => !requiredBoonSlots.has(slot)) ||
      record.boonPriorities.some((priority) => populatedBoonSlots.has(priority.slot) && priority.preferred.length + priority.fallback.length === 0) ||
      record.boonPriorities.some((priority) => [...priority.preferred, ...priority.fallback].some(invalidRatedReference)) ||
      record.boonRankings.length !== boonIds.size || rankedBoonIds.size !== boonIds.size ||
      [...rankedBoonIds].some((id) => !boonIds.has(id)) || record.boonRankings.some(invalidRatedReference) ||
      record.duoLegendaryTargets.some(invalidRatedReference) ||
      record.hammerRankings.length === 0 || record.hammerRankings.some(invalidRatedReference) ||
      [...preferredHammerIds].some((id) => !topHammerIds.has(id)) ||
      record.buildInteractions.length < 3 || !record.buildInteractions.some((entry) => entry.kind === "synergy") ||
      record.buildInteractions.some((entry) => entry.references.length === 0 || !nonempty(entry.reason) || !nonempty(entry.condition)) ||
      record.rewardPriorities.length !== 6 || rewardKinds.size !== 6 ||
      record.rewardPriorities.some((entry, index) => entry.order !== index + 1 || !nonempty(entry.reason)) ||
      [...requiredRewardRuleKinds].some((kind) => !rewardRuleKinds.has(kind)) ||
      record.rewardDecisionRules.some((entry) => !nonempty(entry.condition) || !nonempty(entry.reason) || entry.over.length === 0) ||
      record.conflicts.length === 0 || record.bossRouteConsiderations.length < 2 ||
      [...excludedHammerIds].some((id) => !conflictHammerIds.has(id)) ||
      record.upgradeConflicts.some((entry) => entry.references.length === 0 || !nonempty(entry.reason)) ||
      record.contextRatings.length !== 4 || record.contextRatings.some((entry) => !nonempty(entry.reason) || !nonempty(entry.limitation))) {
      invalid.push(`${record.recordType}:${record.id}`);
    }
  }
  for (const record of editorial.boonRatings) {
    if (invalidJudgment(record, editorial.source) || record.evaluationDimension !== "general-value") {
      invalid.push(`${record.recordType}:${record.id}`);
    }
  }
  for (const record of [...editorial.arcanaRatings, ...editorial.familiarRatings, ...editorial.hexRatings]) {
    if (invalidJudgment(record, editorial.source) || record.evaluationDimension !== "new-player-value" ||
      record.aspectCount <= 0 || record.recommendedByAspectCount < 0 || record.recommendedByAspectCount > record.aspectCount) {
      invalid.push(`${record.recordType}:${record.id}`);
    }
  }
  for (const record of editorial.arcanaRatings) {
    if (!arcanaProfileIds.has(record.id) || record.reason.startsWith("Selected by ")) invalid.push(`${record.recordType}:${record.id}`);
  }
  for (const record of editorial.keepsakePriorities) {
    if (invalidJudgment(record, editorial.source) || !nonempty(record.switchWhenInactive)) invalid.push(`${record.recordType}:${record.id}`);
  }
  for (const record of editorial.resourceAdvice) {
    if (invalidJudgment(record, editorial.source) ||
      (record.recommendedUseReferences.length > 0 || explicitlyPrioritizedResourceIds.has(record.id)) && record.earliestRecommendedStage === "unprioritized") {
      invalid.push(`${record.recordType}:${record.id}`);
    }
  }
  for (const record of editorial.searchAliases) {
    const lowered = record.aliases.map((alias) => alias.trim().toLocaleLowerCase("en-US"));
    if (lowered.length === 0 || lowered.some((alias) => alias.length === 0) || new Set(lowered).size !== lowered.length) {
      invalid.push(`${record.recordType}:${record.id}`);
    }
  }
  for (const definition of editorial.pageDefinitions) {
    const aliases = definition.aliases.map((alias) => alias.trim().toLocaleLowerCase("en-US"));
    if (!nonempty(definition.id) || !nonempty(definition.title) || definition.sourceRecordTypes.length === 0 ||
      aliases.length === 0 || aliases.some((alias) => alias.length === 0) || new Set(aliases).size !== aliases.length) {
      invalid.push(`page-definition:${definition.id}`);
    }
  }
  const arcanaPage = editorial.pageDefinitions.find((definition) => definition.id === "reference/arcana");
  if (arcanaPage === undefined || !arcanaPage.aliases.map((alias) => alias.toLocaleLowerCase("en-US")).includes("tarot cards")) {
    invalid.push("page-definition:reference/arcana");
  }
  const aliasOwners = new Map<string, string>();
  for (const record of editorial.searchAliases) {
    for (const alias of record.aliases) {
      const normalized = alias.trim().toLocaleLowerCase("en-US");
      const owner = `${record.recordType}:${record.id}`;
      const existing = aliasOwners.get(normalized);
      if (existing !== undefined && existing !== owner) invalid.push(existing, owner);
      aliasOwners.set(normalized, owner);
    }
  }
  for (const definition of editorial.pageDefinitions) {
    for (const alias of definition.aliases) {
      const normalized = alias.trim().toLocaleLowerCase("en-US");
      const owner = `page-definition:${definition.id}`;
      const existing = aliasOwners.get(normalized);
      if (existing !== undefined && existing !== owner) invalid.push(existing, owner);
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
  const factual = new Set(catalog(combined).map((record) => `${record.recordType}:${record.id}`));
  const missingReferences = [...new Set(allReferences(editorial).filter((item) => !factual.has(key(item))).map(key))].sort(compareStrings);
  const aliasSubjects = new Set(editorial.searchAliases.map((record) => key(record.subjectReference)));
  const requiredAliases = [
    ...combined.domains.weapons.aspects.map((record) => `mechanics/weapon-aspect:${record.id}`),
    ...combined.domains.loadouts.keepsakes.map((record) => `mechanics/keepsake:${record.id}`),
    ...combined.domains.boons.boons.filter((record) => coreBoonAliasSlot(record.id) !== null && record.godIds.length === 1).map((record) => `mechanics/boon:${record.id}`),
  ];
  const missingAliases = requiredAliases.filter((item) => !aliasSubjects.has(item)).sort(compareStrings);
  const weaponIds = new Set(combined.domains.weapons.weapons.map((record) => record.id));
  const aspectIds = new Set(combined.domains.weapons.aspects.map((record) => record.id));
  const boonIds = new Set(combined.domains.boons.boons.map((record) => record.id));
  const arcanaIds = new Set(combined.domains.arcana.cards.map((record) => record.id));
  const keepsakeIds = new Set(combined.domains.loadouts.keepsakes.map((record) => record.id));
  const familiarIds = new Set(combined.domains.loadouts.familiars.map((record) => record.id));
  const hexIds = new Set(combined.domains.loadouts.hexes.map((record) => record.id));
  const resourceIds = new Set(combined.domains.guide.resources.map((record) => record.id));
  const orphanRecordIds = [
    ...editorial.weaponGuides.filter((record) => !weaponIds.has(record.id)).map((record) => `editorial/weapon-guide:${record.id}`),
    ...editorial.aspectGuides.filter((record) => !aspectIds.has(record.id)).map((record) => `editorial/aspect-guide:${record.id}`),
    ...editorial.boonRatings.filter((record) => !boonIds.has(record.subjectReference.id)).map((record) => `editorial/boon-rating:${record.id}`),
    ...editorial.arcanaRatings.filter((record) => !arcanaIds.has(record.id)).map((record) => `editorial/arcana-rating:${record.id}`),
    ...editorial.familiarRatings.filter((record) => !familiarIds.has(record.id)).map((record) => `editorial/familiar-rating:${record.id}`),
    ...editorial.hexRatings.filter((record) => !hexIds.has(record.id)).map((record) => `editorial/hex-rating:${record.id}`),
    ...editorial.keepsakePriorities.filter((record) => !keepsakeIds.has(record.id)).map((record) => `mechanics/keepsake:${record.id}`),
    ...editorial.resourceAdvice.filter((record) => !resourceIds.has(record.id)).map((record) => `mechanics/resource:${record.id}`),
  ].sort(compareStrings);
  const covered = new Set([
    ...editorial.pageDefinitions.map((record) => `page-definition:${record.id}`),
    ...editorial.progressionStages.map((record) => `editorial/progression-stage:${record.id}`),
    ...editorial.weaponGuides.map((record) => `editorial/weapon-guide:${record.id}`),
    ...editorial.aspectGuides.map((record) => `editorial/aspect-guide:${record.id}`),
    ...editorial.boonRatings.map((record) => `editorial/boon-rating:${record.subjectReference.id}`),
    ...editorial.arcanaRatings.map((record) => `editorial/arcana-rating:${record.id}`),
    ...editorial.familiarRatings.map((record) => `editorial/familiar-rating:${record.id}`),
    ...editorial.hexRatings.map((record) => `editorial/hex-rating:${record.id}`),
    ...editorial.keepsakePriorities.map((record) => `mechanics/keepsake:${record.id}`),
    ...editorial.resourceAdvice.map((record) => `mechanics/resource:${record.id}`),
  ]);
  const requiredPages = [
    ...pageDefinitions.map((record) => `page-definition:${record.id}`),
    ...requiredStages.map((record) => `editorial/progression-stage:${record.id}`),
    ...combined.domains.weapons.weapons.map((record) => `editorial/weapon-guide:${record.id}`),
    ...combined.domains.weapons.aspects.map((record) => `editorial/aspect-guide:${record.id}`),
    ...combined.domains.boons.boons.map((record) => `editorial/boon-rating:${record.id}`),
    ...combined.domains.arcana.cards.map((record) => `editorial/arcana-rating:${record.id}`),
    ...combined.domains.loadouts.familiars.map((record) => `editorial/familiar-rating:${record.id}`),
    ...combined.domains.loadouts.hexes.map((record) => `editorial/hex-rating:${record.id}`),
    ...combined.domains.loadouts.keepsakes.map((record) => `mechanics/keepsake:${record.id}`),
    ...combined.domains.guide.resources.map((record) => `mechanics/resource:${record.id}`),
  ];
  const requiredPagesWithoutEditorialCoverage = requiredPages.filter((item) => !covered.has(item)).sort(compareStrings);
  const recordIds = [
    ...editorial.pageDefinitions.map((record) => `page-definition:${record.id}`),
    ...editorial.progressionStages.map((record) => `${record.recordType}:${record.id}`),
    ...editorial.weaponGuides.map((record) => `${record.recordType}:${record.id}`),
    ...editorial.aspectGuides.map((record) => `${record.recordType}:${record.id}`),
    ...editorial.boonRatings.map((record) => `${record.recordType}:${record.id}`),
    ...editorial.arcanaRatings.map((record) => `${record.recordType}:${record.id}`),
    ...editorial.familiarRatings.map((record) => `${record.recordType}:${record.id}`),
    ...editorial.hexRatings.map((record) => `${record.recordType}:${record.id}`),
    ...editorial.keepsakePriorities.map((record) => `${record.recordType}:${record.id}`),
    ...editorial.resourceAdvice.map((record) => `${record.recordType}:${record.id}`),
    ...editorial.searchAliases.map((record) => `${record.recordType}:${record.id}`),
  ];
  const seen = new Set<string>();
  const duplicateRecordIds = [...new Set(recordIds.filter((id) => seen.has(id) || !seen.add(id)))].sort(compareStrings);
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
  const complete = [missingReferences, missingAliases, orphanRecordIds, requiredPagesWithoutEditorialCoverage, duplicateRecordIds, invalidEditorialRecords]
    .every((issues) => issues.length === 0) &&
    counts.progressionStages === requiredStages.length && counts.pageDefinitions === pageDefinitions.length &&
    counts.weaponGuides === weaponIds.size && counts.aspectGuides === aspectIds.size &&
    counts.boonRatings === boonIds.size && counts.arcanaRatings === arcanaIds.size &&
    counts.familiarRatings === familiarIds.size && counts.hexRatings === hexIds.size &&
    counts.keepsakePriorities === keepsakeIds.size && counts.resourceAdvice === resourceIds.size;
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
    arcanaRatings: tierRecords(combined, identity, "editorial/arcana-rating", "mechanics/arcana-card", combined.domains.arcana.cards, arcanaCounts, profiles.length, arcanaProfiles),
    familiarRatings: tierRecords(combined, identity, "editorial/familiar-rating", "mechanics/familiar", combined.domains.loadouts.familiars, familiarCounts, profiles.length, familiarProfiles),
    hexRatings: tierRecords(combined, identity, "editorial/hex-rating", "mechanics/hex", combined.domains.loadouts.hexes, hexCounts, profiles.length, hexProfiles),
    keepsakePriorities: keepsakeRecords(combined, identity),
      resourceAdvice: resourceRecords(combined, identity, stages),
    searchAliases: aliasRecords(combined),
  };
  return { dataset, report: createContentReport(dataset, combined, stages) };
}
