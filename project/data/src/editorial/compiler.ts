import type { JsonValue } from "../boons/index.js";
import type { CombinedDataset } from "../dataset/index.js";
import { aspectProfiles, progressionStages } from "./content.js";
import type {
  AspectGuideRecord,
  AspectProfile,
  BoonRatingRecord,
  CombatFocus,
  ContentReport,
  EditorialContext,
  EditorialDataset,
  EditorialJudgment,
  EditorialRating,
  EditorialReference,
  KeepsakePriorityRecord,
  ProgressionStageRecord,
  ProgressionStageSource,
  RatedReference,
  ResourceAdviceRecord,
  SearchAliasRecord,
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
    recommendation: stage.nextObjective,
    reason: stage.reason,
    limitation: "Random offers and story sequencing can change the number of nights needed, so milestone evidence takes priority over run counts.",
    prerequisiteReferences: index === 0 ? [] : (stages[index - 1]?.completionReferences ?? []),
    fallback: stage.fallback,
    verificationNotes: verificationNote(identity),
    purchaseUpgradePriorities: stage.purchaseUpgradePriorities,
    resourcePolicy: stage.resourcePolicy,
    loadoutReferences: stage.loadoutReferences,
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

function hammerRating(description: string, focuses: readonly CombatFocus[]): EditorialRating {
  const text = description.toLowerCase();
  const matches = focuses.filter((focus) => {
    if (focus === "omega") return text.includes("omega") || text.includes("hold") || text.includes("charge");
    if (focus === "hex") return false;
    return text.includes(focus);
  }).length;
  return matches >= 2 ? "S" : matches === 1 ? "A" : "B";
}

function rankedHammers(dataset: CombinedDataset, profile: AspectProfile): readonly RatedReference[] {
  const aspect = dataset.domains.weapons.aspects.find((candidate) => candidate.id === profile.aspectId);
  if (aspect === undefined) return [];
  return dataset.domains.weapons.hammers
    .filter((hammer) => hammer.weaponId === aspect.weaponId &&
      (hammer.compatibility.allowedAspectIds.length === 0 || hammer.compatibility.allowedAspectIds.includes(profile.aspectId)) &&
      !hammer.compatibility.excludedAspectIds.includes(profile.aspectId) &&
      (hammer.compatibility.requiredAspectIds.length === 0 || hammer.compatibility.requiredAspectIds.includes(profile.aspectId)))
    .map((hammer) => {
      const rating = hammerRating(hammer.description, profile.focuses);
      const matched = profile.focuses.filter((focus) => hammerRating(hammer.description, [focus]) === "A");
      return {
        reference: reference("mechanics/hammer-upgrade", hammer.id),
        rating,
        reason: matched.length > 0
          ? `Directly supports the guide's ${matched.join(" and ")} plan.`
          : "Compatible utility, but it does not directly strengthen the aspect's main loop.",
      };
    })
    .sort((left, right) => ratingScore(right.rating) - ratingScore(left.rating) || compareStrings(left.reference.id, right.reference.id));
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

function compatibleTargets(dataset: CombinedDataset, profile: AspectProfile): readonly EditorialReference[] {
  const boonIds = new Set(dataset.domains.boons.boons.map((boon) => boon.id));
  const planned = new Set([...profile.primaryBoonIds, ...profile.fallbackBoonIds]);
  return dataset.domains.boons.boons
    .filter((boon) => boon.kind === "duo" || boon.kind === "legendary")
    .map((boon) => ({ boon, prerequisites: prerequisiteIds(boon.prerequisites, boonIds) }))
    .filter(({ prerequisites }) => [...prerequisites].some((id) => planned.has(id)))
    .slice(0, 4)
    .map(({ boon }) => reference("mechanics/boon", boon.id));
}

function forceKeepsake(dataset: CombinedDataset, boonId: string): string | null {
  const boon = dataset.domains.boons.boons.find((candidate) => candidate.id === boonId);
  const godId = boon?.godIds[0];
  if (godId === undefined) return null;
  const candidate = `Force${godId.replace(/Upgrade$/, "")}BoonKeepsake`;
  return dataset.domains.loadouts.keepsakes.some((keepsake) => keepsake.id === candidate) ? candidate : null;
}

function aspectRecords(
  dataset: CombinedDataset,
  identity: EditorialSourceIdentity,
  profiles: readonly AspectProfile[],
): readonly AspectGuideRecord[] {
  const boonIds = new Set(dataset.domains.boons.boons.map((boon) => boon.id));
  return profiles.map((profile) => {
    const preferredKeepsake = forceKeepsake(dataset, profile.primaryBoonIds[0] ?? "");
    const keepsakes = [preferredKeepsake, "BossPreDamageKeepsake", "ReincarnationKeepsake"]
      .filter((id): id is string => id !== null)
      .filter((id, index, values) => values.indexOf(id) === index);
    const keepsakeRoute = keepsakes.map((id, index) => ({
      stage: index === 0 && preferredKeepsake !== null
        ? "opening" as const
        : id === "BossPreDamageKeepsake"
          ? "final-region" as const
          : "fallback" as const,
      reference: reference("mechanics/keepsake", id),
      reason: index === 0 && preferredKeepsake !== null
        ? "Use the opening region to secure the first preferred god and core boon."
        : id === "BossPreDamageKeepsake"
          ? "Switch late when boss damage is the remaining route constraint."
          : "Use the extra survival when the planned god is already secured or the route remains unstable.",
    }));
    const boonPriorities = profile.focuses.map((focus) => ({
      slot: focus,
      preferred: profile.primaryBoonIds
        .filter((id) => boonIds.has(id) && (boonFocus(id) === focus || boonFocus(id) === null))
        .map((id) => ({
          reference: reference("mechanics/boon", id),
          rating: "A" as const,
          reason: `Supports the aspect's primary ${focus} sequence.`,
        })),
      fallback: profile.fallbackBoonIds
        .filter((id) => boonIds.has(id) && (boonFocus(id) === focus || boonFocus(id) === null))
        .map((id) => ({
          reference: reference("mechanics/boon", id),
          rating: "B" as const,
          reason: `Keeps the ${focus} slot functional when the preferred package does not appear.`,
        })),
    }));
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
        { rank: "rank-one", rating: ratingFromProfile(profile, "rank-one"), reason: profile.rankOneEvaluation },
        { rank: "maximum", rating: ratingFromProfile(profile, "maximum"), reason: profile.maximumRankEvaluation },
      ],
      strengths: profile.strengths,
      weaknesses: profile.weaknesses,
      beginnerDifficulty: profile.beginnerDifficulty,
      playstyleCombatSequence: profile.combatSequence,
      arcanaLoadout: profile.arcanaIds.map((id) => reference("mechanics/arcana-card", id)),
      keepsakeRoute,
      familiarHex: [reference("mechanics/familiar", profile.familiarId), reference("mechanics/hex", profile.hexId)],
      boonPriorities,
      duoLegendaryTargets: compatibleTargets(dataset, profile),
      hammerRankings: rankedHammers(dataset, profile),
      conflicts: [
        "Do not split Poms and rarity upgrades across both Attack and Special unless the aspect sequence needs both.",
        "Avoid a Magick-heavy fallback when no regeneration source is secured.",
      ],
      bossRouteConsiderations: [profile.bossConsideration, profile.routeConsideration],
      contextRatings: Object.entries(profile.contextRatings).map(([ratingContext, rating]) => ({
        context: ratingContext as "consistency" | "speed" | "safety" | "high-fear",
        rating,
      })),
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

function boonRecords(dataset: CombinedDataset, identity: EditorialSourceIdentity): readonly BoonRatingRecord[] {
  const boonIds = new Set(dataset.domains.boons.boons.map((boon) => boon.id));
  return dataset.domains.boons.boons.map((boon) => {
    const evaluation = classifyBoon(boon.id, boon.kind);
    return {
      recordType: "editorial/boon-rating",
      id: `general:${boon.id}`,
      subjectReference: reference("mechanics/boon", boon.id),
      context: context(dataset, "main-story"),
      evaluationDimension: "general-value",
      rating: evaluation.rating,
      recommendation: evaluation.recommendation,
      reason: evaluation.reason,
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
    return {
      recordType: "mechanics/keepsake",
      id: keepsake.id,
      subjectReference: reference("mechanics/keepsake", keepsake.id),
      context: context(dataset, "first-route-clear"),
      ...judgment,
      verificationNotes: `${judgment.verificationNotes} ${verificationNote(identity)}`,
    };
  });
}

function resourceRecords(dataset: CombinedDataset, identity: EditorialSourceIdentity): readonly ResourceAdviceRecord[] {
  return dataset.domains.guide.resources.map((resource) => {
    const optional = /Cosmetic|Badge|Music|Gift/.test(resource.id);
    const scarce = /Boss|WeaponPoint|CardUpgrade|Familiar|Nightmare|Mixer/.test(resource.id);
    const policy = optional ? "optional" : scarce ? "reserve" : "spend-for-next-target";
    const recommendation = policy === "optional"
      ? "Spend it only after the current progression purchase is funded."
      : policy === "reserve"
        ? "Reserve it for the next named unlock or rank and avoid unplanned sidegrades."
        : "Spend it on the next permanent progression target rather than accumulating it without a plan.";
    return {
      recordType: "mechanics/resource",
      id: resource.id,
      subjectReference: reference("mechanics/resource", resource.id),
      context: context(dataset, "main-story"),
      policy,
      recommendation,
      reason: resource.useReferences.length > 0
        ? "The normalized record has concrete uses, so tying spending to the next target prevents duplicate farming."
        : "No current normalized use should be invented, so the resource should not drive the primary route until a verified use appears.",
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
      ...record.parallelObjectiveReferences,
      ...record.completionReferences,
    ]),
    ...dataset.aspectGuides.flatMap((record) => [
      record.aspectReference,
      ...record.prerequisiteReferences,
      ...record.arcanaLoadout,
      ...record.keepsakeRoute.map((entry) => entry.reference),
      ...record.familiarHex,
      ...record.boonPriorities.flatMap((priority) => [...priority.preferred, ...priority.fallback].map((rating) => rating.reference)),
      ...record.duoLegendaryTargets,
      ...record.hammerRankings.map((rating) => rating.reference),
    ]),
    ...dataset.boonRatings.flatMap((record) => [record.subjectReference, ...record.prerequisiteReferences]),
    ...dataset.keepsakePriorities.map((record) => record.subjectReference),
    ...dataset.resourceAdvice.map((record) => record.subjectReference),
    ...dataset.searchAliases.map((record) => record.subjectReference),
  ];
}

function nonempty(value: string): boolean {
  return value.trim().length > 0;
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

function invalidRecords(editorial: EditorialDataset): readonly string[] {
  const invalid: string[] = [];
  for (const record of editorial.progressionStages) {
    if (invalidJudgment(record, editorial.source) || record.readerKnowledge.length === 0 ||
      record.purchaseUpgradePriorities.length === 0 || record.resourcePolicy.length === 0 ||
      record.loadoutReferences.length === 0 || record.boonEncounterPriorities.length === 0 ||
      record.routeLateGame.length === 0 || record.completionChecklist.length === 0 || record.completionReferences.length === 0) {
      invalid.push(`${record.recordType}:${record.id}`);
    }
  }
  for (const record of editorial.aspectGuides) {
    if (invalidJudgment(record, editorial.source) || record.context.aspectId !== record.id ||
      record.rankEvaluations.length !== 2 || record.strengths.length === 0 || record.weaknesses.length === 0 ||
      record.beginnerDifficulty < 1 || record.beginnerDifficulty > 5 || record.playstyleCombatSequence.length === 0 ||
      record.arcanaLoadout.length === 0 || record.keepsakeRoute.length === 0 || record.familiarHex.length === 0 ||
      record.boonPriorities.length === 0 || record.boonPriorities.some((priority) => priority.preferred.length + priority.fallback.length === 0) ||
      record.hammerRankings.length === 0 || record.conflicts.length === 0 || record.bossRouteConsiderations.length < 2 ||
      record.contextRatings.length !== 4) {
      invalid.push(`${record.recordType}:${record.id}`);
    }
  }
  for (const record of editorial.boonRatings) {
    if (invalidJudgment(record, editorial.source) || record.evaluationDimension !== "general-value") {
      invalid.push(`${record.recordType}:${record.id}`);
    }
  }
  for (const record of [...editorial.keepsakePriorities, ...editorial.resourceAdvice]) {
    if (invalidJudgment(record, editorial.source)) invalid.push(`${record.recordType}:${record.id}`);
  }
  for (const record of editorial.searchAliases) {
    const lowered = record.aliases.map((alias) => alias.trim().toLocaleLowerCase("en-US"));
    if (lowered.length === 0 || lowered.some((alias) => alias.length === 0) || new Set(lowered).size !== lowered.length) {
      invalid.push(`${record.recordType}:${record.id}`);
    }
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
  const aspectIds = new Set(combined.domains.weapons.aspects.map((record) => record.id));
  const boonIds = new Set(combined.domains.boons.boons.map((record) => record.id));
  const keepsakeIds = new Set(combined.domains.loadouts.keepsakes.map((record) => record.id));
  const resourceIds = new Set(combined.domains.guide.resources.map((record) => record.id));
  const orphanRecordIds = [
    ...editorial.aspectGuides.filter((record) => !aspectIds.has(record.id)).map((record) => `editorial/aspect-guide:${record.id}`),
    ...editorial.boonRatings.filter((record) => !boonIds.has(record.subjectReference.id)).map((record) => `editorial/boon-rating:${record.id}`),
    ...editorial.keepsakePriorities.filter((record) => !keepsakeIds.has(record.id)).map((record) => `mechanics/keepsake:${record.id}`),
    ...editorial.resourceAdvice.filter((record) => !resourceIds.has(record.id)).map((record) => `mechanics/resource:${record.id}`),
  ].sort(compareStrings);
  const covered = new Set([
    ...editorial.progressionStages.map((record) => `editorial/progression-stage:${record.id}`),
    ...editorial.aspectGuides.map((record) => `editorial/aspect-guide:${record.id}`),
    ...editorial.boonRatings.map((record) => `editorial/boon-rating:${record.subjectReference.id}`),
    ...editorial.keepsakePriorities.map((record) => `mechanics/keepsake:${record.id}`),
    ...editorial.resourceAdvice.map((record) => `mechanics/resource:${record.id}`),
  ]);
  const requiredPages = [
    ...requiredStages.map((record) => `editorial/progression-stage:${record.id}`),
    ...combined.domains.weapons.aspects.map((record) => `editorial/aspect-guide:${record.id}`),
    ...combined.domains.boons.boons.map((record) => `editorial/boon-rating:${record.id}`),
    ...combined.domains.loadouts.keepsakes.map((record) => `mechanics/keepsake:${record.id}`),
    ...combined.domains.guide.resources.map((record) => `mechanics/resource:${record.id}`),
  ];
  const requiredPagesWithoutEditorialCoverage = requiredPages.filter((item) => !covered.has(item)).sort(compareStrings);
  const recordIds = [
    ...editorial.progressionStages.map((record) => `${record.recordType}:${record.id}`),
    ...editorial.aspectGuides.map((record) => `${record.recordType}:${record.id}`),
    ...editorial.boonRatings.map((record) => `${record.recordType}:${record.id}`),
    ...editorial.keepsakePriorities.map((record) => `${record.recordType}:${record.id}`),
    ...editorial.resourceAdvice.map((record) => `${record.recordType}:${record.id}`),
    ...editorial.searchAliases.map((record) => `${record.recordType}:${record.id}`),
  ];
  const seen = new Set<string>();
  const duplicateRecordIds = [...new Set(recordIds.filter((id) => seen.has(id) || !seen.add(id)))].sort(compareStrings);
  const invalidEditorialRecords = invalidRecords(editorial);
  const counts = {
    progressionStages: editorial.progressionStages.length,
    aspectGuides: editorial.aspectGuides.length,
    boonRatings: editorial.boonRatings.length,
    keepsakePriorities: editorial.keepsakePriorities.length,
    resourceAdvice: editorial.resourceAdvice.length,
    searchAliases: editorial.searchAliases.length,
  };
  const complete = [missingReferences, missingAliases, orphanRecordIds, requiredPagesWithoutEditorialCoverage, duplicateRecordIds, invalidEditorialRecords]
    .every((issues) => issues.length === 0) &&
    counts.progressionStages === requiredStages.length && counts.aspectGuides === aspectIds.size &&
    counts.boonRatings === boonIds.size && counts.keepsakePriorities === keepsakeIds.size && counts.resourceAdvice === resourceIds.size;
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
  const dataset: EditorialDataset = {
    schema: "neodes2-editorial-1",
    source: {
      ...identity,
      steamBuildId: combined.source.steamBuildId,
      executableVersion: combined.source.executableVersion,
      packageVersion: combined.source.packageVersion,
    },
    progressionStages: progressionRecords(combined, identity, stages),
    aspectGuides: aspectRecords(combined, identity, profiles),
    boonRatings: boonRecords(combined, identity),
    keepsakePriorities: keepsakeRecords(combined, identity),
    resourceAdvice: resourceRecords(combined, identity),
    searchAliases: aliasRecords(combined),
  };
  return { dataset, report: createContentReport(dataset, combined, stages) };
}
