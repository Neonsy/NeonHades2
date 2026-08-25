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
import {
  publicRequirements,
  readableRequirementExpression,
} from "../src/publication/readable-conditions.js";

function combinedDataset(weaponId = "Weapon"): CombinedDataset {
  const guideRecord = (
    id: string,
    displayName = id,
    data: JsonObject = {},
  ) => ({
    id,
    displayName,
    description: `${displayName} description.`,
    data,
    omissions: [],
    evidence: { runtimePath: "internal", localizationPath: "internal" },
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
        grasp: { startingCapacity: 10, levels: [] } as never,
        cards: [
          {
            id: "Card",
            name: "Card",
            description:
              "{#UpgradeFormat}{$Keywords.Attack} gains {$TooltipData.StatDisplay1}{!Icons.Health}.",
            graspCost: 1,
            ranks: [],
            mechanics: { ExtractValues: [{ ExtractAs: "Power" }] },
            rankEffects: [
              {
                rarity: "Common",
                level: 1,
                result: {
                  status: "ok",
                  values: [{ id: "Power", resolution: { value: 25 } }],
                },
              },
            ],
            unlockCosts: [],
            unlock: {
              GameStateRequirements: {
                RequiredTextLines: ["HecateBossGrantsCodex01"],
              },
            },
            autoActivationRequirements: null,
          } as never,
        ],
      },
      boons: {
        schema: "neodes2-boons-2",
        source: {} as never,
        gods: [{ id: "God", name: "God", boonIds: ["Boon"], evidence: [] }],
        boons: [
          {
            id: "Boon",
            name: "Boon",
            description: "Boon description.",
            godIds: ["God"],
            kind: "normal",
            elements: [],
            rarityBehavior: {},
            levelScaling: [],
            prerequisites: null,
            effects: {},
            evidence: [],
          },
        ],
      },
      guide: {
        schema: "neodes2-guide-data-2",
        source: {} as never,
        routes: [],
        regions: [
          {
            id: "Region",
            displayName: "Region",
            routeId: "Route",
            routeOrder: 1,
            roomIds: [],
            evidence: {} as never,
          },
        ],
        rooms: [],
        encounters: [
          {
            ...guideRecord("Encounter"),
            classification: "combat",
            regionIds: ["Region"],
            enemyIds: ["Enemy", "Enemy_Elite"],
            rewardIds: [],
          },
        ],
        enemies: [
          {
            ...guideRecord("Enemy", "Enemy", {
              MaxHealth: 900,
              AIAggroRange: 600,
              CanBeFrozen: true,
              WeaponOptions: ["EnemyRush", "EnemySlam"],
            }),
            classifications: ["ordinary"],
            regionIds: ["Region"],
          },
          {
            ...guideRecord("Enemy_Elite", "Enemy", {
              MaxHealth: 1_200,
              WeaponOptions: ["Enemy_EliteRush"],
            }),
            classifications: ["ordinary", "elite"],
            regionIds: ["Region"],
          },
        ],
        rewards: [],
        consumables: [],
        resources: [
          {
            ...guideRecord("Resource", "Enemy"),
            acquisitionReferences: [],
            useReferences: [],
          },
        ],
        statusElements: [guideRecord("Status")],
        oathConditions: [
          guideRecord("EnemyDamageShrineUpgrade", "Vow of Blood", {
            Ranks: [
              { ChangeValue: 1.2, Points: 1 },
              { ChangeValue: 1.6, Points: 2 },
              { ChangeValue: 2, Points: 3 },
            ],
          }),
        ],
        bounties: [guideRecord("Bounty")],
        bountyOrder: ["Bounty"],
        relationships: [
          guideRecord("Relationship", "Relationship", {
            Maximum: 8,
            Locked: 5,
            "1": {
              Gift: "Keepsake",
              GameStateRequirements: {
                FunctionName: "RequireGiftTrackProgress",
                FunctionArgs: { AnyOf: ["Relationship"], MinGifts: 1 },
              },
            },
            MaxedRequirement: {
              FunctionName: "RequireGiftTrackProgress",
              FunctionArgs: { AnyOf: ["Relationship"], MinGifts: 5 },
            },
          }),
        ],
        prophecies: [
          guideRecord("Prophecy", "Prophecy", {
            CompleteGameStateRequirements: {
              Path: ["GameState", "TraitsTaken"],
              HasAll: ["Boon"],
            },
          }),
        ],
        narrative: [guideRecord("Narrative")],
        outros: [],
        outroPriorities: [],
        achievements: [
          {
            ...guideRecord("Achievement"),
            displayName: "Achievement",
            description: "Achievement description.",
            hidden: false,
          },
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
            id: "Keepsake",
            displayName: "Keepsake",
            relationshipId: "Relationship",
            relationshipName: "Relationship",
            acquisitionRequirements: null,
            chamberThresholds: [],
            description: "Keepsake description.",
            mechanics: {},
            naturalRanks: [],
            rankEffects: [],
            temporaryBonusRank: null,
          } as never,
        ],
        familiars: [
          {
            id: "Familiar",
            displayName: "Familiar",
            description: "Familiar description.",
            mechanics: {},
            unlockRequirements: null,
            upgrades: [],
          } as never,
        ],
        hexes: [
          {
            id: "Hex",
            displayName: "Hex",
            description: "Hex description.",
            baseEffects: {},
            availabilityRequirements: null,
            talents: [],
          } as never,
        ],
        incantations: [
          {
            id: "Incantation",
            displayName: "Incantation",
            description: "Incantation description.",
            unlockRequirements: null,
            costs: [],
            effects: {
              OnActivateFunctionName: "InternalHook",
              GameStateRequirements: {
                RequiredTextLines: ["InternalStoryFlag"],
              },
              CookTime: 2,
            },
            automaticUnlock: false,
          } as never,
        ],
        automaticWorldUpgradeIds: [],
        incantationRevealPolicy: {
          maxNewRevealsPerRun: 3,
          categories: [{ id: "Critical", oneRevealPassPerRun: true, orderedIncantationIds: ["Incantation"] }],
        },
        spellTalentConfiguration: {},
      },
      weapons: {
        schema: "neodes2-weapons-1",
        source: {} as never,
        weapons: [
          {
            id: "Weapon",
            name: "Weapon",
            description: "Weapon description.",
            unlockCosts: [],
            evidence: [],
          } as never,
        ],
        aspects: [
          {
            id: "Aspect",
            weaponId,
            name: "Aspect",
            description: "Aspect description.",
            ranks: [],
            rankEffects: [],
            mechanics: {},
          } as never,
        ],
        hammers: [
          {
            id: "Hammer",
            weaponId: "Weapon",
            name: "Hammer",
            description: "Hammer description.",
            effects: {},
            mechanics: {},
            requirements: null,
            compatibility: {
              allowedAspectIds: ["Aspect"],
              excludedAspectIds: [],
              requiredAspectIds: [],
              incompatibleHammerIds: [],
            },
          } as never,
        ],
      },
    },
  };
}

function kingVerminDataset(): CombinedDataset {
  const dataset = combinedDataset();
  const sourceEnemy = dataset.domains.guide.enemies[0];
  if (sourceEnemy === undefined) throw new Error("Synthetic enemy is missing.");
  return {
    ...dataset,
    domains: {
      ...dataset.domains,
      guide: {
        ...dataset.domains.guide,
        encounters: dataset.domains.guide.encounters.map((encounter) => ({
          ...encounter,
          enemyIds: ["CrawlerMiniboss"],
        })),
        enemies: [
          {
            ...sourceEnemy,
            id: "CrawlerMiniboss",
            displayName: "Uh-oh",
          },
        ],
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
    progressionStages: [],
    weaponGuides: [],
    aspectGuides: [],
    boonRatings: [],
    arcanaRatings: [],
    familiarRatings: [],
    hexRatings: [],
    keepsakePriorities: [],
    resourceAdvice: [],
    pageDefinitions: [
      {
        id: "reference/weapons",
        pageKind: "reference",
        title: "Weapons",
        sourceRecordTypes: ["mechanics/weapon", "mechanics/weapon-aspect"],
        aliases: ["arms"],
        spoilerLevel: "none",
      },
      {
        id: "reference/boons",
        pageKind: "reference",
        title: "Boons",
        sourceRecordTypes: ["mechanics/god", "mechanics/boon"],
        aliases: ["blessings"],
        spoilerLevel: "none",
      },
      {
        id: "reference/enemies",
        pageKind: "reference",
        title: "Enemies",
        sourceRecordTypes: ["world-progression/enemy"],
        aliases: ["foes"],
        spoilerLevel: "none",
      },
    ],
    searchAliases: [
      {
        recordType: "foundation/record-metadata",
        id: "Weapon",
        subjectReference: { recordType: "mechanics/weapon", id: "Weapon" },
        aliases: ["nocturnal arm"],
      },
    ],
  };
}

const identity = {
  datasetAcquisitionId: "sha256:dataset",
  datasetSha256: "dataset-sha",
  dataReadyAcquisitionId: "sha256:data-ready",
  editorialAcquisitionId: "sha256:editorial",
} as const;

describe("Phase 8 publication compiler", () => {
  it("publishes delayed Cauldron reveal timing separately from direct eligibility", () => {
    const delayed = compilePublicationDataset(
      combinedDataset(),
      editorialDataset(),
      createPublicationAllowlist(),
      identity,
    );
    const availability = delayed.dataset.records
      .find((record) => record.key === "mechanics/incantation:Incantation")
      ?.fields.find((field) => field.id.endsWith("/availability"));
    assert.deepEqual(availability?.value, {
      rules: [
        "The Cauldron reveals at most 3 new Incantations from this category each night.",
        "Earlier eligible Incantations in the fixed Cauldron order can delay this one. They do not need to be completed.",
      ],
    });

    const base = combinedDataset();
    const immediate = compilePublicationDataset(
      {
        ...base,
        domains: {
          ...base.domains,
          loadouts: {
            ...base.domains.loadouts,
            incantations: base.domains.loadouts.incantations.map((incantation) => ({
              ...incantation,
              effects: { ...incantation.effects, AlwaysRevealImmediately: true },
            })),
          },
        },
      },
      editorialDataset(),
      createPublicationAllowlist(),
      identity,
    );
    assert.equal(
      immediate.dataset.records
        .find((record) => record.key === "mechanics/incantation:Incantation")
        ?.fields.find((field) => field.id.endsWith("/availability"))?.value,
      null,
    );
  });

  it("publishes both names for King Vermin and preserves the existing route", () => {
    const result = compilePublicationDataset(
      kingVerminDataset(),
      editorialDataset(),
      createPublicationAllowlist(),
      identity,
    );
    const record = result.dataset.records.find(
      (entry) => entry.key === "world-progression/enemy:CrawlerMiniboss",
    );
    assert.equal(record?.public?.name, "King Vermin (Uh-oh)");
    assert.equal(record?.public?.slug, "uh-oh");
    assert.equal(record?.public?.href, "/knowledge/records/enemies/uh-oh/");
    assert.deepEqual(record?.public?.aliases, [
      "King Vermin",
      "Uh-oh",
      "Vermin King",
    ]);
    assert.deepEqual(
      result.dataset.search
        .filter(
          (entry) =>
            entry.recordKey === "world-progression/enemy:CrawlerMiniboss",
        )
        .map((entry) => entry.normalizedTerm),
      ["king vermin", "king vermin (uh-oh)", "uh-oh", "vermin king"],
    );
  });

  it("builds allowlisted pages, search entries, conditions, and matching relationship indexes", () => {
    const allowlist = createPublicationAllowlist();
    const first = compilePublicationDataset(
      combinedDataset(),
      editorialDataset(),
      allowlist,
      identity,
    );
    const second = compilePublicationDataset(
      combinedDataset(),
      editorialDataset(),
      allowlist,
      identity,
    );
    assert.equal(first.report.complete, true, JSON.stringify(first.report));
    assert.deepEqual(first, second);
    assert.equal(
      first.dataset.pages.find((page) => page.id === "reference/weapons")
        ?.recordKeys.length,
      2,
    );
    assert.ok(
      first.dataset.search.some(
        (entry) =>
          entry.normalizedTerm === "nocturnal arm" &&
          entry.recordKey === "mechanics/weapon:Weapon",
      ),
    );
    assert.deepEqual(
      first.dataset.records.find(
        (record) => record.key === "mechanics/weapon:Weapon",
      )?.public,
      {
        name: "Weapon",
        slug: "weapon",
        typeLabel: "Weapon",
        summary: "Weapon description.",
        href: "/knowledge/builds/#weapon",
        aliases: ["nocturnal arm"],
        spoilerLevel: "none",
        category: "weapons",
        presentation: "embedded",
      },
    );
    assert.deepEqual(
      first.dataset.records
        .find((record) => record.key === "world-progression/relationship:Relationship")
        ?.fields.find((field) => field.id === "world-progression/relationship/gift-track")?.value,
      {
        maximumHearts: 8,
        eventLockAfterHearts: 5,
        firstGiftRequirements: {
          rules: ["Give at least 1 gift to any one of: Relationship."],
        },
        bondForgedRequirements: {
          rules: ["Give at least 5 gifts to any one of: Relationship."],
        },
        summary:
          "Relationship accepts up to 8 gifts. After gift 5, keep meeting Relationship and exhaust new dialogue until the next gift can be accepted.",
      },
    );
    assert.deepEqual(
      first.dataset.records
        .find(
          (record) =>
            record.key ===
            "world-progression/oath-condition:EnemyDamageShrineUpgrade",
        )
        ?.fields.find(
          (field) =>
            field.id === "world-progression/oath-condition/rank-effects",
        )?.value,
      {
        ranks: [
          { rank: 1, fear: 1, effect: "All foes deal 20% more damage." },
          { rank: 2, fear: 2, effect: "All foes deal 60% more damage." },
          { rank: 3, fear: 3, effect: "All foes deal 100% more damage." },
        ],
      },
    );
    assert.equal(
      first.dataset.records.find(
        (record) => record.key === "world-progression/prophecy:Prophecy",
      )?.public?.summary,
      "Record all 1 required Boons across any number of nights.",
    );
    assert.deepEqual(
      first.dataset.records.find(
        (record) => record.key === "world-progression/enemy:Enemy",
      )?.public,
      {
        name: "Enemy",
        slug: "enemy",
        typeLabel: "Enemy",
        summary:
          "Enemy with 900 maximum Life, exact combat traits, and extracted attack patterns.",
        href: "/knowledge/records/enemies/enemy/",
        aliases: [],
        spoilerLevel: "none",
        category: "enemies",
        presentation: "detail",
      },
    );
    assert.deepEqual(
      first.dataset.records
        .find(
          (record) =>
            record.key === "world-progression/encounter:Encounter",
        )
        ?.fields.find(
          (field) => field.id === "world-progression/encounter/enemies",
        )?.value,
      [{ recordType: "world-progression/enemy", id: "Enemy" }],
    );
    assert.equal(
      first.dataset.records.find(
        (record) => record.key === "world-progression/enemy:Enemy_Elite",
      )?.public,
      null,
    );
    assert.deepEqual(
      first.dataset.records.find(
        (record) => record.key === "mechanics/weapon:Weapon",
      )?.publication,
      {
        status: "published",
        category: "weapons",
        presentation: "embedded",
      },
    );
    assert.equal(
      first.dataset.records.find(
        (record) => record.key === "world-progression/encounter:Encounter",
      )?.public,
      null,
    );
    assert.equal(
      first.dataset.records.find(
        (record) => record.key === "world-progression/encounter:Encounter",
      )?.publication.status,
      "excluded",
    );
    assert.ok(
      first.dataset.search.every(
        (entry) =>
          first.dataset.records.find((record) => record.key === entry.recordKey)
            ?.public !== null,
      ),
    );
    assert.ok(
      first.dataset.records
        .filter((record) => record.recordType === "foundation/record-metadata")
        .every((record) => record.public === null),
    );
    assert.ok(
      first.dataset.relationships.forward.some(
        (edge) =>
          edge.sourceKey === "mechanics/weapon-aspect:Aspect" &&
          edge.targetKey === "mechanics/weapon:Weapon",
      ),
    );
    assert.ok(
      first.dataset.relationships.reverse.some(
        (edge) =>
          edge.sourceKey === "mechanics/weapon:Weapon" &&
          edge.targetKey === "mechanics/weapon-aspect:Aspect",
      ),
    );
    assert.ok(
      first.dataset.relationships.forward.every(
        (edge) => !edge.sourceKey.startsWith("foundation/record-metadata:"),
      ),
    );
    assert.ok(
      first.dataset.relationships.forward.every(
        (edge) =>
          edge.sourceKey !== "mechanics/resource:Resource" ||
          edge.targetKey !== "world-progression/enemy:Enemy",
      ),
    );
    assert.ok(
      first.dataset.conditions.some((condition) =>
        condition.dependentRecordKeys.includes("mechanics/arcana-card:Card"),
      ),
    );
    assert.ok(
      first.dataset.records.every((record) =>
        record.fields.every((field) =>
          allowlist.allowedFields.some((allowed) => allowed.id === field.id),
        ),
      ),
    );
    assert.doesNotMatch(
      JSON.stringify(first.dataset),
      /runtimePath|localizationPath|evidence|TooltipData|Icons|\{#|OnActivateFunctionName|InternalHook|InternalStoryFlag|GameStateRequirements|PathTrue|TextLinesRecord/u,
    );
    assert.match(JSON.stringify(first.dataset), /Attack gains 25 Life\./u);
    assert.equal(
      first.dataset.records
        .find((record) => record.key === "mechanics/boon:Boon")
        ?.fields.find((field) => field.id === "mechanics/boon/description")
        ?.value,
      "Boon description.",
    );
    assert.deepEqual(
      first.dataset.records
        .find((record) => record.key === "world-progression/prophecy:Prophecy")
        ?.fields.find((field) => field.id.endsWith("/objectives"))?.value,
      {
        references: [{ id: "Boon", recordType: "mechanics/boon" }],
        rules: [
          "Requires all of these boons across any number of nights: Boon.",
        ],
      },
    );
    assert.equal(
      first.dataset.records
        .find((record) => record.key === "mechanics/keepsake:Keepsake")
        ?.fields.find((field) => field.id === "mechanics/keepsake/description")
        ?.value,
      "Keepsake description.",
    );
    assert.equal(
      first.dataset.records.find((record) => record.key === "mechanics/god:God")
        ?.public?.summary,
      "God can appear through the normal Olympian Boon pool without a special progression unlock.",
    );
    assert.equal(
      first.dataset.records.find(
        (record) => record.key === "mechanics/status-element:Status",
      )?.public?.summary,
      "Status description.",
    );
    assert.doesNotMatch(JSON.stringify(first.dataset), /\{\$GameState\./u);
    assert.match(
      JSON.stringify(first.dataset),
      /"brewDurationInEncounters":2/u,
    );
  });

  it("uses official public terminology for internal Boon keyword identifiers", () => {
    const base = combinedDataset();
    const description = [
      "{$Keywords.Echo}",
      "{$Keywords.BaseDamage}",
      "{$Keywords.Blind}",
      "{$Keywords.Charm}",
      "{$Keywords.DashSet}",
      "{$Keywords.DeathWeapon}",
      "{$Keywords.HeartBurst}",
      "{$Keywords.HeartBurstPlural}",
      "{$Keywords.MetaRewardAlt}",
      "{$Keywords.Rend}",
      "{$Keywords.Root}",
      "{$Keywords.RoomAlt}",
      "{$Keywords.SlowField}",
      "{$Keywords.StatusPlural}",
      "{$Keywords.Synergy}",
      "{$Keywords.WeaponSet}",
    ].join(" | ");
    const result = compilePublicationDataset(
      {
        ...base,
        domains: {
          ...base.domains,
          boons: {
            ...base.domains.boons,
            boons: base.domains.boons.boons.map((boon) => ({
              ...boon,
              description,
            })),
          },
        },
      },
      editorialDataset(),
      createPublicationAllowlist(),
      identity,
    );
    assert.equal(
      result.dataset.records
        .find((record) => record.key === "mechanics/boon:Boon")
        ?.fields.find((field) => field.id === "mechanics/boon/description")
        ?.value,
      "Blitz | Power | Daze | Charm | Rushing | Inferno-Bomb | Heartthrob | Heartthrobs | Minor Finds | Wounds | Freeze | location | Gust | Curses | Infusion | Weapon.",
    );
  });

  it("rejects an unresolved explicit record relationship", () => {
    const result = compilePublicationDataset(
      combinedDataset("MissingWeapon"),
      editorialDataset(),
      createPublicationAllowlist(),
      identity,
    );
    assert.equal(result.report.complete, false);
    assert.ok(
      result.report.unresolvedReferences.some((issue) =>
        issue.includes("mechanics/weapon:MissingWeapon"),
      ),
    );
  });

  it("reports forbidden payload keys and a missing reverse relationship", () => {
    const allowlist = createPublicationAllowlist();
    const compiled = compilePublicationDataset(
      combinedDataset(),
      editorialDataset(),
      allowlist,
      identity,
    );
    const record = compiled.dataset.records.find(
      (entry) => entry.recordType === "mechanics/boon",
    );
    assert.ok(record);
    const report = createPublicationReport(
      {
        ...compiled.dataset,
        records: compiled.dataset.records.map((entry) =>
          entry.key === record.key
            ? {
                ...entry,
                fields: entry.fields
                  .slice(1)
                  .map((field, index) =>
                    index === 0
                      ? { ...field, value: { runtimePath: "private" } }
                      : field,
                  ),
              }
            : entry,
        ),
        pages: compiled.dataset.pages.map((page, index) =>
          index === 0
            ? {
                ...page,
                recordKeys: [...page.recordKeys, "mechanics/weapon:Missing"],
              }
            : page,
        ),
        relationships: {
          ...compiled.dataset.relationships,
          reverse: compiled.dataset.relationships.reverse.slice(1),
        },
      },
      allowlist,
    );
    assert.equal(report.complete, false);
    assert.ok(report.missingAllowedFieldIds.length > 0);
    assert.ok(report.forbiddenPayloadPaths.length > 0);
    assert.ok(
      report.unresolvedReferences.some(
        (issue) =>
          issue.includes("page:") && issue.includes("mechanics/weapon:Missing"),
      ),
    );
    assert.ok(report.incompleteReverseRelationships.length > 0);
  });

  it("publishes Raki's recruitment steps instead of an already-recruited tautology", () => {
    const base = combinedDataset();
    const combined: CombinedDataset = {
      ...base,
      domains: {
        ...base.domains,
        loadouts: {
          ...base.domains.loadouts,
          familiars: [
            {
              id: "RavenFamiliar",
              displayName: "Raki",
              description: "Raki description.",
              mechanics: {},
              unlockRequirements: {
                PathTrue: [
                  "GameState",
                  "FamiliarStatus",
                  "RavenFamiliar",
                  "Unlocked",
                ],
              },
              upgrades: [],
            } as never,
          ],
        },
      },
    };
    const compiled = compilePublicationDataset(
      combined,
      editorialDataset(),
      createPublicationAllowlist(),
      identity,
    );
    const unlockField = compiled.dataset.records
      .find((record) => record.key === "mechanics/familiar:RavenFamiliar")
      ?.fields.find((field) => field.id.endsWith("/unlock-requirements"));

    assert.match(JSON.stringify(unlockField?.value), /Erebus fountain room/u);
    assert.match(JSON.stringify(unlockField?.value), /Witch's Delight/u);
    assert.doesNotMatch(JSON.stringify(unlockField?.value), /Raki recruited/u);
  });
});

describe("reader-facing requirement summaries", () => {
  it("names the Book of Shadows prerequisite instead of publishing a bare active flag", () => {
    const rules = readableRequirementExpression({
      PathTrue: ["CodexStatus", "Enabled"],
    });

    assert.deepEqual(rules, ["Requires the Book of Shadows to be available."]);
  });

  it("states when any one boon from a list is sufficient", () => {
    const requirements = publicRequirements(
      { OneOf: ["ApolloWeaponBoon", "ApolloSpecialBoon"], Type: "OneOf" },
      new Map([
        ["ApolloWeaponBoon", "Nova Strike"],
        ["ApolloSpecialBoon", "Nova Flourish"],
      ]),
    );
    assert.deepEqual(requirements.rules, [
      "Choose any 1 of these options: Nova Strike, Nova Flourish.",
    ]);
  });

  it("states when one boon from every prerequisite group is required", () => {
    const requirements = publicRequirements(
      {
        OneFromEachSet: [
          ["ApolloWeaponBoon", "ApolloSpecialBoon"],
          ["ApolloCastBoon", "ApolloSprintBoon", "ApolloManaBoon"],
        ],
        Type: "OneFromEachSet",
      },
      new Map([
        ["ApolloWeaponBoon", "Nova Strike"],
        ["ApolloSpecialBoon", "Nova Flourish"],
        ["ApolloCastBoon", "Solar Ring"],
        ["ApolloSprintBoon", "Blinding Rush"],
        ["ApolloManaBoon", "Lucid Gain"],
      ]),
    );
    assert.deepEqual(requirements.rules, [
      "Choose 1 option from each of these 2 groups (2 choices total): group 1: Nova Strike, Nova Flourish, group 2: Solar Ring, Blinding Rush, Lucid Gain.",
    ]);
  });

  it("resolves nested prophecy counters and named record lists", () => {
    const names = new Map([
      ["AresWeaponBoon", "Wounding Strike"],
      ["AresSpecialBoon", "Wounding Flourish"],
    ]);
    const rules = readableRequirementExpression(
      {
        CompleteGameStateRequirements: [
          {
            Path: ["GameState", "FishCaught"],
            UseLength: true,
            Comparison: ">=",
            Value: 20,
          },
          {
            Path: ["GameState", "TraitsTaken"],
            HasAll: ["AresWeaponBoon", "AresSpecialBoon"],
          },
        ],
      },
      names,
    );
    assert.ok(rules.includes("Requires at least 20 different fish caught."));
    assert.ok(
      rules.some(
        (rule) =>
          rule.includes("Wounding Strike") &&
          rule.includes("Wounding Flourish"),
      ),
    );
  });

  it("summarizes gift-track functions and preserves OR semantics", () => {
    const names = new Map([
      ["NPC_Hecate_01", "Hecate"],
      ["NPC_Odysseus_01", "Odysseus"],
      ["WorldUpgradeGarden", "Flourishing Soil"],
    ]);
    const rules = readableRequirementExpression(
      {
        FunctionName: "RequireGiftTrackProgress",
        FunctionArgs: {
          AnyOf: ["NPC_Hecate_01", "NPC_Odysseus_01"],
          MinGifts: 2,
        },
        OrRequirements: [
          [{ PathTrue: ["GameState", "WorldUpgrades", "WorldUpgradeGarden"] }],
          [
            {
              Path: ["GameState", "FishingSuccesses"],
              Comparison: ">=",
              Value: 3,
            },
          ],
        ],
      },
      names,
    );
    assert.ok(
      rules.includes("Give at least 2 gifts to any one of: Hecate, Odysseus."),
    );
    assert.ok(
      rules.some((rule) => rule.startsWith("Meet one of these conditions:")),
    );
  });

  it("distinguishes permanent weapon unlocks from weapons unlocked during the current night", () => {
    const names = new Map([
      ["WeaponDagger", "Sister Blades"],
      ["WeaponTorch", "Umbral Flames"],
    ]);
    const rules = readableRequirementExpression(
      {
        CompleteGameStateRequirements: [
          {
            Path: ["GameState", "WeaponsUnlocked"],
            HasAll: ["WeaponDagger", "WeaponTorch"],
          },
          {
            Path: ["CurrentRun", "WeaponsUnlocked"],
            HasNone: ["WeaponDagger", "WeaponTorch"],
          },
        ],
      },
      names,
    );
    assert.ok(
      rules.includes(
        "Unlock all of these weapons: Sister Blades, Umbral Flames.",
      ),
    );
    assert.ok(
      rules.includes(
        "None of these weapons may have been unlocked during the current night: Sister Blades, Umbral Flames.",
      ),
    );
  });

  it("describes Echo's previous-Keepsake restriction without exposing save-state terminology", () => {
    const names = new Map([
      ["AthenaEncounterKeepsake", "Gorgon Amulet"],
      ["HadesAndPersephoneKeepsake", "Jeweled Pom"],
      ["EscalatingKeepsake", "Discordant Bell"],
      ["FountainRarityKeepsake", "Aromatic Phial"],
    ]);
    const rules = readableRequirementExpression(
      {
        Path: ["GameState", "LastAwardTrait"],
        IsNone: [
          "AthenaEncounterKeepsake",
          "HadesAndPersephoneKeepsake",
          "EscalatingKeepsake",
          "FountainRarityKeepsake",
        ],
      },
      names,
    );
    assert.deepEqual(rules, [
      "The previous Keepsake cannot be Gorgon Amulet, Jeweled Pom, Discordant Bell, or Aromatic Phial.",
    ]);
  });

  it("translates friend encounters, route state, and Testaments into player language", () => {
    const names = new Map([
      ["NPC_Heracles_01", "Heracles"],
      ["NemesisCombatF", "Nemesis encounter in Erebus"],
    ]);
    const rules = readableRequirementExpression(
      {
        CompleteGameStateRequirements: [
          {
            Path: ["GameState", "UseRecord", "NPC_Heracles_01"],
            Comparison: ">=",
            Value: 4,
          },
          { PathFalse: ["PrevRun", "Cleared"] },
          {
            Path: ["CurrentRun", "EncountersOccurredCache"],
            HasNone: ["NemesisCombatF"],
          },
          {
            Path: ["GameState", "ShrineBountiesCompleted"],
            HasAll: ["BountyShrineStaffFBoss"],
          },
        ],
        NamedRequirementsFalse: [
          "StandardPackageBountyActive",
          "HecateMissing",
        ],
      },
      names,
    );
    assert.ok(rules.includes("Encounter Heracles at least 4 times."));
    assert.ok(
      rules.includes(
        "Requires the previous night not to have ended in a route clear.",
      ),
    );
    assert.ok(
      rules.includes(
        "Do not encounter any of these events during the current night: Nemesis encounter in Erebus.",
      ),
    );
    assert.ok(
      rules.includes(
        "Complete all of these Testaments first: Witch's Staff Testament against Headmistress Hecate.",
      ),
    );
    assert.ok(
      rules.includes(
        "Requires no standard Chaos Trial to be active this night.",
      ),
    );
    assert.ok(
      rules.includes("Requires Hecate to be present at the Crossroads."),
    );
  });
});
