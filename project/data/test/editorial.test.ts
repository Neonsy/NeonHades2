import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  arcanaProfiles,
  aspectProfiles,
  compileEditorialDataset,
  createContentReport,
  familiarProfiles,
  hexProfiles,
  pageDefinitions,
  preferredHammersByAspect,
  progressionStages,
  type AspectProfile,
  type CombinedDataset,
  type ProgressionStageSource,
} from "../src/index.js";

const expectedAspectIds = [
  "AxeArmCastAspect",
  "AxePerfectCriticalAspect",
  "AxeRallyAspect",
  "AxeRecoveryAspect",
  "BaseStaffAspect",
  "BaseSuitAspect",
  "DaggerBackstabAspect",
  "DaggerBlockAspect",
  "DaggerHomingThrowAspect",
  "DaggerTripleAspect",
  "LobAmmoBoostAspect",
  "LobCloseAttackAspect",
  "LobGunAspect",
  "LobImpulseAspect",
  "StaffClearCastAspect",
  "StaffRaiseDeadAspect",
  "StaffSelfHitAspect",
  "SuitComboAspect",
  "SuitHexAspect",
  "SuitMarkCritAspect",
  "TorchAutofireAspect",
  "TorchDetonateAspect",
  "TorchSpecialDurationAspect",
  "TorchSprintRecallAspect",
] as const;

const syntheticBoonIds = [
  "ApolloWeaponBoon",
  "ApolloSpecialBoon",
  "ApolloCastBoon",
  "ApolloSprintBoon",
  "ApolloManaBoon",
] as const;

const expectedBoonPrioritySlots = [
  "attack",
  "special",
  "cast",
  "sprint",
  "omega",
] as const;

function boonPrioritySlot(
  id: string,
): (typeof expectedBoonPrioritySlots)[number] | null {
  if (/WeaponBoon$/u.test(id)) return "attack";
  if (/SpecialBoon$/u.test(id)) return "special";
  if (/CastBoon$|Cast.*Boon$/u.test(id)) return "cast";
  if (/SprintBoon$|Sprint.*Boon$/u.test(id)) return "sprint";
  if (/ManaBoon$|Mana.*Boon$/u.test(id)) return "omega";
  return null;
}

function olympianGod(id: string): string | null {
  return (
    /^(Aphrodite|Apollo|Ares|Demeter|Hephaestus|Hera|Hestia|Poseidon|Zeus)/u.exec(
      id,
    )?.[1] ?? null
  );
}

function syntheticCombinedDataset(): CombinedDataset {
  return {
    schema: "neodes2-dataset-1",
    source: {
      acquisitionId: "sha256:source",
      sourceManifestSha256: "source-manifest",
      exporterVersion: "0.1.0",
      steamBuildId: "build",
      executableVersion: "executable",
      packageVersion: "package",
    },
    domainAcquisitionIds: {
      arcana: "a",
      boons: "b",
      guide: "g",
      loadouts: "l",
      weapons: "w",
    },
    domains: {
      arcana: {
        schema: "neodes2-arcana-1",
        source: {} as never,
        unlockModel: {} as never,
        layout: [],
        grasp: {} as never,
        cards: [{ id: "BonusHealth", name: "Card", graspCost: 1 } as never],
      },
      boons: {
        schema: "neodes2-boons-2",
        source: {} as never,
        gods: [
          {
            id: "ApolloUpgrade",
            name: "Apollo",
            boonIds: [
              ...syntheticBoonIds,
              "CompatibleLegendaryBoon",
              "ImpossibleDuoBoon",
            ],
            evidence: [],
          },
          {
            id: "DemeterUpgrade",
            name: "Demeter",
            boonIds: ["DemeterWeaponBoon", "ImpossibleDuoBoon"],
            evidence: [],
          },
        ],
        boons: [
          ...syntheticBoonIds.map((id) => ({
            id,
            name: `${id} name`,
            description: `${id} description.`,
            godIds: ["ApolloUpgrade"],
            kind: "normal",
            elements: [],
            rarityBehavior: {},
            levelScaling: [],
            prerequisites: null,
            effects: {},
            evidence: [],
          })),
          {
            id: "DemeterWeaponBoon",
            name: "Fallback Attack boon",
            description: "Your fallback Attack deals more damage.",
            godIds: ["DemeterUpgrade"],
            kind: "normal",
            elements: [],
            rarityBehavior: {},
            levelScaling: [],
            prerequisites: null,
            effects: {},
            evidence: [],
          },
          {
            id: "ImpossibleDuoBoon",
            name: "Impossible same-slot Duo",
            description: "Requires two mutually exclusive Attack boons.",
            godIds: ["ApolloUpgrade", "DemeterUpgrade"],
            kind: "duo",
            elements: [],
            rarityBehavior: {},
            levelScaling: [],
            prerequisites: {
              OneFromEachSet: [["ApolloWeaponBoon"], ["DemeterWeaponBoon"]],
              Type: "OneFromEachSet",
            },
            effects: {},
            evidence: [],
          },
          {
            id: "CompatibleLegendaryBoon",
            name: "Compatible different-slot Legendary",
            description: "Requires compatible Attack and Special boons.",
            godIds: ["ApolloUpgrade"],
            kind: "legendary",
            elements: [],
            rarityBehavior: {},
            levelScaling: [],
            prerequisites: {
              OneFromEachSet: [["ApolloWeaponBoon"], ["ApolloSpecialBoon"]],
              Type: "OneFromEachSet",
            },
            effects: {},
            evidence: [],
          },
        ] as never,
      },
      guide: {
        schema: "neodes2-guide-data-2",
        source: {} as never,
        routes: [],
        regions: [],
        rooms: [],
        encounters: [],
        enemies: [],
        rewards: [],
        consumables: [],
        resources: [
          {
            id: "Resource",
            displayName: "Resource",
            useReferences: ["Use"],
            acquisitionReferences: [],
          } as never,
        ],
        statusElements: [],
        oathConditions: [],
        bounties: [],
        bountyOrder: [],
        relationships: [],
        prophecies: [],
        narrative: [],
        outros: [],
        outroPriorities: [],
        achievements: [
          {
            id: "Achievement",
            displayName: "Achievement",
            description: "",
            hidden: false,
          } as never,
        ],
        namedRequirements: [],
        runClearMessages: [],
        gatheringTools: [],
        fish: [],
        cultivation: [],
        marketOffers: [],
        runRewards: [],
        openingStates: [],
        godAppearances: [],
        encounterFriends: [],
        encounterAids: [],
        encounterAidEffects: [],
        strifeCurses: [],
        surfacePenalties: [],
        gardenPlotCount: 0,
      },
      loadouts: {
        schema: "neodes2-loadouts-2",
        source: {} as never,
        keepsakes: [
          {
            id: "ForceApolloBoonKeepsake",
            displayName: "God",
            relationshipId: "ApolloUpgrade",
            relationshipName: "Apollo",
            mechanics: { RarityUpgradeData: { Uses: 1 } },
          },
          {
            id: "BossPreDamageKeepsake",
            displayName: "Boss",
            relationshipName: "Odysseus",
          },
          {
            id: "ReincarnationKeepsake",
            displayName: "Life",
            relationshipName: "Schelemeus",
          },
        ] as never,
        familiars: [{ id: "FrogFamiliar", displayName: "Familiar" }] as never,
        hexes: [{ id: "TimeSlow", displayName: "Hex" }] as never,
        incantations: [],
        automaticWorldUpgradeIds: [],
        incantationRevealPolicy: { maxNewRevealsPerRun: 3, categories: [] },
        spellTalentConfiguration: {},
      },
      weapons: {
        schema: "neodes2-weapons-1",
        source: {} as never,
        weapons: [{ id: "Weapon", name: "Weapon" }] as never,
        aspects: [
          { id: "Aspect", weaponId: "Weapon", name: "Aspect of Test" },
        ] as never,
        hammers: [
          {
            id: "Hammer",
            weaponId: "Weapon",
            name: "Hammer",
            description: "Your Attack is stronger.",
            compatibility: {
              allowedAspectIds: ["Aspect"],
              excludedAspectIds: [],
              requiredAspectIds: [],
              incompatibleHammerIds: [],
            },
          },
        ] as never,
      },
    },
  };
}

const syntheticProfile: AspectProfile = {
  aspectId: "Aspect",
  focuses: ["attack"],
  boonPriorityOrder: ["cast", "attack", "special", "sprint", "omega"],
  beginnerDifficulty: 2,
  rankOneEvaluation: "Works at rank one.",
  maximumRankEvaluation: "Scales at maximum rank.",
  strengths: ["Clear strength."],
  weaknesses: ["Clear limitation."],
  combatSequence: ["Use the sequence."],
  arcanaIds: ["BonusHealth"],
  primaryBoonIds: syntheticBoonIds,
  fallbackBoonIds: [...syntheticBoonIds, "DemeterWeaponBoon"],
  boonReasons: {},
  familiarId: "FrogFamiliar",
  hexId: "TimeSlow",
  contextRatings: {
    consistency: "A",
    speed: "B",
    safety: "A",
    "high-fear": "B",
  },
  bossConsideration: "Use safe boss openings.",
  routeConsideration: "Use the same plan on either route.",
  safest: {
    focuses: ["attack"],
    boonPriorityOrder: ["cast", "attack", "special", "sprint", "omega"],
    strengths: ["Clear safe strength."],
    weaknesses: ["Clear safe limitation."],
    combatSequence: ["Use the safe sequence."],
    arcanaIds: ["BonusHealth"],
    primaryBoonIds: syntheticBoonIds,
    fallbackBoonIds: [...syntheticBoonIds, "DemeterWeaponBoon"],
    boonReasons: {},
    familiarId: "FrogFamiliar",
    hexId: "TimeSlow",
    contextRatings: {
      consistency: "A",
      speed: "B",
      safety: "A",
      "high-fear": "B",
    },
    bossConsideration: "Use safe boss openings.",
    routeConsideration: "Use the same safe plan on either route.",
  },
};

const syntheticStage: ProgressionStageSource = {
  id: "stage",
  order: 1,
  title: "Stage",
  endpoint: "first-route-clear",
  spoilerLevel: "progression",
  readerKnowledge: ["Know the loop."],
  nextObjective: "Complete the next objective.",
  reason: "It advances progression.",
  actionSequence: [
    "Choose a goal.",
    "Equip a build.",
    "Enter the route.",
    "Complete the objective.",
    "Review the result.",
  ],
  purchaseUpgradePriorities: ["Buy the next upgrade."],
  resourcePolicy: ["Fund the next target."],
  loadoutReferences: [
    { recordType: "mechanics/weapon", id: "Weapon" },
    { recordType: "mechanics/weapon-aspect", id: "Aspect" },
    { recordType: "mechanics/arcana-card", id: "BonusHealth" },
    { recordType: "mechanics/keepsake", id: "ReincarnationKeepsake" },
    { recordType: "mechanics/familiar", id: "FrogFamiliar" },
    { recordType: "mechanics/hex", id: "TimeSlow" },
  ],
  priorityReferences: [
    {
      order: 1,
      timing: "now",
      required: true,
      reference: { recordType: "mechanics/weapon", id: "Weapon" },
      reason: "Use the available weapon for the stage objective.",
    },
  ],
  boonEncounterPriorities: ["Fill the core slot."],
  parallelObjectiveReferences: [],
  routeLateGame: ["Use either route."],
  completionChecklist: ["Confirm completion."],
  completionReferences: [
    { recordType: "world-progression/achievement", id: "Achievement" },
  ],
  fallback: "Use the safe fallback.",
};

describe("Phase 7 editorial content", () => {
  it("covers all approved progression endpoints and weapon aspects with original project prose", () => {
    assert.deepEqual(
      progressionStages.map((stage) => stage.endpoint),
      [
        "first-route-clear",
        "main-story",
        "true-ending",
        "practical-postgame",
        "exhaustive-completion",
      ],
    );
    assert.deepEqual(
      aspectProfiles.map((profile) => profile.aspectId).sort(),
      [...expectedAspectIds].sort(),
    );
    assert.equal(
      new Set(aspectProfiles.map((profile) => profile.aspectId)).size,
      24,
    );
    for (const profile of aspectProfiles) {
      for (const [goal, plan] of [
        ["strongest", profile],
        ["safest", profile.safest],
      ] as const) {
        const label = `${profile.aspectId} ${goal}`;
        assert.equal(plan.boonPriorityOrder.length, 5, label);
        assert.deepEqual(
          new Set(plan.boonPriorityOrder),
          new Set(expectedBoonPrioritySlots),
          label,
        );
        for (const slot of expectedBoonPrioritySlots) {
          assert.ok(
            plan.primaryBoonIds.some((id) => boonPrioritySlot(id) === slot),
            `${label} has no preferred ${slot} Boon`,
          );
          assert.ok(
            plan.fallbackBoonIds.some((id) => boonPrioritySlot(id) === slot),
            `${label} has no fallback ${slot} Boon`,
          );
        }
        assert.equal(
          boonPrioritySlot(plan.primaryBoonIds[0] ?? ""),
          plan.boonPriorityOrder[0],
          `${label} does not open with its first priority`,
        );
        assert.equal(
          new Set(plan.primaryBoonIds).size,
          plan.primaryBoonIds.length,
          `${label} repeats a preferred Boon`,
        );
        assert.equal(
          new Set(plan.fallbackBoonIds).size,
          plan.fallbackBoonIds.length,
          `${label} repeats a fallback Boon`,
        );
        assert.ok(
          plan.primaryBoonIds.every((id) => !plan.fallbackBoonIds.includes(id)),
          `${label} uses the same Boon as preferred and fallback`,
        );
        const preferredPackage = plan.boonPriorityOrder.map((slot) =>
          plan.primaryBoonIds.find((id) => boonPrioritySlot(id) === slot),
        );
        const preferredGods = preferredPackage.map((id) =>
          olympianGod(id ?? ""),
        );
        assert.ok(
          preferredGods.every((god) => god !== null),
          `${label} has a preferred core Boon without an Olympian`,
        );
        assert.ok(
          new Set(preferredGods).size <= 4,
          `${label} needs more than four Olympians for its preferred package`,
        );
      }
      const strongestCore = profile.boonPriorityOrder
        .map((slot) =>
          profile.primaryBoonIds.find((id) => boonPrioritySlot(id) === slot),
        )
        .sort();
      const safestCore = profile.safest.boonPriorityOrder
        .map((slot) =>
          profile.safest.primaryBoonIds.find(
            (id) => boonPrioritySlot(id) === slot,
          ),
        )
        .sort();
      assert.notDeepEqual(
        safestCore,
        strongestCore,
        `${profile.aspectId} safest and strongest builds use the same core Boons`,
      );
    }

    const plan = (aspectId: string, goal: "strongest" | "safest") => {
      const profile = aspectProfiles.find(
        (candidate) => candidate.aspectId === aspectId,
      );
      assert.ok(profile, `Missing ${aspectId} profile`);
      return goal === "strongest" ? profile : profile.safest;
    };
    for (const [aspectId, goal, forbiddenBoon] of [
      ["BaseStaffAspect", "strongest", "AphroditeSpecialBoon"],
      ["StaffRaiseDeadAspect", "strongest", "AphroditeSpecialBoon"],
      ["LobAmmoBoostAspect", "strongest", "AphroditeWeaponBoon"],
      ["LobAmmoBoostAspect", "safest", "AphroditeWeaponBoon"],
      ["TorchDetonateAspect", "strongest", "AphroditeWeaponBoon"],
    ] as const) {
      const selected = plan(aspectId, goal);
      assert.ok(
        !selected.primaryBoonIds.includes(forbiddenBoon) &&
          !selected.fallbackBoonIds.includes(forbiddenBoon),
        `${aspectId} ${goal} recommends proximity-only ${forbiddenBoon} for a ranged move`,
      );
    }
    assert.ok(
      plan("TorchSpecialDurationAspect", "strongest").primaryBoonIds.includes(
        "AphroditeSpecialBoon",
      ),
      "orbiting Torch Specials should retain the valid nearby-damage option",
    );
    assert.equal(familiarProfiles.length, 5);
    assert.equal(hexProfiles.length, 9);
    assert.equal(arcanaProfiles.length, 25);
    assert.equal(new Set(arcanaProfiles.map((profile) => profile.id)).size, 25);
    assert.equal(pageDefinitions.length, 24);
    assert.equal(Object.keys(preferredHammersByAspect).length, 24);
    assert.ok(
      Object.values(preferredHammersByAspect).every(
        (ids) => ids.length === 3 && new Set(ids).size === 3,
      ),
    );
    assert.ok(
      pageDefinitions.some(
        (page) =>
          page.id === "reference/arcana" &&
          page.aliases.includes("tarot cards"),
      ),
    );
    for (const stage of progressionStages) {
      assert.ok(stage.actionSequence.length >= 5);
      assert.deepEqual(
        new Set(stage.loadoutReferences.map((entry) => entry.recordType)),
        new Set([
          "mechanics/weapon",
          "mechanics/weapon-aspect",
          "mechanics/arcana-card",
          "mechanics/keepsake",
          "mechanics/familiar",
          "mechanics/hex",
        ]),
      );
    }
    assert.doesNotMatch(
      JSON.stringify({ progressionStages, aspectProfiles }),
      /\{[$#!]/u,
    );
  });

  it("uses the full runtime Attack string for the strongest base Sister Blades plan", () => {
    const rawString = [20, 20, ...Array<number>(5).fill(15), 90];
    const rawStringDamage = rawString.reduce((total, hit) => total + hit, 0);
    const levelOneFlutterBonus = rawStringDamage * 0.8;
    const levelOneWaveBonus = rawString.length * 20;
    const levelFourFlutterBonus = rawStringDamage * 1.3;
    const levelFourWaveBonus = rawString.length * 35;
    const profile = aspectProfiles.find(
      (candidate) => candidate.aspectId === "DaggerBackstabAspect",
    );

    assert.equal(rawStringDamage, 205);
    assert.equal(levelOneFlutterBonus, 164);
    assert.equal(levelOneWaveBonus, 160);
    assert.equal(levelFourFlutterBonus, 266.5);
    assert.equal(levelFourWaveBonus, 280);
    assert.ok(levelOneFlutterBonus > levelOneWaveBonus);
    assert.ok(levelFourWaveBonus > levelFourFlutterBonus);
    assert.ok(profile);
    assert.equal(profile.primaryBoonIds[0], "PoseidonWeaponBoon");
    assert.equal(profile.fallbackBoonIds[0], "AphroditeWeaponBoon");
    assert.match(profile.boonReasons.PoseidonWeaponBoon ?? "", /205 raw/u);
    assert.match(
      profile.boonReasons.PoseidonWeaponBoon ?? "",
      /level 4.*280.*266\.5/u,
    );
    assert.match(profile.boonReasons.AphroditeWeaponBoon ?? "", /four more/u);
  });

  it("compiles context-complete records and reports complete page, alias, and reference coverage", () => {
    const result = compileEditorialDataset(
      syntheticCombinedDataset(),
      {
        datasetAcquisitionId: "sha256:dataset",
        datasetSha256: "dataset-sha",
        dataReadyAcquisitionId: "sha256:data-ready",
        verificationAcquisitionId: "sha256:verification",
      },
      [syntheticProfile],
      [syntheticStage],
    );
    assert.equal(result.report.complete, true, JSON.stringify(result.report));
    assert.deepEqual(result.report.missingReferences, []);
    assert.deepEqual(result.report.missingAliases, []);
    assert.deepEqual(result.report.orphanRecordIds, []);
    assert.deepEqual(result.report.requiredPagesWithoutEditorialCoverage, []);
    assert.deepEqual(result.report.invalidEditorialRecords, []);
    assert.deepEqual(result.report.counts, {
      progressionStages: 1,
      pageDefinitions: 24,
      weaponGuides: 1,
      aspectGuides: 1,
      boonRatings: 8,
      arcanaRatings: 1,
      familiarRatings: 1,
      hexRatings: 1,
      keepsakePriorities: 3,
      resourceAdvice: 1,
      searchAliases: 10,
    });
    assert.equal(
      result.dataset.aspectGuides[0]?.boonPriorities[0]?.preferred[0]?.rating,
      "S",
    );
    assert.deepEqual(
      result.dataset.aspectGuides[0]?.boonPriorities.map((entry) => entry.slot),
      syntheticProfile.boonPriorityOrder,
    );
    assert.deepEqual(
      Object.keys(result.dataset.aspectGuides[0]?.buildVariants ?? {}).sort(),
      ["safest", "strongest"],
    );
    for (const variant of Object.values(
      result.dataset.aspectGuides[0]?.buildVariants ?? {},
    )) {
      assert.equal(variant.boonPriorities.length, 5);
      assert.deepEqual(
        new Set(variant.boonPriorities.map((entry) => entry.slot)),
        new Set(expectedBoonPrioritySlots),
      );
      assert.ok(
        variant.boonPriorities.every(
          (entry) => entry.preferred.length > 0 && entry.fallback.length > 0,
        ),
      );
      assert.ok(
        variant.boonPriorities.every((entry) =>
          [...entry.preferred, ...entry.fallback].every(
            (recommendation) =>
              !/optional\s+\w+\s+slot/iu.test(recommendation.reason),
          ),
        ),
      );
    }
    assert.equal(result.dataset.aspectGuides[0]?.boonRankings.length, 8);
    assert.equal(result.dataset.aspectGuides[0]?.boonRankings[0]?.rating, "S");
    assert.deepEqual(
      result.dataset.aspectGuides[0]?.duoLegendaryTargets.map(
        (target) => target.reference.id,
      ),
      ["CompatibleLegendaryBoon"],
    );
    assert.deepEqual(
      result.dataset.aspectGuides[0]?.duoLegendaryTargets[0]?.requirementGroups,
      [
        [{ recordType: "mechanics/boon", id: "ApolloWeaponBoon" }],
        [{ recordType: "mechanics/boon", id: "ApolloSpecialBoon" }],
      ],
    );
    assert.deepEqual(
      result.dataset.aspectGuides[0]?.duoLegendaryTargets[0]
        ?.selectedPrerequisites,
      [
        { recordType: "mechanics/boon", id: "ApolloWeaponBoon" },
        { recordType: "mechanics/boon", id: "ApolloSpecialBoon" },
      ],
    );
    assert.equal(
      result.dataset.aspectGuides[0]?.duoLegendaryTargets[0]
        ?.requirementSummary,
      "Choose one Boon from each of 2 prerequisite groups.",
    );
    assert.deepEqual(
      result.dataset.aspectGuides[0]?.powerBreakpoints.map(
        (breakpoint) => breakpoint.stage,
      ),
      ["foundation", "online", "power-spike"],
    );
    assert.ok(
      Object.values(result.dataset.aspectGuides[0]?.buildVariants ?? {}).every(
        (variant) =>
          variant.powerBreakpoints.length >= 2 &&
          variant.powerBreakpoints.some(
            (breakpoint) => breakpoint.stage === "online",
          ) &&
          new Set(
            variant.powerBreakpoints.map(
              (breakpoint) =>
                `${breakpoint.condition}|${JSON.stringify(breakpoint.references)}`,
            ),
          ).size === variant.powerBreakpoints.length,
      ),
    );
    assert.equal(result.dataset.aspectGuides[0]?.familiarHex[0]?.rating, "S");
    assert.equal(result.dataset.aspectGuides[0]?.overallRating, "B");
    assert.ok(
      result.dataset.aspectGuides[0]?.rankEvaluations.every(
        (entry) => entry.reason.length > 0 && entry.limitation.length > 0,
      ),
    );
    assert.ok(
      result.dataset.aspectGuides[0]?.contextRatings.every(
        (entry) => entry.reason.length > 0 && entry.limitation.length > 0,
      ),
    );
    assert.equal(result.dataset.aspectGuides[0]?.arcanaGraspCost, 1);
    assert.equal(
      result.dataset.aspectGuides[0]?.arcanaLoadout[0]?.role,
      "core",
    );
    assert.ok(
      result.dataset.aspectGuides[0]?.arcanaLoadout.every(
        (entry) => entry.reason.length > 0 && entry.limitation.length > 0,
      ),
    );
    assert.ok(
      result.dataset.aspectGuides[0]?.boonRankings.every(
        (entry) => entry.reason.length > 0 && entry.limitation.length > 0,
      ),
    );
    assert.ok(
      result.dataset.aspectGuides[0]?.familiarHex.every(
        (entry) => entry.reason.length > 0 && entry.limitation.length > 0,
      ),
    );
    assert.deepEqual(
      result.dataset.aspectGuides[0]?.keepsakeRoute.map((entry) => entry.stage),
      ["opening", "later-region", "final-region"],
    );
    assert.ok(
      result.dataset.aspectGuides[0]?.keepsakeRoute.every(
        (entry) =>
          entry.lifecycle === "persistent" ||
          entry.switchCondition.includes("next keepsake cabinet"),
      ),
    );
    assert.deepEqual(result.dataset.aspectGuides[0]?.buildInteractions, []);
    assert.deepEqual(
      result.dataset.aspectGuides[0]?.rewardPriorities.map(
        (entry) => entry.reward,
      ),
      [
        "core-boon",
        "hammer",
        "maximum-life",
        "pom",
        "magick-recovery",
        "duo-legendary",
      ],
    );
    assert.ok(
      result.dataset.aspectGuides[0]?.rewardDecisionRules.some(
        (entry) => entry.choose === "permanent-resource",
      ),
    );
    assert.equal(
      result.dataset.aspectGuides[0]?.keepsakeRoute[0]?.stage,
      "opening",
    );
    assert.equal(result.dataset.weaponGuides[0]?.boonRankings.length, 8);
    assert.ok(result.dataset.weaponGuides[0]?.overallReason.length);
    assert.ok(
      result.dataset.weaponGuides[0]?.contextRatings.every(
        (entry) => entry.reason.length > 0 && entry.limitation.length > 0,
      ),
    );
    assert.ok(
      result.dataset.weaponGuides[0]?.boonRankings.every(
        (entry) => entry.reason.length > 0 && entry.limitation.length > 0,
      ),
    );
    assert.equal(
      result.dataset.weaponGuides[0]?.boonRankings[0]?.reason,
      "This Boon directly supports the core move used by at least one of this weapon’s recommended aspect plans.",
    );
    assert.equal(
      result.dataset.arcanaRatings[0]?.evaluationDimension,
      "new-player-value",
    );
    assert.doesNotMatch(
      result.dataset.arcanaRatings[0]?.reason ?? "",
      /^Selected by /,
    );
    assert.ok(
      result.dataset.keepsakePriorities.every(
        (entry) => entry.switchWhenInactive.length > 0,
      ),
    );
    const godKeepsake = result.dataset.keepsakePriorities.find(
      (entry) => entry.id === "ForceApolloBoonKeepsake",
    );
    assert.match(godKeepsake?.limitation ?? "", /separate benefits/u);
    assert.match(godKeepsake?.recommendation ?? "", /specific Apollo boon/u);
    assert.doesNotMatch(JSON.stringify(godKeepsake), /ApolloUpgrade/u);
    assert.match(
      godKeepsake?.switchWhenInactive ?? "",
      /Rarify charge is spent/u,
    );
    assert.match(godKeepsake?.reason ?? "", /improve one Common Apollo boon/u);
    assert.match(
      result.dataset.aspectGuides[0]?.keepsakeRoute[0]?.switchCondition ?? "",
      /Rarify charge is spent/u,
    );
    assert.equal(result.dataset.resourceAdvice[0]?.priority, "C");
    assert.equal(
      result.dataset.resourceAdvice[0]?.earliestRecommendedStage,
      "unprioritized",
    );
    assert.ok(
      result.dataset.pageDefinitions.some(
        (page) =>
          page.id === "reference/arcana" &&
          page.aliases.includes("tarot cards"),
      ),
    );
  });

  it("rejects a progression stage that omits a complete loadout or ordered actions", () => {
    const incompleteStage: ProgressionStageSource = {
      ...syntheticStage,
      actionSequence: ["Only one action."],
      loadoutReferences: syntheticStage.loadoutReferences.filter(
        (entry) => entry.recordType !== "mechanics/weapon",
      ),
    };
    const result = compileEditorialDataset(
      syntheticCombinedDataset(),
      {
        datasetAcquisitionId: "sha256:dataset",
        datasetSha256: "dataset-sha",
        dataReadyAcquisitionId: "sha256:data-ready",
        verificationAcquisitionId: "sha256:verification",
      },
      [syntheticProfile],
      [incompleteStage],
    );
    assert.equal(result.report.complete, false);
    assert.deepEqual(result.report.invalidEditorialRecords, [
      "editorial/progression-stage:stage",
    ]);
  });

  it("rejects a weapon guide without one ranking for every Boon", () => {
    const combined = syntheticCombinedDataset();
    const compiled = compileEditorialDataset(
      combined,
      {
        datasetAcquisitionId: "sha256:dataset",
        datasetSha256: "dataset-sha",
        dataReadyAcquisitionId: "sha256:data-ready",
        verificationAcquisitionId: "sha256:verification",
      },
      [syntheticProfile],
      [syntheticStage],
    );
    const weaponGuide = compiled.dataset.weaponGuides[0];
    assert.ok(weaponGuide);
    const report = createContentReport(
      {
        ...compiled.dataset,
        weaponGuides: [{ ...weaponGuide, boonRankings: [] }],
      },
      combined,
      [syntheticStage],
    );
    assert.equal(report.complete, false);
    assert.deepEqual(report.invalidEditorialRecords, [
      "editorial/weapon-guide:Weapon",
    ]);
  });

  it("rejects an aspect guide without every boon ranking", () => {
    const combined = syntheticCombinedDataset();
    const compiled = compileEditorialDataset(
      combined,
      {
        datasetAcquisitionId: "sha256:dataset",
        datasetSha256: "dataset-sha",
        dataReadyAcquisitionId: "sha256:data-ready",
        verificationAcquisitionId: "sha256:verification",
      },
      [syntheticProfile],
      [syntheticStage],
    );
    const aspectGuide = compiled.dataset.aspectGuides[0];
    assert.ok(aspectGuide);
    const report = createContentReport(
      {
        ...compiled.dataset,
        aspectGuides: [
          {
            ...aspectGuide,
            boonRankings: [],
          },
        ],
      },
      combined,
      [syntheticStage],
    );
    assert.equal(report.complete, false);
    assert.deepEqual(report.invalidEditorialRecords, [
      "editorial/aspect-guide:Aspect",
    ]);
  });

  it("rejects an aspect guide without all five unique boon slots", () => {
    const combined = syntheticCombinedDataset();
    const compiled = compileEditorialDataset(
      combined,
      {
        datasetAcquisitionId: "sha256:dataset",
        datasetSha256: "dataset-sha",
        dataReadyAcquisitionId: "sha256:data-ready",
        verificationAcquisitionId: "sha256:verification",
      },
      [syntheticProfile],
      [syntheticStage],
    );
    const aspectGuide = compiled.dataset.aspectGuides[0];
    assert.ok(aspectGuide);
    const report = createContentReport(
      {
        ...compiled.dataset,
        aspectGuides: [
          {
            ...aspectGuide,
            boonPriorities: aspectGuide.boonPriorities.slice(0, 4),
          },
        ],
      },
      combined,
      [syntheticStage],
    );
    assert.equal(report.complete, false);
    assert.deepEqual(report.invalidEditorialRecords, [
      "editorial/aspect-guide:Aspect",
    ]);
  });

  it("rejects a safest build variant without all five complete boon slots", () => {
    const combined = syntheticCombinedDataset();
    const compiled = compileEditorialDataset(
      combined,
      {
        datasetAcquisitionId: "sha256:dataset",
        datasetSha256: "dataset-sha",
        dataReadyAcquisitionId: "sha256:data-ready",
        verificationAcquisitionId: "sha256:verification",
      },
      [syntheticProfile],
      [syntheticStage],
    );
    const aspectGuide = compiled.dataset.aspectGuides[0];
    assert.ok(aspectGuide);
    const report = createContentReport(
      {
        ...compiled.dataset,
        aspectGuides: [
          {
            ...aspectGuide,
            buildVariants: {
              ...aspectGuide.buildVariants,
              safest: {
                ...aspectGuide.buildVariants.safest,
                boonPriorities:
                  aspectGuide.buildVariants.safest.boonPriorities.slice(0, 4),
              },
            },
          },
        ],
      },
      combined,
      [syntheticStage],
    );
    assert.equal(report.complete, false);
    assert.deepEqual(report.invalidEditorialRecords, [
      "editorial/aspect-guide:Aspect",
    ]);
  });

  it("rejects a boon slot without a preferred first choice", () => {
    const combined = syntheticCombinedDataset();
    const compiled = compileEditorialDataset(
      combined,
      {
        datasetAcquisitionId: "sha256:dataset",
        datasetSha256: "dataset-sha",
        dataReadyAcquisitionId: "sha256:data-ready",
        verificationAcquisitionId: "sha256:verification",
      },
      [syntheticProfile],
      [syntheticStage],
    );
    const aspectGuide = compiled.dataset.aspectGuides[0];
    assert.ok(aspectGuide);
    const report = createContentReport(
      {
        ...compiled.dataset,
        aspectGuides: [
          {
            ...aspectGuide,
            boonPriorities: aspectGuide.boonPriorities.map((priority, index) =>
              index === 0 ? { ...priority, preferred: [] } : priority,
            ),
          },
        ],
      },
      combined,
      [syntheticStage],
    );
    assert.equal(report.complete, false);
    assert.deepEqual(report.invalidEditorialRecords, [
      "editorial/aspect-guide:Aspect",
    ]);
  });

  it("rejects an aspect guide without reasons, limitations, interactions, decisions, Grasp accounting, keepsake switches, and reward order", () => {
    const combined = syntheticCombinedDataset();
    const compiled = compileEditorialDataset(
      combined,
      {
        datasetAcquisitionId: "sha256:dataset",
        datasetSha256: "dataset-sha",
        dataReadyAcquisitionId: "sha256:data-ready",
        verificationAcquisitionId: "sha256:verification",
      },
      [syntheticProfile],
      [syntheticStage],
    );
    const aspectGuide = compiled.dataset.aspectGuides[0];
    assert.ok(aspectGuide);
    const report = createContentReport(
      {
        ...compiled.dataset,
        aspectGuides: [
          {
            ...aspectGuide,
            overallReason: "",
            arcanaGraspCost: 0,
            keepsakeRoute: aspectGuide.keepsakeRoute.map((entry) => ({
              ...entry,
              switchCondition: "",
            })),
            rewardPriorities: aspectGuide.rewardPriorities.slice(1),
            buildInteractions: [],
            rewardDecisionRules: [],
            boonRankings: aspectGuide.boonRankings.map((entry) => ({
              ...entry,
              limitation: "",
            })),
            contextRatings: aspectGuide.contextRatings.map((entry) => ({
              ...entry,
              reason: "",
              limitation: "",
            })),
          },
        ],
      },
      combined,
      [syntheticStage],
    );
    assert.equal(report.complete, false);
    assert.deepEqual(report.invalidEditorialRecords, [
      "editorial/aspect-guide:Aspect",
    ]);
  });
});
