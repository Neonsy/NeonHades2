import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { validateRuntimeGuideReport } from "../src/index.js";

function runtimeReport(): Record<string, unknown> {
  const emptyGroups = {
    routes: [],
    regions: [],
    rooms: [],
    encounters: [],
    enemies: [],
    rewards: [],
    consumables: [],
    resources: [],
    statusEffects: [],
    elementalTraits: [],
    oathConditions: [],
    bounties: [],
    bountyOrder: [],
    relationships: [],
    prophecies: [],
    narrative: [],
    outros: [],
    outroPriorities: [],
    achievements: [],
    runClearMessages: [],
  };
  return {
    schema: "neodes2-guide-runtime-1",
    exporterVersion: "0.6.5",
    generatedAtUnixSeconds: 1_787_000_000,
    language: "en",
    game: {
      steamBuildId: "24556151",
      executableVersion: "139671",
      packageVersion: "138174",
      acquisitionId: "sha256:source-acquisition",
      sourceManifestSha256: "source-manifest-hash",
    },
    ...emptyGroups,
    namedRequirements: [
      {
        id: "SyntheticRequirement",
        displayName: "",
        description: "",
        data: [{ PathTrue: ["GameState", "TextLinesRecord", "SyntheticEvent"] }],
        omissions: [],
        evidence: {
          runtimePath: "NamedRequirementsData.SyntheticRequirement",
          localizationPath: "",
        },
      },
    ],
    sourceTables: ["NamedRequirementsData"],
  };
}

describe("guide runtime report", () => {
  it("accepts array-shaped requirement data and normalizes empty optional text", () => {
    const report = validateRuntimeGuideReport(runtimeReport());
    const requirement = report.namedRequirements[0];

    assert.deepEqual(requirement?.data, [
      { PathTrue: ["GameState", "TextLinesRecord", "SyntheticEvent"] },
    ]);
    assert.equal(requirement?.displayName, null);
    assert.equal(requirement?.description, null);
    assert.equal(requirement?.evidence.localizationPath, null);
  });

  it("rejects non-JSON requirement values", () => {
    const report = runtimeReport();
    const requirements = report.namedRequirements as { data: unknown }[];
    requirements[0]!.data = Number.NaN;

    assert.throws(() => validateRuntimeGuideReport(report), /must be an object/u);
  });

  it("rejects unsorted or repeated source table evidence", () => {
    const report = runtimeReport();
    report.sourceTables = ["NamedRequirementsData", "AchievementData", "AchievementData"];

    assert.throws(
      () => validateRuntimeGuideReport(report),
      /must contain unique values in sorted order/u,
    );
  });

  it("validates grouped outro priorities against every exported outro", () => {
    const report = runtimeReport();
    report.outros = [
      {
        id: "Outro_PostTrueEnding01",
        displayName: null,
        description: null,
        data: { GameStateRequirements: [{ PathTrue: ["GameState", "ReachedTrueEnding"] }] },
        omissions: [],
        evidence: { runtimePath: "GameOutroData.Outro_PostTrueEnding01", localizationPath: null },
        classification: "postgame",
      },
    ];
    report.outroPriorities = [["Outro_PostTrueEnding01"]];

    const validated = validateRuntimeGuideReport(report);
    assert.deepEqual(validated.outroPriorities, [["Outro_PostTrueEnding01"]]);

    report.outroPriorities = ["MissingOutro"];
    assert.throws(() => validateRuntimeGuideReport(report), /references missing outro/u);
  });

  it("rejects dialogue prose and voice cues from factual guide records", () => {
    const report = runtimeReport();
    const requirements = report.namedRequirements as { data: unknown }[];
    requirements[0]!.data = { Text: "A full line of game dialogue." };
    assert.throws(() => validateRuntimeGuideReport(report), /contains excluded prose/u);

    requirements[0]!.data = { Cue: "/VO/Storyteller_0001" };
    assert.throws(() => validateRuntimeGuideReport(report), /contains excluded presentation data/u);
  });

  it("validates processed encounter-aid samples", () => {
    const report = runtimeReport();
    report.encounterAidTraits = [{
      id: "ArachneArmorBoon",
      displayName: "Silken Sash",
      description: "Gain armor.",
      data: {
        providerId: "Arachne",
        trait: {},
        samples: [{
          rarity: "Common",
          endpoint: "fixed",
          level: 1,
          context: { mode: "player-independent", elementCounts: [] },
          result: { status: "ok", values: [] },
        }],
      },
      omissions: [],
      evidence: { runtimePath: "TraitData.ArachneArmorBoon", localizationPath: "TraitText.en.sjson" },
    }];

    assert.equal(validateRuntimeGuideReport(report).encounterAidTraits.length, 1);
    const records = report.encounterAidTraits as { data: { samples: unknown[] } }[];
    records[0]!.data.samples = [{}];
    assert.throws(() => validateRuntimeGuideReport(report), /context must be an object/u);
  });
});
