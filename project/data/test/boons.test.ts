import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  createRuntimeBoonAcquisition,
  normalizeRuntimeBoons,
  renderBoonCoverageReport,
  validateRuntimeBoonReport,
  type RuntimeBoonReport,
} from "../src/boons/index.js";

function hash(content: string | Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}

function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function runtimeReport(overrides: {
  readonly packageVersion?: string;
} = {}): RuntimeBoonReport {
  return {
    schema: "neodes2-boon-runtime-2",
    exporterVersion: "0.2.0",
    generatedAtUnixSeconds: 1_787_000_000,
    language: "en",
    game: {
      steamBuildId: "24556151",
      executableVersion: "139671",
      packageVersion: overrides.packageVersion ?? "138174",
      acquisitionId: "sha256:source-acquisition",
      sourceManifestSha256: "source-manifest-hash",
    },
    sourceTables: ["LootData", "TraitData", "TraitRequirements"],
    localizationFiles: ["Content/Game/Text/en/TraitText.en.sjson"],
    lootSources: [
      {
        id: "AphroditeUpgrade",
        displayName: "Aphrodite",
        speakerName: "Aphrodite",
        boonIds: ["AphroditeWeaponBoon", "DuoBoon"],
        runtimePath: "LootData.AphroditeUpgrade",
        localizationPath: "Content/Game/Text/en/_LootData_Aphrodite.en.sjson",
      },
      {
        id: "ApolloUpgrade",
        displayName: "Apollo",
        speakerName: "Apollo",
        boonIds: ["DuoBoon"],
        runtimePath: "LootData.ApolloUpgrade",
        localizationPath: "Content/Game/Text/en/_LootData_Apollo.en.sjson",
      },
    ],
    boons: [
      {
        id: "AphroditeWeaponBoon",
        name: "Flutter Strike",
        description:
          "Your Attacks deal {$TooltipData.ExtractData.TooltipDamageBonus} more damage to nearby foes.",
        ownerIds: ["AphroditeUpgrade"],
        kind: "normal",
        elements: ["Water"],
        inheritedFrom: ["BaseTrait", "WaterBoon"],
        hasPrerequisites: false,
        prerequisites: {},
        rarityLevels: { Common: { Multiplier: 1 }, Rare: { Multiplier: 1.25 } },
        mechanics: {
          ExtractValues: [{ ExtractAs: "TooltipDamageBonus", Key: "ReportedWeaponMultiplier" }],
        },
        samples: [
          {
            rarity: "Common",
            endpoint: "fixed",
            level: 1,
            context: { mode: "player-independent", elementCounts: [] },
            result: {
              status: "ok",
              values: [
                {
                  id: "TooltipDamageBonus",
                  source: {
                    kind: "processed-trait",
                    key: "ReportedWeaponMultiplier",
                    runtimePath:
                      "TraitData.AphroditeWeaponBoon.processed.ReportedWeaponMultiplier",
                    value: 1.8,
                  },
                  staticInputs: [],
                  resolution: { kind: "resolved", value: 80 },
                },
              ],
            },
          },
          {
            rarity: "Common",
            endpoint: "fixed",
            level: 2,
            context: { mode: "player-independent", elementCounts: [] },
            result: {
              status: "ok",
              values: [
                {
                  id: "TooltipDamageBonus",
                  source: {
                    kind: "processed-trait",
                    key: "ReportedWeaponMultiplier",
                    runtimePath:
                      "TraitData.AphroditeWeaponBoon.processed.ReportedWeaponMultiplier",
                    value: 2.05,
                  },
                  staticInputs: [],
                  resolution: { kind: "resolved", value: 105 },
                },
              ],
            },
          },
        ],
        evidence: {
          runtimePaths: ["LootData.AphroditeUpgrade", "TraitData.AphroditeWeaponBoon"],
          localizationPath: "Content/Game/Text/en/TraitText.en.sjson",
        },
      },
      {
        id: "DuoBoon",
        name: "Synthetic Duo",
        description: "Strike {$TraitData.DuoBoon.BurstCount} times.",
        ownerIds: ["AphroditeUpgrade", "ApolloUpgrade"],
        kind: "duo",
        elements: [],
        inheritedFrom: ["SynergyTrait"],
        hasPrerequisites: true,
        prerequisites: { OneFromEachSet: [["AphroditeWeaponBoon"], ["ApolloWeaponBoon"]] },
        rarityLevels: { Common: { Multiplier: 1 } },
        mechanics: { BurstCount: 2 },
        samples: [
          {
            rarity: "Common",
            endpoint: "fixed",
            level: 1,
            context: {
              mode: "player-independent",
              elementCounts: [{ element: "Fire", count: 1 }],
            },
            result: {
              status: "ok",
              values: [
                {
                  id: "Count",
                  source: {
                    kind: "static-base-data",
                    baseType: "EffectData",
                    baseName: "SyntheticEffect",
                    baseProperty: "Count",
                    runtimePath: "EffectData.SyntheticEffect.EffectData.Count",
                    value: 2,
                  },
                  staticInputs: [],
                  resolution: {
                    kind: "contextual",
                    expression: "round(value * LuckMultiplier * 100, 0)",
                    inputIds: ["LuckMultiplier"],
                  },
                },
                {
                  id: "WeaponArea",
                  source: {
                    kind: "processed-trait-variants",
                    key: "ReportedAoEIncrease",
                    selectorInputId: "WeaponName",
                    variants: [
                      {
                        selectorValue: "WeaponAxe",
                        runtimePaths: [
                          "TraitData.DuoBoon.processed.PropertyChanges[1].ChangeValue",
                        ],
                        value: 1.2,
                      },
                      {
                        selectorValue: "WeaponStaffSwing",
                        runtimePaths: [
                          "TraitData.DuoBoon.processed.PropertyChanges[2].ChangeValue",
                        ],
                        value: 1.4,
                      },
                    ],
                  },
                  staticInputs: [],
                  resolution: {
                    kind: "contextual",
                    expression: "round((value - 1) * 100, 0)",
                    inputIds: ["WeaponName"],
                  },
                },
              ],
            },
          },
        ],
        evidence: {
          runtimePaths: [
            "LootData.AphroditeUpgrade",
            "LootData.ApolloUpgrade",
            "TraitData.DuoBoon",
            "TraitRequirements.DuoBoon",
          ],
          localizationPath: "Content/Game/Text/en/TraitText.en.sjson",
        },
      },
    ],
  };
}

async function withTemporaryDirectory(
  run: (directory: string) => Promise<void>,
): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), "neodes2-boons-test-"));
  try {
    await run(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function writeSourceAcquisition(directory: string): Promise<void> {
  await mkdir(directory, { recursive: true });
  const manifestContent = json({
    schema: "neodes2-source-manifest-1",
    acquisitionId: "sha256:source-acquisition",
    game: {
      steamBuildId: "24556151",
      executableVersion: "139671",
      packageVersion: "138174",
    },
  });
  await writeFile(join(directory, "manifest.json"), manifestContent);
  await writeFile(
    join(directory, "complete.json"),
    json({
      schema: "neodes2-source-snapshot-completion-1",
      acquisitionId: "sha256:source-acquisition",
      manifestSha256: hash(manifestContent),
    }),
  );
}

async function writeRuntimeRun(directory: string, report: RuntimeBoonReport): Promise<string> {
  await mkdir(directory, { recursive: true });
  const reportContent = json(report);
  const reportSha256 = hash(reportContent);
  const reportPath = join(directory, "runtime-report.json");
  await writeFile(reportPath, reportContent);
  await writeFile(
    join(directory, "manifest.json"),
    json({
      schema: "neodes2-boon-runtime-manifest-1",
      exporterVersion: report.exporterVersion,
      reportFile: "runtime-report.json",
      reportSha256,
    }),
  );
  await writeFile(
    join(directory, "complete.json"),
    json({ schema: "neodes2-boon-runtime-completion-1", reportSha256 }),
  );
  return reportPath;
}

describe("boon runtime report", () => {
  it("validates cross-references and produces deterministic normalized coverage", () => {
    const report = validateRuntimeBoonReport(runtimeReport());
    const first = normalizeRuntimeBoons(report);
    const second = normalizeRuntimeBoons(report);

    assert.deepEqual(first, second);
    assert.equal(first.dataset.boons.length, 2);
    assert.deepEqual(first.dataset.boons[0]?.godIds, ["AphroditeUpgrade"]);
    assert.equal(first.coverage.complete, true);
    assert.equal(first.coverage.failedSampleCount, 0);
    assert.equal(first.coverage.resolvedValueCount, 2);
    assert.equal(first.coverage.contextualValueCount, 2);
    assert.equal(first.coverage.boonsWithContextualValues, 1);
    assert.deepEqual(first.dataset.boons[1]?.levelScaling[0]?.context.elementCounts, [
      { element: "Fire", count: 1 },
    ]);
    assert.match(renderBoonCoverageReport(first.coverage), /Status: complete/u);
  });

  it("rejects unsorted identifiers and inconsistent ownership", () => {
    const unsorted = structuredClone(runtimeReport()) as unknown as {
      lootSources: { boonIds: string[] }[];
    };
    unsorted.lootSources[0]!.boonIds.reverse();
    assert.throws(() => validateRuntimeBoonReport(unsorted), /must be sorted/u);

    const inconsistent = structuredClone(runtimeReport()) as unknown as {
      boons: { ownerIds: string[] }[];
    };
    inconsistent.boons[0]!.ownerIds = ["ApolloUpgrade"];
    assert.throws(() => validateRuntimeBoonReport(inconsistent), /disagree about ownership/u);
  });

  it("rejects invalid player-independent sample context and contextual formulas", () => {
    const invalidContext = structuredClone(runtimeReport()) as unknown as {
      boons: { samples: { context: { elementCounts: { count: number }[] } }[] }[];
    };
    invalidContext.boons[0]!.samples[0]!.context.elementCounts = [{ count: 0 }];
    assert.throws(() => validateRuntimeBoonReport(invalidContext), /element/u);

    const missingInput = structuredClone(runtimeReport()) as unknown as {
      boons: {
        samples: { result: { values: { resolution: { inputIds: string[] } }[] } }[];
      }[];
    };
    missingInput.boons[1]!.samples[0]!.result.values[0]!.resolution.inputIds = [];
    assert.throws(() => validateRuntimeBoonReport(missingInput), /at least one context input/u);

    const missingSelectorInput = structuredClone(runtimeReport()) as unknown as {
      boons: {
        samples: { result: { values: { resolution: { inputIds: string[] } }[] } }[];
      }[];
    };
    missingSelectorInput.boons[1]!.samples[0]!.result.values[1]!.resolution.inputIds = [
      "LuckMultiplier",
    ];
    assert.throws(
      () => validateRuntimeBoonReport(missingSelectorInput),
      /processed variant selector input/u,
    );
  });

  it("retains failed runtime samples as explicit coverage issues", () => {
    const value = structuredClone(runtimeReport()) as unknown as {
      boons: { samples: unknown[] }[];
    };
    value.boons[0]!.samples = [
      {
        rarity: "Common",
        endpoint: "fixed",
        level: 1,
        context: { mode: "player-independent", elementCounts: [] },
        result: { status: "error", message: "Synthetic extraction failure." },
      },
    ];
    const normalized = normalizeRuntimeBoons(validateRuntimeBoonReport(value));

    assert.equal(normalized.coverage.complete, false);
    assert.equal(normalized.coverage.failedSampleCount, 1);
    assert.deepEqual(
      normalized.coverage.issues.map((issue) => issue.code),
      ["failed-runtime-sample", "missing-runtime-sample"],
    );
  });

  it("retains missing player-visible references as coverage issues", () => {
    const value = structuredClone(runtimeReport()) as unknown as {
      boons: { mechanics: Record<string, unknown> }[];
    };
    delete value.boons[1]!.mechanics.BurstCount;
    const normalized = normalizeRuntimeBoons(validateRuntimeBoonReport(value));

    assert.equal(normalized.coverage.complete, false);
    assert.deepEqual(
      normalized.coverage.issues.map((issue) => issue.code),
      ["missing-player-visible-reference"],
    );
    assert.match(normalized.coverage.issues[0]!.detail, /TraitData\.DuoBoon\.BurstCount/u);
  });
});

describe("runtime boon acquisition", () => {
  it("binds a runtime report to matching source evidence and finalizes local outputs", async () => {
    await withTemporaryDirectory(async (directory) => {
      const sourceDirectory = join(directory, "source");
      await writeSourceAcquisition(sourceDirectory);
      const sourceManifestContent = await readFile(join(sourceDirectory, "manifest.json"), "utf8");
      const report = runtimeReport();
      const boundReport = {
        ...report,
        game: { ...report.game, sourceManifestSha256: hash(sourceManifestContent) },
      };
      const reportPath = await writeRuntimeRun(join(directory, "runtime-run"), boundReport);

      const result = await createRuntimeBoonAcquisition({
        reportPath,
        sourceAcquisitionDirectory: sourceDirectory,
        outputRoot: join(directory, ".local", "boons"),
        now: () => new Date("2026-08-19T00:00:00.000Z"),
      });

      assert.equal(result.boonCount, 2);
      assert.equal(result.coverageComplete, true);
      const completion = JSON.parse(
        await readFile(join(result.directory, "complete.json"), "utf8"),
      ) as { schema: string };
      assert.equal(completion.schema, "neodes2-boon-acquisition-completion-2");
      assert.match(await readFile(join(result.directory, "boons.json"), "utf8"), /Flutter Strike/u);
      assert.match(await readFile(join(result.directory, "coverage.md"), "utf8"), /Status: complete/u);
    });
  });

  it("rejects runtime data from a different game package", async () => {
    await withTemporaryDirectory(async (directory) => {
      const sourceDirectory = join(directory, "source");
      await writeSourceAcquisition(sourceDirectory);
      const sourceManifestContent = await readFile(join(sourceDirectory, "manifest.json"), "utf8");
      const report = runtimeReport({ packageVersion: "different" });
      const reportPath = await writeRuntimeRun(
        join(directory, "runtime-run"),
        {
          ...report,
          game: { ...report.game, sourceManifestSha256: hash(sourceManifestContent) },
        },
      );

      await assert.rejects(
        createRuntimeBoonAcquisition({
          reportPath,
          sourceAcquisitionDirectory: sourceDirectory,
          outputRoot: join(directory, ".local", "boons"),
        }),
        /package version/u,
      );
    });
  });

  it("rejects a report without matching finalization metadata", async () => {
    await withTemporaryDirectory(async (directory) => {
      const sourceDirectory = join(directory, "source");
      await writeSourceAcquisition(sourceDirectory);
      const reportPath = join(directory, "runtime-report.json");
      await writeFile(reportPath, json(runtimeReport()));

      await assert.rejects(
        createRuntimeBoonAcquisition({
          reportPath,
          sourceAcquisitionDirectory: sourceDirectory,
          outputRoot: join(directory, ".local", "boons"),
        }),
        /manifest\.json/u,
      );
    });
  });
});
