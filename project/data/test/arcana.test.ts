import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  auditArcanaSources,
  createRuntimeArcanaAcquisition,
  normalizeRuntimeArcana,
  preflightArcanaExporter,
  validateRuntimeArcanaReport,
  type RuntimeArcanaReport,
  type RuntimeBoonSample,
} from "../src/index.js";

const cardIds = Array.from({ length: 25 }, (_, index) => `Card${String(index + 1).padStart(2, "0")}`);
const rarities = ["Common", "Rare", "Epic"] as const;

function hash(content: string | Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}

function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sample(rarity: string): RuntimeBoonSample {
  return {
    rarity,
    endpoint: "fixed",
    level: 1,
    context: { mode: "player-independent", elementCounts: [] },
    result: {
      status: "ok",
      values: [
        {
          id: "Value",
          source: {
            kind: "processed-trait",
            key: "ReportedValue",
            runtimePath: "TraitData.SyntheticTrait.processed.ReportedValue",
            value: 1.25,
          },
          staticInputs: [],
          resolution: { kind: "resolved", value: 25 },
        },
      ],
    },
  };
}

function adjacency(index: number): readonly string[] {
  const row = Math.floor(index / 5);
  const column = index % 5;
  return cardIds
    .filter((_, candidate) => {
      const candidateRow = Math.floor(candidate / 5);
      const candidateColumn = candidate % 5;
      return Math.abs(row - candidateRow) + Math.abs(column - candidateColumn) === 1;
    })
    .toSorted();
}

function runtimeReport(sourceManifestSha256 = "source-manifest-hash"): RuntimeArcanaReport {
  return {
    schema: "neodes2-arcana-runtime-1",
    exporterVersion: "0.4.0",
    generatedAtUnixSeconds: 1_787_000_000,
    language: "en",
    game: {
      steamBuildId: "24556151",
      executableVersion: "139671",
      packageVersion: "138174",
      acquisitionId: "sha256:source-acquisition",
      sourceManifestSha256,
    },
    sourceTables: [
      "MetaUpgradeCardData",
      "MetaUpgradeCostData",
      "MetaUpgradeDefaultCardLayout",
      "TraitData",
    ],
    localizationFiles: ["Content/Game/Text/en/TraitText.en.sjson"],
    unlockModel: {
      kind: "orthogonal-adjacency",
      startingCardId: cardIds[0] as string,
      layoutMutableAfterUnlock: true,
    },
    layout: cardIds.map((cardId, index) => ({
      row: Math.floor(index / 5) + 1,
      column: (index % 5) + 1,
      cardId,
    })),
    grasp: {
      id: "IncreaseMetaUpgradeCard",
      displayName: "Grasp",
      description: "Capacity for active Arcana Cards.",
      startingCapacity: 10,
      levels: Array.from({ length: 15 }, (_, index) => ({
        level: index + 1,
        capacityIncrease: 1,
        cumulativeCapacity: 11 + index,
        costs: [{ resourceId: "MemPointsCommon", amount: index + 1 }],
      })),
      evidence: {
        localizationPath: "Content/Game/Text/en/TraitText.en.sjson:IncreaseMetaUpgradeCard",
        runtimePaths: ["MetaUpgradeCostData"],
      },
    },
    cards: cardIds.map((id, index) => ({
      id,
      row: Math.floor(index / 5) + 1,
      column: (index % 5) + 1,
      displayName: `Card ${index + 1}`,
      description: "Gain {$TooltipData.ExtractData.Value} power.",
      traitId: `${id}Trait`,
      type: null,
      graspCost: index === 0 ? 0 : 1,
      unlockCosts: [{ resourceId: "MemPointsCommon", amount: 1 }],
      ranks: rarities.map((rarity, rankIndex) => ({
        rank: rankIndex + 1,
        rarity,
        upgradeFromPreviousCosts:
          rankIndex === 0 ? [] : [{ resourceId: "MetaCardPointsCommon", amount: rankIndex }],
        runtimePath: `TraitData.${id}Trait.RarityLevels.${rarity}`,
      })),
      autoActivationRequirements: index === 0 ? { HasCosts: 2 } : {},
      autoActivationText: index === 0 ? "Activates automatically with two active Cards." : null,
      relatedCardIds: [],
      unlock: {
        initiallyRevealable: index === 0,
        adjacentCardIds: adjacency(index),
      },
      mechanics: {
        ExtractValues: [{ ExtractAs: "Value", Key: "ReportedValue" }],
      },
      rankEffects: rarities.map(sample),
      evidence: {
        localizationPath: `Content/Game/Text/en/TraitText.en.sjson:${id}`,
        runtimePaths: [
          `MetaUpgradeCardData.${id}`,
          `MetaUpgradeDefaultCardLayout[${Math.floor(index / 5) + 1}][${(index % 5) + 1}]`,
          `TraitData.${id}Trait`,
        ].sort(),
      },
    })),
  };
}

async function withTemporaryDirectory(run: (directory: string) => Promise<void>): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), "neodes2-arcana-test-"));
  try {
    await run(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function writeSyntheticArcanaSources(directory: string): Promise<void> {
  const scripts = join(directory, "sources", "Content", "Scripts");
  const text = join(directory, "sources", "Content", "Game", "Text", "en");
  await mkdir(scripts, { recursive: true });
  await mkdir(text, { recursive: true });
  const rows = Array.from({ length: 5 }, (_, row) =>
    `{ ${cardIds.slice(row * 5, row * 5 + 5).map((id) => `"${id}"`).join(", ")} }`,
  );
  const cards = cardIds.map(
    (id, index) => `${id} = {
  InheritFrom = { "BaseMetaUpgrade" },
  TraitName = "${id}Trait",
  Cost = ${index === 0 ? 0 : 1},
  ResourceCost = { MemPointsCommon = 1 },
  UpgradeResourceCost = {
    { MetaCardPointsCommon = 1, CardUpgradePoints = 1 },
    { MetaCardPointsCommon = 2, CardUpgradePoints = 2 },
  },
  ${index === 0 ? 'AutoEquipRequirements = { HasCosts = 2 },\n  AutoEquipText = "SyntheticAutoText",' : ""}
},`,
  );
  const graspLevels = Array.from(
    { length: 15 },
    (_, index) => `{ CostIncrease = 1, ResourceCost = { MemPointsCommon = ${index + 1} } },`,
  );
  await writeFile(
    join(scripts, "MetaUpgradeData.lua"),
    `MetaUpgradeDefaultCardLayout = {\n${rows.join(",\n")}\n}\n
MetaUpgradeCostData = {
  StartingMetaUpgradeLimit = 10,
  MetaUpgradeLevelData = {
${graspLevels.join("\n")}
  },
}

MetaUpgradeCardData = {
${cards.join("\n")}
}
`,
  );
  await writeFile(
    join(scripts, "TraitData_MetaUpgrade.lua"),
    `TraitSetData.MetaUpgrade = {
${cardIds
  .map(
    (id) => `${id}Trait = {
  ReportedValue = 1.25,
  ExtractValues = { { ExtractAs = "Value", Key = "ReportedValue", Format = "Percent", BaseType = "Weapon" } },
},`,
  )
  .join("\n")}
}
`,
  );
  await writeFile(
    join(scripts, "MetaUpgradeCardScreenLogic.lua"),
    `function HasNeighboringUnlockedCards( row, column )
  local left = column - 1
  local right = column + 1
  local down = row + 1
  local up = row - 1
  local first = row == 1 and column == 1
  local mutable = GameState.MetaUpgradeCardLayout[ cardACoord.Row ][ cardACoord.Column ]
end
`,
  );
  const localized = [
    ...cardIds.map(
      (id) => `{
  Id = "${id}"
  DisplayName = "${id}"
  Description = "Gain {$TooltipData.ExtractData.Value} power."
}`,
    ),
    `{
  Id = "SyntheticAutoText"
  DisplayName = "Activates automatically with two active Cards."
}`,
    `{
  Id = "IncreaseMetaUpgradeCard"
  DisplayName = "Grasp"
  Description = "Capacity for active Arcana Cards."
}`,
  ];
  await writeFile(join(text, "TraitText.en.sjson"), `${localized.join("\n")}\n`);
}

async function writeSourceIdentity(directory: string): Promise<string> {
  await mkdir(directory, { recursive: true });
  const manifest = json({
    schema: "neodes2-source-manifest-1",
    acquisitionId: "sha256:source-acquisition",
    game: {
      steamBuildId: "24556151",
      executableVersion: "139671",
      packageVersion: "138174",
    },
    sources: [],
  });
  await writeFile(join(directory, "manifest.json"), manifest);
  await writeFile(
    join(directory, "complete.json"),
    json({
      schema: "neodes2-source-snapshot-completion-1",
      acquisitionId: "sha256:source-acquisition",
      manifestSha256: hash(manifest),
    }),
  );
  await writeSyntheticArcanaSources(directory);
  return hash(manifest);
}

async function writeRuntimeRun(directory: string, report: RuntimeArcanaReport): Promise<string> {
  await mkdir(directory, { recursive: true });
  const content = json(report);
  const reportSha256 = hash(content);
  const reportPath = join(directory, "runtime-report.json");
  await writeFile(reportPath, content);
  await writeFile(
    join(directory, "manifest.json"),
    json({
      schema: "neodes2-arcana-runtime-manifest-1",
      exporterVersion: report.exporterVersion,
      reportFile: "runtime-report.json",
      reportSha256,
    }),
  );
  await writeFile(
    join(directory, "complete.json"),
    json({ schema: "neodes2-arcana-runtime-completion-1", reportSha256 }),
  );
  return reportPath;
}

describe("Arcana runtime report", () => {
  it("validates and normalizes deterministic Card and Grasp coverage", () => {
    const report = validateRuntimeArcanaReport(runtimeReport());
    const first = normalizeRuntimeArcana(report);
    const second = normalizeRuntimeArcana(report);

    assert.deepEqual(first, second);
    assert.equal(first.coverage.complete, true);
    assert.equal(first.coverage.cardCount, 25);
    assert.equal(first.coverage.rankCount, 75);
    assert.equal(first.coverage.automaticCardCount, 1);
    assert.equal(first.coverage.maximumGrasp, 25);
  });

  it("rejects invalid adjacency and missing rank samples", () => {
    const brokenAdjacency = structuredClone(runtimeReport()) as unknown as {
      cards: { unlock: { adjacentCardIds: string[] } }[];
    };
    brokenAdjacency.cards[0]!.unlock.adjacentCardIds = [];
    assert.throws(() => validateRuntimeArcanaReport(brokenAdjacency), /invalid adjacency/u);

    const missingRank = structuredClone(runtimeReport()) as unknown as {
      cards: { rankEffects: RuntimeBoonSample[] }[];
    };
    missingRank.cards[0]!.rankEffects = missingRank.cards[0]!.rankEffects.filter(
      (entry) => entry.rarity !== "Epic",
    );
    assert.throws(() => validateRuntimeArcanaReport(missingRank), /no successful Epic/u);
  });

  it("keeps automatic activation independent of Grasp cost", () => {
    const report = structuredClone(runtimeReport()) as unknown as {
      cards: { graspCost: number; autoActivationRequirements: object; autoActivationText: string | null }[];
    };
    report.cards[0]!.graspCost = 1;
    assert.doesNotThrow(() => validateRuntimeArcanaReport(report));
  });
});

describe("Arcana source and runtime acquisition", () => {
  it("accepts a complete source set and exporter preflight", async () => {
    await withTemporaryDirectory(async (directory) => {
      await writeSyntheticArcanaSources(directory);
      const audit = await auditArcanaSources(directory);
      assert.equal(audit.complete, true);
      assert.equal(audit.cards.length, 25);
      assert.equal(audit.graspLevelCount, 15);

      const preflight = await preflightArcanaExporter(
        join(process.cwd(), "mod", "neodes2-boon-exporter"),
        directory,
      );
      assert.equal(preflight.complete, true);
      assert.equal(preflight.exporterVersion, "0.6.5");
    });
  });

  it("binds finalized Arcana runtime data to its source acquisition", async () => {
    await withTemporaryDirectory(async (directory) => {
      const sourceDirectory = join(directory, "source");
      const sourceManifestSha256 = await writeSourceIdentity(sourceDirectory);
      const reportPath = await writeRuntimeRun(
        join(directory, "runtime"),
        runtimeReport(sourceManifestSha256),
      );
      const result = await createRuntimeArcanaAcquisition({
        reportPath,
        sourceAcquisitionDirectory: sourceDirectory,
        outputRoot: join(directory, ".local", "arcana"),
        now: () => new Date("2026-08-19T00:00:00.000Z"),
      });

      assert.equal(result.cardCount, 25);
      assert.equal(result.rankCount, 75);
      assert.equal(result.graspLevelCount, 15);
      assert.equal(result.coverageComplete, true);
      assert.match(await readFile(join(result.directory, "arcana.json"), "utf8"), /Card01/u);
      const completion = JSON.parse(
        await readFile(join(result.directory, "complete.json"), "utf8"),
      ) as { schema: string };
      assert.equal(completion.schema, "neodes2-arcana-acquisition-completion-1");
    });
  });
});
