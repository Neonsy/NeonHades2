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
    domainAcquisitionIds: { arcana: "a", boons: "b", guide: "g", loadouts: "l", weapons: "w" },
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
        gods: [{ id: "ApolloUpgrade", name: "Apollo", boonIds: ["ApolloWeaponBoon"], evidence: [] }],
        boons: [{
          id: "ApolloWeaponBoon",
          name: "Attack boon",
          description: "",
          godIds: ["ApolloUpgrade"],
          kind: "normal",
          elements: [],
          rarityBehavior: {},
          levelScaling: [],
          prerequisites: null,
          effects: {},
          evidence: [],
        }],
      },
      guide: {
        schema: "neodes2-guide-data-1",
        source: {} as never,
        routes: [], regions: [], rooms: [], encounters: [], enemies: [], rewards: [], consumables: [],
        resources: [{ id: "Resource", displayName: "Resource", useReferences: ["Use"], acquisitionReferences: [] } as never],
        statusElements: [], oathConditions: [], bounties: [], bountyOrder: [], relationships: [], prophecies: [], narrative: [], outros: [],
        outroPriorities: [],
        achievements: [{ id: "Achievement", displayName: "Achievement", description: "", hidden: false } as never],
        namedRequirements: [], runClearMessages: [],
      },
      loadouts: {
        schema: "neodes2-loadouts-1",
        source: {} as never,
        keepsakes: [
          { id: "ForceApolloBoonKeepsake", displayName: "God", relationshipName: "Apollo" },
          { id: "BossPreDamageKeepsake", displayName: "Boss", relationshipName: "Odysseus" },
          { id: "ReincarnationKeepsake", displayName: "Life", relationshipName: "Schelemeus" },
        ] as never,
        familiars: [{ id: "FrogFamiliar", displayName: "Familiar" }] as never,
        hexes: [{ id: "TimeSlow", displayName: "Hex" }] as never,
        incantations: [],
        automaticWorldUpgradeIds: [],
        spellTalentConfiguration: {},
      },
      weapons: {
        schema: "neodes2-weapons-1",
        source: {} as never,
        weapons: [{ id: "Weapon", name: "Weapon" }] as never,
        aspects: [{ id: "Aspect", weaponId: "Weapon", name: "Aspect of Test" }] as never,
        hammers: [{
          id: "Hammer",
          weaponId: "Weapon",
          name: "Hammer",
          description: "Your Attack is stronger.",
          compatibility: { allowedAspectIds: ["Aspect"], excludedAspectIds: [], requiredAspectIds: [], incompatibleHammerIds: [] },
        }] as never,
      },
    },
  };
}

const syntheticProfile: AspectProfile = {
  aspectId: "Aspect",
  focuses: ["attack"],
  beginnerDifficulty: 2,
  rankOneEvaluation: "Works at rank one.",
  maximumRankEvaluation: "Scales at maximum rank.",
  strengths: ["Clear strength."],
  weaknesses: ["Clear limitation."],
  combatSequence: ["Use the sequence."],
  arcanaIds: ["BonusHealth"],
  primaryBoonIds: ["ApolloWeaponBoon"],
  fallbackBoonIds: ["ApolloWeaponBoon"],
  familiarId: "FrogFamiliar",
  hexId: "TimeSlow",
  contextRatings: { consistency: "A", speed: "B", safety: "A", "high-fear": "B" },
  bossConsideration: "Use safe boss openings.",
  routeConsideration: "Use the same plan on either route.",
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
  actionSequence: ["Choose a goal.", "Equip a build.", "Enter the route.", "Complete the objective.", "Review the result."],
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
  priorityReferences: [{
    order: 1,
    timing: "now",
    required: true,
    reference: { recordType: "mechanics/weapon", id: "Weapon" },
    reason: "Use the available weapon for the stage objective.",
  }],
  boonEncounterPriorities: ["Fill the core slot."],
  parallelObjectiveReferences: [],
  routeLateGame: ["Use either route."],
  completionChecklist: ["Confirm completion."],
  completionReferences: [{ recordType: "world-progression/achievement", id: "Achievement" }],
  fallback: "Use the safe fallback.",
};

describe("Phase 7 editorial content", () => {
  it("covers all approved progression endpoints and weapon aspects with original project prose", () => {
    assert.deepEqual(progressionStages.map((stage) => stage.endpoint), [
      "first-route-clear",
      "main-story",
      "true-ending",
      "practical-postgame",
      "exhaustive-completion",
    ]);
    assert.deepEqual(aspectProfiles.map((profile) => profile.aspectId).sort(), [...expectedAspectIds].sort());
    assert.equal(new Set(aspectProfiles.map((profile) => profile.aspectId)).size, 24);
    assert.equal(familiarProfiles.length, 5);
    assert.equal(hexProfiles.length, 9);
    assert.equal(arcanaProfiles.length, 25);
    assert.equal(new Set(arcanaProfiles.map((profile) => profile.id)).size, 25);
    assert.equal(pageDefinitions.length, 24);
    assert.equal(Object.keys(preferredHammersByAspect).length, 24);
    assert.ok(Object.values(preferredHammersByAspect).every((ids) => ids.length === 3 && new Set(ids).size === 3));
    assert.ok(pageDefinitions.some((page) => page.id === "reference/arcana" && page.aliases.includes("tarot cards")));
    for (const stage of progressionStages) {
      assert.ok(stage.actionSequence.length >= 5);
      assert.deepEqual(
        new Set(stage.loadoutReferences.map((entry) => entry.recordType)),
        new Set(["mechanics/weapon", "mechanics/weapon-aspect", "mechanics/arcana-card", "mechanics/keepsake", "mechanics/familiar", "mechanics/hex"]),
      );
    }
    assert.doesNotMatch(JSON.stringify({ progressionStages, aspectProfiles }), /\{[$#!]/u);
  });

  it("compiles context-complete records and reports complete page, alias, and reference coverage", () => {
    const result = compileEditorialDataset(syntheticCombinedDataset(), {
      datasetAcquisitionId: "sha256:dataset",
      datasetSha256: "dataset-sha",
      dataReadyAcquisitionId: "sha256:data-ready",
      verificationAcquisitionId: "sha256:verification",
    }, [syntheticProfile], [syntheticStage]);
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
      boonRatings: 1,
      arcanaRatings: 1,
      familiarRatings: 1,
      hexRatings: 1,
      keepsakePriorities: 3,
      resourceAdvice: 1,
      searchAliases: 5,
    });
    assert.equal(result.dataset.aspectGuides[0]?.boonPriorities[0]?.preferred[0]?.rating, "A");
    assert.deepEqual(result.dataset.aspectGuides[0]?.boonPriorities.map((entry) => entry.slot), ["attack", "special", "cast", "sprint", "omega"]);
    assert.equal(result.dataset.aspectGuides[0]?.boonRankings.length, 1);
    assert.equal(result.dataset.aspectGuides[0]?.boonRankings[0]?.rating, "S");
    assert.equal(result.dataset.aspectGuides[0]?.familiarHex[0]?.rating, "S");
    assert.equal(result.dataset.aspectGuides[0]?.overallRating, "A");
    assert.ok(result.dataset.aspectGuides[0]?.rankEvaluations.every((entry) => entry.reason.length > 0 && entry.limitation.length > 0));
    assert.ok(result.dataset.aspectGuides[0]?.contextRatings.every((entry) => entry.reason.length > 0 && entry.limitation.length > 0));
    assert.equal(result.dataset.aspectGuides[0]?.arcanaGraspCost, 1);
    assert.equal(result.dataset.aspectGuides[0]?.arcanaLoadout[0]?.role, "core");
    assert.ok(result.dataset.aspectGuides[0]?.arcanaLoadout.every((entry) => entry.reason.length > 0 && entry.limitation.length > 0));
    assert.ok(result.dataset.aspectGuides[0]?.boonRankings.every((entry) => entry.reason.length > 0 && entry.limitation.length > 0));
    assert.ok(result.dataset.aspectGuides[0]?.familiarHex.every((entry) => entry.reason.length > 0 && entry.limitation.length > 0));
    assert.deepEqual(result.dataset.aspectGuides[0]?.keepsakeRoute.map((entry) => entry.stage), ["opening", "later-region", "final-region", "fallback"]);
    assert.ok(result.dataset.aspectGuides[0]?.keepsakeRoute.every((entry) => entry.lifecycle === "persistent" || entry.switchCondition.includes("next keepsake cabinet")));
    assert.ok((result.dataset.aspectGuides[0]?.buildInteractions.length ?? 0) >= 3);
    assert.ok(result.dataset.aspectGuides[0]?.buildInteractions.some((entry) => entry.kind === "synergy"));
    assert.deepEqual(result.dataset.aspectGuides[0]?.rewardPriorities.map((entry) => entry.reward), ["core-boon", "hammer", "maximum-life", "pom", "magick-recovery", "duo-legendary"]);
    assert.ok(result.dataset.aspectGuides[0]?.rewardDecisionRules.some((entry) => entry.choose === "permanent-resource"));
    assert.equal(result.dataset.aspectGuides[0]?.keepsakeRoute[0]?.stage, "opening");
    assert.equal(result.dataset.weaponGuides[0]?.boonRankings.length, 1);
    assert.ok(result.dataset.weaponGuides[0]?.overallReason.length);
    assert.ok(result.dataset.weaponGuides[0]?.contextRatings.every((entry) => entry.reason.length > 0 && entry.limitation.length > 0));
    assert.ok(result.dataset.weaponGuides[0]?.boonRankings.every((entry) => entry.reason.length > 0 && entry.limitation.length > 0));
    assert.equal(result.dataset.weaponGuides[0]?.boonRankings[0]?.reason, "Preferred by 1 of 1 aspect guides for this weapon.");
    assert.equal(result.dataset.arcanaRatings[0]?.evaluationDimension, "new-player-value");
    assert.doesNotMatch(result.dataset.arcanaRatings[0]?.reason ?? "", /^Selected by /);
    assert.ok(result.dataset.keepsakePriorities.every((entry) => entry.switchWhenInactive.length > 0));
    assert.equal(result.dataset.resourceAdvice[0]?.priority, "C");
    assert.equal(result.dataset.resourceAdvice[0]?.earliestRecommendedStage, "unprioritized");
    assert.ok(result.dataset.pageDefinitions.some((page) => page.id === "reference/arcana" && page.aliases.includes("tarot cards")));
  });

  it("rejects a progression stage that omits a complete loadout or ordered actions", () => {
    const incompleteStage: ProgressionStageSource = {
      ...syntheticStage,
      actionSequence: ["Only one action."],
      loadoutReferences: syntheticStage.loadoutReferences.filter((entry) => entry.recordType !== "mechanics/weapon"),
    };
    const result = compileEditorialDataset(syntheticCombinedDataset(), {
      datasetAcquisitionId: "sha256:dataset",
      datasetSha256: "dataset-sha",
      dataReadyAcquisitionId: "sha256:data-ready",
      verificationAcquisitionId: "sha256:verification",
    }, [syntheticProfile], [incompleteStage]);
    assert.equal(result.report.complete, false);
    assert.deepEqual(result.report.invalidEditorialRecords, ["editorial/progression-stage:stage"]);
  });

  it("rejects a weapon guide without one ranking for every Boon", () => {
    const combined = syntheticCombinedDataset();
    const compiled = compileEditorialDataset(combined, {
      datasetAcquisitionId: "sha256:dataset",
      datasetSha256: "dataset-sha",
      dataReadyAcquisitionId: "sha256:data-ready",
      verificationAcquisitionId: "sha256:verification",
    }, [syntheticProfile], [syntheticStage]);
    const weaponGuide = compiled.dataset.weaponGuides[0];
    assert.ok(weaponGuide);
    const report = createContentReport({
      ...compiled.dataset,
      weaponGuides: [{ ...weaponGuide, boonRankings: [] }],
    }, combined, [syntheticStage]);
    assert.equal(report.complete, false);
    assert.deepEqual(report.invalidEditorialRecords, ["editorial/weapon-guide:Weapon"]);
  });

  it("rejects an aspect guide without every boon ranking and all five boon slots", () => {
    const combined = syntheticCombinedDataset();
    const compiled = compileEditorialDataset(combined, {
      datasetAcquisitionId: "sha256:dataset",
      datasetSha256: "dataset-sha",
      dataReadyAcquisitionId: "sha256:data-ready",
      verificationAcquisitionId: "sha256:verification",
    }, [syntheticProfile], [syntheticStage]);
    const aspectGuide = compiled.dataset.aspectGuides[0];
    assert.ok(aspectGuide);
    const report = createContentReport({
      ...compiled.dataset,
      aspectGuides: [{ ...aspectGuide, boonRankings: [], boonPriorities: aspectGuide.boonPriorities.slice(0, 1) }],
    }, combined, [syntheticStage]);
    assert.equal(report.complete, false);
    assert.deepEqual(report.invalidEditorialRecords, ["editorial/aspect-guide:Aspect"]);
  });

  it("rejects an aspect guide without reasons, limitations, interactions, decisions, Grasp accounting, keepsake switches, and reward order", () => {
    const combined = syntheticCombinedDataset();
    const compiled = compileEditorialDataset(combined, {
      datasetAcquisitionId: "sha256:dataset",
      datasetSha256: "dataset-sha",
      dataReadyAcquisitionId: "sha256:data-ready",
      verificationAcquisitionId: "sha256:verification",
    }, [syntheticProfile], [syntheticStage]);
    const aspectGuide = compiled.dataset.aspectGuides[0];
    assert.ok(aspectGuide);
    const report = createContentReport({
      ...compiled.dataset,
      aspectGuides: [{
        ...aspectGuide,
        overallReason: "",
        arcanaGraspCost: 0,
        keepsakeRoute: aspectGuide.keepsakeRoute.map((entry) => ({ ...entry, switchCondition: "" })),
        rewardPriorities: aspectGuide.rewardPriorities.slice(1),
        buildInteractions: [],
        rewardDecisionRules: [],
        boonRankings: aspectGuide.boonRankings.map((entry) => ({ ...entry, limitation: "" })),
        contextRatings: aspectGuide.contextRatings.map((entry) => ({ ...entry, reason: "", limitation: "" })),
      }],
    }, combined, [syntheticStage]);
    assert.equal(report.complete, false);
    assert.deepEqual(report.invalidEditorialRecords, ["editorial/aspect-guide:Aspect"]);
  });
});
