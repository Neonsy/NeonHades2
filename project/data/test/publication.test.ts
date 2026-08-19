import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  compilePublicationDataset,
  createPublicationAllowlist,
  createPublicationReport,
  type CombinedDataset,
  type EditorialDataset,
  type JsonObject,
} from "../src/index.js";

function combinedDataset(weaponId = "Weapon"): CombinedDataset {
  const guideRecord = (id: string, displayName = id, data: JsonObject = {}) => ({
    id, displayName, description: `${displayName} description.`, data, omissions: [], evidence: { runtimePath: "internal", localizationPath: "internal" },
  });
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
        grasp: { startingCapacity: 10 } as never,
        cards: [{
          id: "Card", name: "Card", description: "{#UpgradeFormat}{$Keywords.Attack} gains {$TooltipData.StatDisplay1}{!Icons.Health}.", graspCost: 1, ranks: [], rankEffects: [], unlockCosts: [],
          unlock: { GameStateRequirements: { RequiredTextLines: ["StoryFlag"] } }, autoActivationRequirements: null,
        } as never],
      },
      boons: {
        schema: "neodes2-boons-2",
        source: {} as never,
        gods: [{ id: "God", name: "God", boonIds: ["Boon"], evidence: [] }],
        boons: [{
          id: "Boon", name: "Boon", description: "Boon description.", godIds: ["God"], kind: "normal", elements: [],
          rarityBehavior: {}, levelScaling: [], prerequisites: null, effects: {}, evidence: [],
        }],
      },
      guide: {
        schema: "neodes2-guide-data-1",
        source: {} as never,
        routes: [],
        regions: [{ id: "Region", displayName: "Region", routeId: "Route", routeOrder: 1, roomIds: [], evidence: {} as never }],
        rooms: [],
        encounters: [{ ...guideRecord("Encounter"), classification: "combat", regionIds: ["Region"], enemyIds: ["Enemy"], rewardIds: [] }],
        enemies: [{ ...guideRecord("Enemy"), classifications: ["ordinary"], regionIds: ["Region"] }],
        rewards: [], consumables: [],
        resources: [{ ...guideRecord("Resource", "Enemy"), acquisitionReferences: [], useReferences: [] }],
        statusElements: [guideRecord("Status")],
        oathConditions: [guideRecord("Oath")],
        bounties: [guideRecord("Bounty")], bountyOrder: ["Bounty"],
        relationships: [guideRecord("Relationship")],
        prophecies: [guideRecord("Prophecy")],
        narrative: [guideRecord("Narrative")],
        outros: [], outroPriorities: [],
        achievements: [{ ...guideRecord("Achievement"), displayName: "Achievement", description: "Achievement description.", hidden: false }],
        namedRequirements: [], runClearMessages: [],
      },
      loadouts: {
        schema: "neodes2-loadouts-1",
        source: {} as never,
        keepsakes: [{
          id: "Keepsake", displayName: "Keepsake", relationshipId: "Relationship", relationshipName: "Relationship",
          acquisitionRequirements: null, chamberThresholds: [], description: "Keepsake description.", mechanics: {}, naturalRanks: [], rankEffects: [], temporaryBonusRank: null,
        } as never],
        familiars: [{ id: "Familiar", displayName: "Familiar", description: "Familiar description.", mechanics: {}, unlockRequirements: null, upgrades: [] } as never],
        hexes: [{ id: "Hex", displayName: "Hex", description: "Hex description.", baseEffects: {}, availabilityRequirements: null, talents: [] } as never],
        incantations: [{ id: "Incantation", displayName: "Incantation", description: "Incantation description.", unlockRequirements: null, costs: [], effects: {}, automaticUnlock: false } as never],
        automaticWorldUpgradeIds: [], spellTalentConfiguration: {},
      },
      weapons: {
        schema: "neodes2-weapons-1",
        source: {} as never,
        weapons: [{ id: "Weapon", name: "Weapon", description: "Weapon description.", evidence: [] } as never],
        aspects: [{ id: "Aspect", weaponId, name: "Aspect", description: "Aspect description.", ranks: [], rankEffects: [], mechanics: {} } as never],
        hammers: [{
          id: "Hammer", weaponId: "Weapon", name: "Hammer", description: "Hammer description.", effects: {}, mechanics: {}, requirements: null,
          compatibility: { allowedAspectIds: ["Aspect"], excludedAspectIds: [], requiredAspectIds: [], incompatibleHammerIds: [] },
        } as never],
      },
    },
  };
}

function editorialDataset(): EditorialDataset {
  return {
    schema: "neodes2-editorial-1",
    source: {
      datasetAcquisitionId: "sha256:dataset",
      datasetSha256: "dataset-sha",
      dataReadyAcquisitionId: "sha256:data-ready",
      verificationAcquisitionId: "sha256:verification",
      steamBuildId: "build",
      executableVersion: "executable",
      packageVersion: "package",
    },
    progressionStages: [], weaponGuides: [], aspectGuides: [], boonRatings: [], arcanaRatings: [], familiarRatings: [], hexRatings: [],
    keepsakePriorities: [], resourceAdvice: [],
    pageDefinitions: [
      { id: "reference/weapons", pageKind: "reference", title: "Weapons", sourceRecordTypes: ["mechanics/weapon", "mechanics/weapon-aspect"], aliases: ["arms"], spoilerLevel: "none" },
      { id: "reference/boons", pageKind: "reference", title: "Boons", sourceRecordTypes: ["mechanics/god", "mechanics/boon"], aliases: ["blessings"], spoilerLevel: "none" },
    ],
    searchAliases: [{ recordType: "foundation/record-metadata", id: "Weapon", subjectReference: { recordType: "mechanics/weapon", id: "Weapon" }, aliases: ["nocturnal arm"] }],
  };
}

const identity = {
  datasetAcquisitionId: "sha256:dataset",
  datasetSha256: "dataset-sha",
  dataReadyAcquisitionId: "sha256:data-ready",
  editorialAcquisitionId: "sha256:editorial",
} as const;

describe("Phase 8 publication compiler", () => {
  it("builds allowlisted pages, search entries, conditions, and matching relationship indexes", () => {
    const allowlist = createPublicationAllowlist();
    const first = compilePublicationDataset(combinedDataset(), editorialDataset(), allowlist, identity);
    const second = compilePublicationDataset(combinedDataset(), editorialDataset(), allowlist, identity);
    assert.equal(first.report.complete, true, JSON.stringify(first.report));
    assert.deepEqual(first, second);
    assert.equal(first.dataset.pages.find((page) => page.id === "reference/weapons")?.recordKeys.length, 2);
    assert.ok(first.dataset.search.some((entry) => entry.normalizedTerm === "nocturnal arm" && entry.recordKey === "mechanics/weapon:Weapon"));
    assert.ok(first.dataset.relationships.forward.some((edge) => edge.sourceKey === "mechanics/weapon-aspect:Aspect" && edge.targetKey === "mechanics/weapon:Weapon"));
    assert.ok(first.dataset.relationships.reverse.some((edge) => edge.sourceKey === "mechanics/weapon:Weapon" && edge.targetKey === "mechanics/weapon-aspect:Aspect"));
    assert.ok(first.dataset.relationships.forward.every((edge) => !edge.sourceKey.startsWith("foundation/record-metadata:")));
    assert.ok(first.dataset.relationships.forward.every((edge) => edge.sourceKey !== "mechanics/resource:Resource" || edge.targetKey !== "world-progression/enemy:Enemy"));
    assert.ok(first.dataset.conditions.some((condition) => condition.dependentRecordKeys.includes("mechanics/arcana-card:Card")));
    assert.ok(first.dataset.records.every((record) => record.fields.every((field) => allowlist.allowedFields.some((allowed) => allowed.id === field.id))));
    assert.doesNotMatch(JSON.stringify(first.dataset), /runtimePath|localizationPath|evidence|TooltipData|Icons|\{#/u);
    assert.match(JSON.stringify(first.dataset), /Attack gains \[value 1\] \[Health\]\./u);
  });

  it("rejects an unresolved explicit record relationship", () => {
    const result = compilePublicationDataset(combinedDataset("MissingWeapon"), editorialDataset(), createPublicationAllowlist(), identity);
    assert.equal(result.report.complete, false);
    assert.ok(result.report.unresolvedReferences.some((issue) => issue.includes("mechanics/weapon:MissingWeapon")));
  });

  it("reports forbidden payload keys and a missing reverse relationship", () => {
    const allowlist = createPublicationAllowlist();
    const compiled = compilePublicationDataset(combinedDataset(), editorialDataset(), allowlist, identity);
    const record = compiled.dataset.records.find((entry) => entry.recordType === "mechanics/boon");
    assert.ok(record);
    const report = createPublicationReport({
      ...compiled.dataset,
      records: compiled.dataset.records.map((entry) => entry.key === record.key ? {
        ...entry,
        fields: entry.fields.slice(1).map((field, index) => index === 0 ? { ...field, value: { runtimePath: "private" } } : field),
      } : entry),
      pages: compiled.dataset.pages.map((page, index) => index === 0 ? { ...page, recordKeys: [...page.recordKeys, "mechanics/weapon:Missing"] } : page),
      relationships: { ...compiled.dataset.relationships, reverse: compiled.dataset.relationships.reverse.slice(1) },
    }, allowlist);
    assert.equal(report.complete, false);
    assert.ok(report.missingAllowedFieldIds.length > 0);
    assert.ok(report.forbiddenPayloadPaths.length > 0);
    assert.ok(report.unresolvedReferences.some((issue) => issue.includes("page:") && issue.includes("mechanics/weapon:Missing")));
    assert.ok(report.incompleteReverseRelationships.length > 0);
  });
});
