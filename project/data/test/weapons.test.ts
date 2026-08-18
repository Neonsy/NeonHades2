import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  auditWeaponSources,
  createRuntimeWeaponAcquisition,
  normalizeRuntimeWeapons,
  preflightWeaponExporter,
  validateRuntimeWeaponReport,
  type RuntimeBoonSample,
  type RuntimeWeaponReport,
} from "../src/index.js";

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

function runtimeReport(): RuntimeWeaponReport {
  const rarities = ["Common", "Rare", "Epic", "Heroic", "Legendary"];
  return {
    schema: "neodes2-weapon-runtime-1",
    exporterVersion: "0.3.2",
    generatedAtUnixSeconds: 1_787_000_000,
    language: "en",
    game: {
      steamBuildId: "24556151",
      executableVersion: "139671",
      packageVersion: "138174",
      acquisitionId: "sha256:source-acquisition",
      sourceManifestSha256: "source-manifest-hash",
    },
    sourceTables: ["TraitData", "WeaponData", "WeaponSets", "WeaponShopItemData"],
    localizationFiles: ["Content/Game/Text/en/TraitText.en.sjson"],
    weapons: [
      {
        id: "SyntheticWeapon",
        displayName: "Synthetic weapon",
        description: "A test weapon.",
        unlockCosts: [{ resourceId: "Ore", amount: 2 }],
        unlockRequirements: {},
        linkedWeaponIds: [],
        linkedIdsWithoutWeaponData: [],
        weaponDataIds: ["SyntheticWeapon"],
        weaponData: { SyntheticWeapon: { Damage: 10 } },
        attackPatternObservationRequired: true,
        evidence: {
          localizationPath: "Content/Game/Text/en/TraitText.en.sjson:SyntheticWeapon",
          runtimePaths: [
            "WeaponData.SyntheticWeapon",
            "WeaponSets.HeroWeaponSets.SyntheticWeapon",
            "WeaponShopItemData.SyntheticWeapon",
          ],
        },
      },
    ],
    aspects: [
      {
        id: "SyntheticAspect",
        weaponId: "SyntheticWeapon",
        displayName: "Synthetic aspect",
        description: "Gain {$TooltipData.ExtractData.Value} power.",
        baseAspect: true,
        ranks: rarities.map((rarity, index) => ({
          rank: index + 1,
          rarity,
          shopItemId: index === 0 ? null : `SyntheticAspect${index + 1}`,
          costs: index === 0 ? [] : [{ resourceId: "RankResource", amount: index }],
          requirements: {},
          runtimePath: `TraitData.SyntheticAspect.${rarity}`,
        })),
        mechanics: {
          ExtractValues: [{ ExtractAs: "Value", Key: "ReportedValue" }],
        },
        samples: rarities.map(sample),
        evidence: {
          localizationPath: "Content/Game/Text/en/TraitText.en.sjson:SyntheticAspect",
          runtimePaths: ["TraitData.SyntheticAspect"],
        },
      },
    ],
    hammers: [
      {
        id: "SyntheticHammer",
        weaponId: "SyntheticWeapon",
        displayName: "Synthetic Hammer",
        description: "Gain {$TooltipData.ExtractData.Value} power.",
        requirements: {},
        compatibility: {
          allowedAspectIds: ["SyntheticAspect"],
          excludedAspectIds: [],
          requiredAspectIds: [],
          incompatibleHammerIds: [],
        },
        mechanics: {
          ExtractValues: [{ ExtractAs: "Value", Key: "ReportedValue" }],
        },
        samples: [sample("Common")],
        evidence: {
          localizationPath: "Content/Game/Text/en/TraitText.en.sjson:SyntheticHammer",
          runtimePaths: ["TraitData.SyntheticHammer"],
        },
      },
    ],
  };
}

async function withTemporaryDirectory(
  run: (directory: string) => Promise<void>,
): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), "neodes2-weapons-test-"));
  try {
    await run(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

const sourceFamilies = [
  ["WeaponStaffSwing", "Staff", "TraitData_Staff.lua"],
  ["WeaponDagger", "Dagger", "TraitData_Dagger.lua"],
  ["WeaponTorch", "Torch", "TraitData_Torch.lua"],
  ["WeaponAxe", "Axe", "TraitData_Axe.lua"],
  ["WeaponLob", "Lob", "TraitData_Lob.lua"],
  ["WeaponSuit", "Suit", "TraitData_Suit.lua"],
] as const;

const sourceAspects = sourceFamilies.flatMap(([weapon, prefix]) =>
  ["Base", "One", "Two", "Three"].map((suffix) => ({
    id: `${prefix}${suffix}Aspect`,
    weapon,
    base: suffix === "Base",
  })),
);

async function writeSyntheticWeaponSources(directory: string): Promise<void> {
  const scripts = join(directory, "sources", "Content", "Scripts");
  const text = join(directory, "sources", "Content", "Game", "Text", "en");
  await mkdir(scripts, { recursive: true });
  await mkdir(text, { recursive: true });
  const shopRecords = [
    ...sourceFamilies.map(([weapon]) => `${weapon} = { Cost = {}, },`),
    ...sourceAspects
      .filter((aspect) => !aspect.base)
      .map((aspect) => `${aspect.id} = { WeaponName = "${aspect.weapon}", Cost = {}, },`),
    ...sourceAspects.flatMap((aspect) =>
      [2, 3, 4, 5].map(
        (rank) =>
          `${aspect.id}${rank} = { WeaponName = "${aspect.weapon}", TraitUpgrade = "${aspect.id}", Cost = { Ore = ${rank}, }, },`,
      ),
    ),
  ];
  await writeFile(
    join(scripts, "WeaponShopData.lua"),
    `WeaponShopItemData = {\n${shopRecords.join("\n")}\n}\n`,
  );
  await writeFile(
    join(scripts, "TraitData_Aspect.lua"),
    `TraitSetData.Aspects = {\n${sourceAspects
      .map(
        (aspect) =>
          `${aspect.id} = { RequiredWeapon = "${aspect.weapon}", ExtractValues = { { ExtractAs = "Value", Format = "Percent", BaseType = "TraitData", }, }, },`,
      )
      .join("\n")}\n}\n`,
  );
  const localizationEntries = [
    ...sourceFamilies.map(([weapon]) => ({ id: weapon })),
    ...sourceAspects,
    ...sourceFamilies.map(([, prefix]) => ({ id: `${prefix}SyntheticHammer` })),
  ];
  await writeFile(
    join(text, "TraitText.en.sjson"),
    localizationEntries
      .map(
        (entry) =>
          `    {\n      Id = "${entry.id}"\n      DisplayName = "Synthetic"\n      Description = "Gain {$TooltipData.ExtractData.Value} power."\n    }`,
      )
      .join("\n"),
  );
  await Promise.all(
    sourceFamilies.map(async ([weapon, prefix, file]) =>
      writeFile(
        join(scripts, file),
        `OverwriteTableKeys( TraitData, {\n${prefix}HammerTrait = { CodexWeapon = "${weapon}", },\n${prefix}SyntheticHammer = { InheritFrom = { "${prefix}HammerTrait" }, ExtractValues = { { ExtractAs = "Value", Format = "Percent", BaseType = "TraitData", }, }, },\n})\n`,
      ),
    ),
  );
}

function runtimeReportForSourceFixture(): RuntimeWeaponReport {
  const template = runtimeReport();
  return {
    ...template,
    weapons: sourceFamilies
      .map(([weapon]) => ({
        ...structuredClone(template.weapons[0]!),
        id: weapon,
        weaponDataIds: [weapon],
        weaponData: { [weapon]: { Damage: 10 } },
        evidence: {
          ...structuredClone(template.weapons[0]!.evidence),
          runtimePaths: [
            `WeaponData.${weapon}`,
            `WeaponSets.HeroWeaponSets.${weapon}`,
            `WeaponShopItemData.${weapon}`,
          ],
        },
      }))
      .sort((left, right) => left.id.localeCompare(right.id)),
    aspects: sourceAspects
      .map((aspect) => ({
        ...structuredClone(template.aspects[0]!),
        id: aspect.id,
        weaponId: aspect.weapon,
        baseAspect: aspect.base,
        ranks: template.aspects[0]!.ranks.map((rank) => ({
          ...structuredClone(rank),
          shopItemId:
            rank.rank === 1
              ? aspect.base
                ? null
                : aspect.id
              : `${aspect.id}${rank.rank}`,
        })),
      }))
      .sort((left, right) => left.id.localeCompare(right.id)),
    hammers: sourceFamilies
      .map(([weapon, prefix]) => ({
        ...structuredClone(template.hammers[0]!),
        id: `${prefix}SyntheticHammer`,
        weaponId: weapon,
        compatibility: {
          allowedAspectIds: sourceAspects
            .filter((aspect) => aspect.weapon === weapon)
            .map((aspect) => aspect.id)
            .sort(),
          excludedAspectIds: [],
          requiredAspectIds: [],
          incompatibleHammerIds: [],
        },
      }))
      .sort((left, right) => left.id.localeCompare(right.id)),
  };
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
  await writeSyntheticWeaponSources(directory);
  return hash(manifest);
}

async function writeRuntimeRun(
  directory: string,
  report: RuntimeWeaponReport,
): Promise<string> {
  await mkdir(directory, { recursive: true });
  const content = json(report);
  const reportSha256 = hash(content);
  const reportPath = join(directory, "runtime-report.json");
  await writeFile(reportPath, content);
  await writeFile(
    join(directory, "manifest.json"),
    json({
      schema: "neodes2-weapon-runtime-manifest-1",
      exporterVersion: report.exporterVersion,
      reportFile: "runtime-report.json",
      reportSha256,
    }),
  );
  await writeFile(
    join(directory, "complete.json"),
    json({ schema: "neodes2-weapon-runtime-completion-1", reportSha256 }),
  );
  return reportPath;
}

describe("weapon runtime report", () => {
  it("validates and normalizes deterministic weapon coverage", () => {
    const report = validateRuntimeWeaponReport(runtimeReport());
    const first = normalizeRuntimeWeapons(report);
    const second = normalizeRuntimeWeapons(report);

    assert.deepEqual(first, second);
    assert.equal(first.coverage.complete, true);
    assert.equal(first.coverage.weaponCount, 1);
    assert.equal(first.coverage.aspectCount, 1);
    assert.equal(first.coverage.rankCount, 5);
    assert.equal(first.coverage.hammerCount, 1);
    assert.equal(first.coverage.resolvedValueCount, 6);
    assert.deepEqual(first.coverage.attackPatternsPendingObservation, ["SyntheticWeapon"]);
  });

  it("rejects broken ranks and invalid compatibility", () => {
    const brokenRanks = structuredClone(runtimeReport()) as unknown as {
      aspects: { ranks: { rank: number }[] }[];
    };
    brokenRanks.aspects[0]!.ranks[4]!.rank = 6;
    assert.throws(() => validateRuntimeWeaponReport(brokenRanks), /ranks 1 through 5/u);

    const invalidCompatibility = structuredClone(runtimeReport()) as unknown as {
      hammers: { compatibility: { requiredAspectIds: string[] } }[];
    };
    invalidCompatibility.hammers[0]!.compatibility.requiredAspectIds = ["MissingAspect"];
    assert.throws(
      () => validateRuntimeWeaponReport(invalidCompatibility),
      /invalid aspect reference/u,
    );
  });

  it("accepts linked engine weapons without WeaponData and rejects invalid partitions", () => {
    const report = structuredClone(runtimeReport()) as unknown as {
      weapons: {
        linkedWeaponIds: string[];
        linkedIdsWithoutWeaponData: string[];
      }[];
    };
    const weapon = report.weapons[0]!;
    weapon.linkedWeaponIds = ["SyntheticNativeWeapon"];
    weapon.linkedIdsWithoutWeaponData = ["SyntheticNativeWeapon"];
    assert.doesNotThrow(() => validateRuntimeWeaponReport(report));

    weapon.linkedIdsWithoutWeaponData = ["UnlinkedWeapon"];
    assert.throws(
      () => validateRuntimeWeaponReport(report),
      /linkedIdsWithoutWeaponData contains invalid id/u,
    );
  });

  it("reports missing tooltip and rank samples as coverage failures", () => {
    const value = structuredClone(runtimeReport()) as unknown as {
      aspects: { samples: RuntimeBoonSample[] }[];
    };
    value.aspects[0]!.samples = value.aspects[0]!.samples.filter(
      (entry) => entry.rarity !== "Legendary",
    );
    const aspect = value.aspects[0] as unknown as { description: string };
    aspect.description += " {$TooltipData.ExtractData.Missing}";
    const normalized = normalizeRuntimeWeapons(validateRuntimeWeaponReport(value));

    assert.equal(normalized.coverage.complete, false);
    assert.deepEqual(
      normalized.coverage.issues.map((issue) => issue.code),
      ["missing-rank-sample", "missing-tooltip-value"],
    );
  });
});

describe("weapon runtime acquisition", () => {
  it("binds finalized runtime data to its source acquisition", async () => {
    await withTemporaryDirectory(async (directory) => {
      const sourceDirectory = join(directory, "source");
      const sourceManifestSha256 = await writeSourceIdentity(sourceDirectory);
      const report = runtimeReportForSourceFixture();
      const boundReport = {
        ...report,
        game: { ...report.game, sourceManifestSha256 },
      };
      const reportPath = await writeRuntimeRun(join(directory, "runtime"), boundReport);
      const result = await createRuntimeWeaponAcquisition({
        reportPath,
        sourceAcquisitionDirectory: sourceDirectory,
        outputRoot: join(directory, ".local", "weapons"),
        now: () => new Date("2026-08-19T00:00:00.000Z"),
      });

      assert.equal(result.weaponCount, 6);
      assert.equal(result.aspectCount, 24);
      assert.equal(result.hammerCount, 6);
      assert.equal(result.coverageComplete, true);
      assert.match(
        await readFile(join(result.directory, "weapons.json"), "utf8"),
        /Synthetic weapon/u,
      );
      const completion = JSON.parse(
        await readFile(join(result.directory, "complete.json"), "utf8"),
      ) as { schema: string };
      assert.equal(completion.schema, "neodes2-weapon-acquisition-completion-1");
    });
  });

  it("rejects weapon runtime data from a different package", async () => {
    await withTemporaryDirectory(async (directory) => {
      const sourceDirectory = join(directory, "source");
      const sourceManifestSha256 = await writeSourceIdentity(sourceDirectory);
      const report = runtimeReportForSourceFixture();
      const reportPath = await writeRuntimeRun(join(directory, "runtime"), {
        ...report,
        game: { ...report.game, packageVersion: "different", sourceManifestSha256 },
      });

      await assert.rejects(
        createRuntimeWeaponAcquisition({
          reportPath,
          sourceAcquisitionDirectory: sourceDirectory,
          outputRoot: join(directory, ".local", "weapons"),
        }),
        /package version/u,
      );
    });
  });
});

describe("weapon static source audit", () => {
  it("accepts a structurally complete synthetic source set", async () => {
    await withTemporaryDirectory(async (directory) => {
      const scripts = join(directory, "sources", "Content", "Scripts");
      const text = join(directory, "sources", "Content", "Game", "Text", "en");
      await mkdir(scripts, { recursive: true });
      await mkdir(text, { recursive: true });
      const families = [
        ["WeaponStaffSwing", "Staff", "TraitData_Staff.lua"],
        ["WeaponDagger", "Dagger", "TraitData_Dagger.lua"],
        ["WeaponTorch", "Torch", "TraitData_Torch.lua"],
        ["WeaponAxe", "Axe", "TraitData_Axe.lua"],
        ["WeaponLob", "Lob", "TraitData_Lob.lua"],
        ["WeaponSuit", "Suit", "TraitData_Suit.lua"],
      ] as const;
      const aspects = families.flatMap(([weapon, prefix]) =>
        ["Base", "One", "Two", "Three"].map((suffix) => ({
          id: `${prefix}${suffix}Aspect`,
          weapon,
          base: suffix === "Base",
        })),
      );
      const shopRecords = [
        ...families.map(([weapon]) => `${weapon} = { Cost = {}, },`),
        ...aspects
          .filter((aspect) => !aspect.base)
          .map((aspect) => `${aspect.id} = { WeaponName = "${aspect.weapon}", Cost = {}, },`),
        ...aspects.flatMap((aspect) =>
          [2, 3, 4, 5].map(
            (rank) =>
              `${aspect.id}${rank} = { WeaponName = "${aspect.weapon}", TraitUpgrade = "${aspect.id}", Cost = { Ore = ${rank}, }, },`,
          ),
        ),
      ];
      await writeFile(
        join(scripts, "WeaponShopData.lua"),
        `WeaponShopItemData = {\n${shopRecords.join("\n")}\n}\n`,
      );
      await writeFile(
        join(scripts, "TraitData_Aspect.lua"),
        `TraitSetData.Aspects = {\n${aspects
          .map(
            (aspect) =>
              `${aspect.id} = { RequiredWeapon = "${aspect.weapon}", ExtractValues = { { ExtractAs = "Value", Format = "Percent", BaseType = "TraitData", }, }, },`,
          )
          .join("\n")}\n}\n`,
      );
      const localizationEntries = [
        ...families.map(([weapon]) => ({ id: weapon })),
        ...aspects,
        ...families.map(([, prefix]) => ({ id: `${prefix}SyntheticHammer` })),
      ];
      await writeFile(
        join(text, "TraitText.en.sjson"),
        localizationEntries
          .map(
            (entry) =>
              `    {\n      Id = "${entry.id}"\n      DisplayName = "Synthetic"\n      Description = "Gain {$TooltipData.ExtractData.Value} power."\n    }`,
          )
          .join("\n"),
      );
      await Promise.all(
        families.map(async ([weapon, prefix, file]) =>
          writeFile(
            join(scripts, file),
            `OverwriteTableKeys( TraitData, {\n${prefix}HammerTrait = { CodexWeapon = "${weapon}", },\n${prefix}SyntheticHammer = { InheritFrom = { "${prefix}HammerTrait" }, ExtractValues = { { ExtractAs = "Value", Format = "Percent", BaseType = "TraitData", }, }, },\n})\n`,
          ),
        ),
      );

      const audit = await auditWeaponSources(directory);
      assert.equal(audit.complete, true);
      assert.equal(audit.weaponIds.length, 6);
      assert.equal(audit.aspects.length, 24);
      assert.equal(audit.rankShopItemCount, 96);
      assert.equal(audit.hammers.length, 6);

      const preflight = await preflightWeaponExporter(
        join(process.cwd(), "mod", "neodes2-boon-exporter"),
        directory,
      );
      assert.equal(preflight.complete, true);
      assert.equal(preflight.exporterVersion, "0.3.2");
    });
  });
});
