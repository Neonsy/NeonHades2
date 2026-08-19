import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  createCombinedDataset,
  readCombinedDataset,
  validateNormalizedDomains,
  type DatasetDomainName,
  type DatasetValidationIssue,
  type NormalizedDomains,
  type RuntimeGuideRecord,
} from "../src/index.js";
import { jsonBytes, sha256 } from "../src/boons/runtime-acquisition.js";

const source = {
  acquisitionId: "sha256:source-acquisition",
  exporterVersion: "1.0.0",
  steamBuildId: "100",
  executableVersion: "200",
  packageVersion: "300",
} as const;

function guideRecord(id: string, displayName = id): RuntimeGuideRecord {
  return {
    id,
    displayName,
    description: `${displayName} description`,
    data: {},
    omissions: [],
    evidence: { runtimePath: `Synthetic.${id}`, localizationPath: `Synthetic.${id}` },
  };
}

function normalizedDomains(): NormalizedDomains {
  const evidence = { localizationPath: "Synthetic.en", runtimePaths: ["Synthetic"] };
  const sampleEvidence: readonly string[] = ["Synthetic"];
  return {
    boons: {
      schema: "neodes2-boons-2",
      source,
      gods: [{ id: "God", name: "God", boonIds: ["Boon"], evidence: sampleEvidence }],
      boons: [{
        id: "Boon", name: "Boon", description: "Boon description", godIds: ["God"],
        kind: "normal", elements: [], rarityBehavior: {}, levelScaling: [], prerequisites: null,
        effects: {}, evidence: sampleEvidence,
      }],
    },
    weapons: {
      schema: "neodes2-weapons-1",
      source,
      weapons: [{
        id: "Weapon", name: "Weapon", description: "Weapon description",
        unlockCosts: [{ resourceId: "Resource", amount: 1 }], unlockRequirements: null,
        linkedWeaponIds: ["Weapon"], linkedIdsWithoutWeaponData: [], weaponDataIds: ["Weapon"],
        weaponData: { Name: "Weapon" }, evidence: sampleEvidence,
      }],
      aspects: [{
        id: "Aspect", weaponId: "Weapon", name: "Aspect", description: "Aspect description",
        baseAspect: true,
        ranks: [{ rank: 1, rarity: "Common", shopItemId: null, costs: [], requirements: null, runtimePath: "Synthetic.Aspect" }],
        rankEffects: [], mechanics: {}, evidence: sampleEvidence,
      }],
      hammers: [{
        id: "Hammer", weaponId: "Weapon", name: "Hammer", description: "Hammer description",
        requirements: null,
        compatibility: { allowedAspectIds: ["Aspect"], excludedAspectIds: [], requiredAspectIds: [], incompatibleHammerIds: [] },
        effects: [], mechanics: {}, evidence: sampleEvidence,
      }],
    },
    arcana: {
      schema: "neodes2-arcana-1",
      source,
      unlockModel: { kind: "orthogonal-adjacency", startingCardId: "Card", layoutMutableAfterUnlock: true },
      layout: [{ row: 1, column: 1, cardId: "Card" }],
      grasp: {
        id: "Grasp", displayName: "Grasp", description: "Grasp description", startingCapacity: 0,
        levels: [{ level: 1, capacityIncrease: 1, cumulativeCapacity: 1, costs: [] }], evidence,
      },
      cards: [{
        id: "Card", row: 1, column: 1, name: "Card", description: "Card description",
        traitId: "CardTrait", type: null, graspCost: 1, unlockCosts: [],
        ranks: [{ rank: 1, rarity: "Common", upgradeFromPreviousCosts: [], runtimePath: "Synthetic.Card" }],
        rankEffects: [], autoActivationRequirements: {}, autoActivationText: null, relatedCardIds: [],
        unlock: { initiallyRevealable: true, adjacentCardIds: [] }, mechanics: {}, evidence: sampleEvidence,
      }],
    },
    loadouts: {
      schema: "neodes2-loadouts-1",
      source,
      keepsakes: [{
        id: "Keepsake", displayName: "Keepsake", description: "Keepsake description",
        relationshipId: "Relationship", relationshipName: "Relationship", acquisitionRequirements: null,
        chamberThresholds: [10, 20, 30], naturalRanks: ["Common", "Rare", "Epic"], temporaryBonusRank: null,
        mechanics: {}, rankEffects: [], evidence,
      }],
      familiars: [{
        id: "Familiar", displayName: "Familiar", description: "Familiar description",
        unlockRequirements: null, mechanics: {}, evidence,
        upgrades: [{
          id: "FamiliarUpgrade", displayName: "Familiar Upgrade", description: "Upgrade description",
          traitId: "FamiliarTrait", mechanics: {}, rankEffects: [], evidence,
          ranks: [{ rank: 1, itemId: "FamiliarItem", costs: [], requirements: null, runtimePath: "Synthetic.Familiar" }],
        }],
      }],
      hexes: [{
        id: "Hex", traitId: "HexTrait", displayName: "Hex", description: "Hex description",
        availabilityRequirements: null, spellData: {}, mechanics: {}, baseEffects: [], evidence,
        talents: [{
          id: "HexTalent", category: "Unique", displayName: "Hex Talent", description: "Talent description",
          mechanics: {}, effects: [], evidence,
        }],
      }],
      incantations: [{
        id: "Incantation", displayName: "Incantation", description: "Incantation description",
        automaticUnlock: false, costs: [{ resourceId: "Resource", amount: 1 }],
        unlockRequirements: null, effects: { Enabled: true }, evidence,
      }],
      automaticWorldUpgradeIds: [],
      spellTalentConfiguration: {},
    },
    guide: {
      schema: "neodes2-guide-data-1",
      source,
      routes: [{ id: "route", regionIds: ["Region"] }],
      regions: [{
        id: "Region", displayName: "Region", routeId: "route", routeOrder: 1, roomIds: ["Room"],
        evidence: { runtimePath: "Synthetic.Region", localizationPath: "Synthetic.Region" },
      }],
      rooms: [{ ...guideRecord("Room"), regionId: "Region", encounterIds: ["Encounter"], rewardIds: ["Resource"] }],
      encounters: [{
        ...guideRecord("Encounter"), classification: "default", regionIds: ["Region"],
        enemyIds: ["Enemy"], rewardIds: ["Resource"],
      }],
      enemies: [{ ...guideRecord("Enemy"), classifications: ["enemy"], regionIds: ["Region"] }],
      rewards: [guideRecord("Reward")],
      consumables: [guideRecord("Consumable")],
      resources: [{ ...guideRecord("Resource"), acquisitionReferences: ["Synthetic"], useReferences: ["Synthetic"] }],
      statusElements: [guideRecord("Status")],
      oathConditions: [guideRecord("Oath")],
      bounties: [guideRecord("Bounty")],
      bountyOrder: ["Bounty"],
      relationships: [guideRecord("Relationship")],
      prophecies: [guideRecord("Prophecy")],
      narrative: [guideRecord("Narrative")],
      outros: [guideRecord("Outro")],
      outroPriorities: ["Outro"],
      achievements: [{ ...guideRecord("Achievement"), displayName: "Achievement", description: "Achievement description", hidden: false }],
      namedRequirements: [guideRecord("Requirement")],
      runClearMessages: [guideRecord("RunClear")],
    },
  };
}

const acquisitionConfig = {
  arcana: ["neodes2-arcana-acquisition-manifest-1", "neodes2-arcana-acquisition-completion-1", "neodes2-arcana-coverage-1", "arcana.json"],
  boons: ["neodes2-boon-acquisition-manifest-2", "neodes2-boon-acquisition-completion-2", "neodes2-boon-coverage-2", "boons.json"],
  guide: ["neodes2-guide-acquisition-manifest-1", "neodes2-guide-acquisition-completion-1", "neodes2-guide-coverage-1", "guide.json"],
  loadouts: ["neodes2-loadout-acquisition-manifest-1", "neodes2-loadout-acquisition-completion-1", "neodes2-loadout-coverage-1", "loadouts.json"],
  weapons: ["neodes2-weapon-acquisition-manifest-1", "neodes2-weapon-acquisition-completion-1", "neodes2-weapon-coverage-1", "weapons.json"],
} as const;

const counts = {
  arcana: { cards: 1, ranks: 1, automaticCards: 0, graspLevels: 1, maximumGrasp: 1 },
  boons: { gods: 1, boons: 1 },
  guide: {
    routes: 1, regions: 1, rooms: 1, encounters: 1, enemies: 1, rewards: 1, resources: 1,
    statusElements: 1, oathConditions: 1, bounties: 1, relationships: 1, prophecies: 1,
    narrative: 1, outros: 1, achievements: 1, namedRequirements: 1,
  },
  loadouts: {
    keepsakes: 1, familiars: 1, familiarUpgradeTracks: 1, familiarUpgradeRanks: 1,
    hexes: 1, hexTalents: 1, incantations: 1, automaticIncantations: 0,
  },
  weapons: { weapons: 1, aspects: 1, ranks: 1, hammers: 1 },
} as const;

async function writeAcquisition(
  root: string,
  domain: DatasetDomainName,
  dataset: NormalizedDomains[DatasetDomainName],
  sourceAcquisitionId: string = source.acquisitionId,
): Promise<string> {
  const directory = join(root, domain);
  await mkdir(directory, { recursive: true });
  const [manifestSchema, completionSchema, coverageSchema, datasetFile] = acquisitionConfig[domain];
  const runtimeContent = jsonBytes({ schema: `synthetic-${domain}-runtime` });
  const datasetContent = jsonBytes(dataset);
  const coverageContent = jsonBytes({ schema: coverageSchema, issues: [], complete: true });
  const coverageMarkdown = Buffer.from("complete\n", "utf8");
  const identity = {
    schema: manifestSchema,
    sourceAcquisitionId,
    sourceManifestSha256: "source-manifest-hash",
    runtimeReportSha256: sha256(runtimeContent),
    normalizedDatasetSha256: sha256(datasetContent),
    coverageReportSha256: sha256(coverageContent),
    coverageMarkdownSha256: sha256(coverageMarkdown),
    exporterVersion: source.exporterVersion,
    game: {
      steamBuildId: source.steamBuildId,
      executableVersion: source.executableVersion,
      packageVersion: source.packageVersion,
    },
    counts: counts[domain],
    coverageComplete: true,
  };
  const acquisitionId = `sha256:${sha256(JSON.stringify(identity))}`;
  const manifestContent = jsonBytes({ ...identity, acquisitionId });
  await Promise.all([
    writeFile(join(directory, "runtime-report.json"), runtimeContent),
    writeFile(join(directory, datasetFile), datasetContent),
    writeFile(join(directory, "coverage.json"), coverageContent),
    writeFile(join(directory, "coverage.md"), coverageMarkdown),
    writeFile(join(directory, "manifest.json"), manifestContent),
    writeFile(join(directory, "complete.json"), jsonBytes({
      schema: completionSchema,
      acquisitionId,
      manifestSha256: sha256(manifestContent),
    })),
  ]);
  return directory;
}

async function fixture(): Promise<{
  readonly root: string;
  readonly acquisitions: Readonly<Record<DatasetDomainName, string>>;
  readonly domains: NormalizedDomains;
}> {
  const root = await mkdtemp(join(tmpdir(), "neodes2-dataset-"));
  const domains = normalizedDomains();
  const acquisitions = Object.fromEntries(await Promise.all(
    (["arcana", "boons", "guide", "loadouts", "weapons"] as const).map(async (domain) => [
      domain,
      await writeAcquisition(root, domain, domains[domain]),
    ]),
  )) as Readonly<Record<DatasetDomainName, string>>;
  return { root, acquisitions, domains };
}

describe("combined dataset", () => {
  it("builds the same content identity from the same completed domain acquisitions", async () => {
    const setup = await fixture();
    try {
      const outputRoot = join(setup.root, ".local", "datasets");
      const first = await createCombinedDataset({ acquisitions: setup.acquisitions, outputRoot, now: () => new Date("2026-08-19T00:00:00Z") });
      const second = await createCombinedDataset({ acquisitions: setup.acquisitions, outputRoot, now: () => new Date("2026-08-20T00:00:00Z") });
      assert.equal(first.acquisitionId, second.acquisitionId);
      assert.equal(first.datasetSha256, second.datasetSha256);
      assert.equal(first.validation.complete, true);
      const dataset = JSON.parse(await readFile(join(first.directory, "dataset.json"), "utf8")) as { schema: string };
      assert.equal(dataset.schema, "neodes2-dataset-1");
      const verified = await readCombinedDataset(first.directory);
      assert.equal(verified.acquisitionId, first.acquisitionId);
      assert.equal(verified.datasetSha256, first.datasetSha256);
      assert.deepEqual(verified.dataset.domains, setup.domains);
    } finally {
      await rm(setup.root, { recursive: true, force: true });
    }
  });

  it("rejects a combined dataset whose contents no longer match its manifest", async () => {
    const setup = await fixture();
    try {
      const built = await createCombinedDataset({ acquisitions: setup.acquisitions, outputRoot: join(setup.root, ".local", "datasets") });
      await writeFile(join(built.directory, "validation.json"), jsonBytes({
        schema: "neodes2-dataset-validation-1",
        sourceAcquisitionId: source.acquisitionId,
        domainRecordCounts: {},
        issues: [],
        complete: true,
      }));
      await assert.rejects(readCombinedDataset(built.directory), /validationSha256 does not match/u);
    } finally {
      await rm(setup.root, { recursive: true, force: true });
    }
  });

  it("rejects a normalized file that no longer matches its manifest", async () => {
    const setup = await fixture();
    try {
      await writeFile(join(setup.acquisitions.boons, "boons.json"), jsonBytes({ changed: true }));
      await assert.rejects(
        createCombinedDataset({ acquisitions: setup.acquisitions, outputRoot: join(setup.root, ".local", "datasets") }),
        /normalizedDatasetSha256 does not match/u,
      );
    } finally {
      await rm(setup.root, { recursive: true, force: true });
    }
  });

  it("rejects mixed source acquisitions", async () => {
    const setup = await fixture();
    try {
      const mixedGuide = {
        ...setup.domains.guide,
        source: { ...setup.domains.guide.source, acquisitionId: "sha256:other-source" },
      };
      const guide = await writeAcquisition(setup.root, "guide", mixedGuide, "sha256:other-source");
      const acquisitions = { ...setup.acquisitions, guide };
      await assert.rejects(
        createCombinedDataset({ acquisitions, outputRoot: join(setup.root, ".local", "datasets") }),
        /guide acquisitionId differs from the other domain acquisitions/u,
      );
    } finally {
      await rm(setup.root, { recursive: true, force: true });
    }
  });

  it("reports dangling references and excluded presentation data", () => {
    const domains = normalizedDomains();
    const invalid: NormalizedDomains = {
      ...domains,
      guide: {
        ...domains.guide,
        routes: [{ id: "route", regionIds: ["MissingRegion"] }],
        namedRequirements: [{ ...guideRecord("Requirement"), data: { Cue: "/VO/Synthetic" } }],
      },
    };
    const report = validateNormalizedDomains(invalid);
    assert.equal(report.complete, false);
    assert.ok(report.issues.some((entry) => entry.code === "reference"));
    assert.ok(report.issues.some((entry) => entry.code === "presentation-data"));
  });

  it("reports duplicate IDs, missing names, invalid costs and ranges, empty collections, and unknown enums", () => {
    const invalid = JSON.parse(JSON.stringify(normalizedDomains())) as NormalizedDomains;
    const mutable = invalid as unknown as {
      boons: { gods: { id: string; name: string }[]; boons: { id: string }[] };
      weapons: { weapons: { unlockCosts: { resourceId: string; amount: number }[] }[] };
      arcana: { layout: { row: number }[]; cards: { type: string | null }[] };
      guide: { runClearMessages: unknown[] };
    };
    mutable.boons.gods[0]!.name = "";
    mutable.boons.boons.push({ ...mutable.boons.boons[0]! });
    mutable.weapons.weapons[0]!.unlockCosts[0]!.amount = -1;
    mutable.arcana.layout[0]!.row = 0;
    mutable.arcana.cards[0]!.type = "UnknownType";
    mutable.guide.runClearMessages = [];

    const codes = new Set(validateNormalizedDomains(invalid).issues.map((entry) => entry.code));
    const expectedCodes: readonly DatasetValidationIssue["code"][] = [
      "duplicate-id", "empty-collection", "invalid-cost", "invalid-range", "missing-name", "unknown-enum",
    ];
    for (const expected of expectedCodes) {
      assert.ok(codes.has(expected), `Expected ${expected} validation issue.`);
    }
  });
});
