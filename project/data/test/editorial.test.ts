import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  aspectProfiles,
  compileEditorialDataset,
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
  purchaseUpgradePriorities: ["Buy the next upgrade."],
  resourcePolicy: ["Fund the next target."],
  loadoutReferences: [{ recordType: "mechanics/weapon-aspect", id: "Aspect" }],
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
    assert.doesNotMatch(JSON.stringify({ progressionStages, aspectProfiles }), /\{[$#!]/u);
  });

  it("compiles context-complete records and reports complete page, alias, and reference coverage", () => {
    const result = compileEditorialDataset(syntheticCombinedDataset(), {
      datasetAcquisitionId: "sha256:dataset",
      datasetSha256: "dataset-sha",
      dataReadyAcquisitionId: "sha256:data-ready",
      verificationAcquisitionId: "sha256:verification",
    }, [syntheticProfile], [syntheticStage]);
    assert.equal(result.report.complete, true);
    assert.deepEqual(result.report.missingReferences, []);
    assert.deepEqual(result.report.missingAliases, []);
    assert.deepEqual(result.report.orphanRecordIds, []);
    assert.deepEqual(result.report.requiredPagesWithoutEditorialCoverage, []);
    assert.deepEqual(result.report.invalidEditorialRecords, []);
    assert.deepEqual(result.report.counts, {
      progressionStages: 1,
      aspectGuides: 1,
      boonRatings: 1,
      keepsakePriorities: 3,
      resourceAdvice: 1,
      searchAliases: 5,
    });
    assert.equal(result.dataset.aspectGuides[0]?.boonPriorities[0]?.preferred[0]?.rating, "A");
    assert.equal(result.dataset.aspectGuides[0]?.keepsakeRoute[0]?.stage, "opening");
  });
});
