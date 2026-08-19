import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  compileRequirementGraph,
  evaluateFormula,
  parseCalculationRules,
  verifyDataset,
  verifyCalculations,
  type CalculationRules,
  type CombinedDataset,
} from "../src/index.js";

function dataset(namedRequirements: CombinedDataset["domains"]["guide"]["namedRequirements"]): CombinedDataset {
  return {
    schema: "neodes2-dataset-1",
    source: {
      acquisitionId: "sha256:source",
      sourceManifestSha256: "source-manifest",
      exporterVersion: "1.0.0",
      steamBuildId: "1",
      executableVersion: "2",
      packageVersion: "3",
    },
    domainAcquisitionIds: {
      arcana: "sha256:arcana", boons: "sha256:boons", guide: "sha256:guide",
      loadouts: "sha256:loadouts", weapons: "sha256:weapons",
    },
    domains: {
      guide: {
        schema: "neodes2-guide-data-1",
        source: { acquisitionId: "sha256:source", exporterVersion: "1.0.0", steamBuildId: "1", executableVersion: "2", packageVersion: "3" },
        routes: [], regions: [], rooms: [], encounters: [], enemies: [], rewards: [], consumables: [], resources: [],
        statusElements: [], oathConditions: [], bounties: [], bountyOrder: [], relationships: [], prophecies: [],
        narrative: [], outros: [], outroPriorities: [], achievements: [], namedRequirements, runClearMessages: [],
      },
    } as unknown as CombinedDataset["domains"],
  };
}

function requirement(id: string, data: CombinedDataset["domains"]["guide"]["namedRequirements"][number]["data"]) {
  return {
    id, displayName: null, description: null, data, omissions: [],
    evidence: { runtimePath: `NamedRequirementsData.${id}`, localizationPath: null },
  };
}

describe("named requirement graph", () => {
  it("resolves positive and negative transitive dependencies and external usages", () => {
    const graph = compileRequirementGraph(dataset([
      requirement("A", [{ NamedRequirements: ["B"] }]),
      requirement("B", [{ NamedRequirementsFalse: "C" }]),
      requirement("C", []),
    ]));
    assert.equal(graph.complete, true);
    assert.deepEqual(graph.nodes.find((node) => node.id === "A")?.transitiveDependencyIds, ["B", "C"]);
    assert.deepEqual(graph.nodes.find((node) => node.id === "B")?.directDependencies, [{ id: "C", polarity: "negative" }]);
  });

  it("reports unresolved references, malformed reference values, and cycles", () => {
    const graph = compileRequirementGraph(dataset([
      requirement("A", [{ NamedRequirements: ["B"] }]),
      requirement("B", [{ NamedRequirements: "A" }, { NamedRequirementsFalse: 3 }]),
      requirement("C", [{ NamedRequirements: "Missing" }]),
    ]));
    assert.equal(graph.complete, false);
    assert.deepEqual(graph.cycles, [["A", "B"]]);
    assert.deepEqual(new Set(graph.issues.map((issue) => issue.code)), new Set(["cycle", "invalid-reference", "unresolved-reference"]));
  });
});

const calculationRules: CalculationRules = {
  automaticProperties: {},
  rarityOrder: ["Common", "Rare", "Epic", "Heroic"],
};

function calculatedDataset(variantExpression: string): CombinedDataset {
  const sample = {
    rarity: "Common",
    endpoint: "fixed",
    level: 1,
    context: { mode: "player-independent", elementCounts: [] },
    result: {
      status: "ok",
      values: [
        {
          id: "PercentValue",
          source: { kind: "processed-trait", key: "ReportedPercent", runtimePath: "Trait.Percent", value: 0.25 },
          staticInputs: [],
          resolution: { kind: "resolved", value: 25 },
        },
        {
          id: "VariantValue",
          source: {
            kind: "processed-trait-variants",
            key: "ReportedVariant",
            selectorInputId: "WeaponName",
            variants: [
              { selectorValue: "WeaponA", runtimePaths: ["Trait.A"], value: 1.2 },
              { selectorValue: "WeaponB", runtimePaths: ["Trait.B"], value: 1.4 },
            ],
          },
          staticInputs: [],
          resolution: { kind: "contextual", expression: variantExpression, inputIds: ["WeaponName"] },
        },
      ],
    },
  } as const;
  return {
    schema: "neodes2-dataset-1",
    source: {
      acquisitionId: "sha256:source", sourceManifestSha256: "source-manifest", exporterVersion: "1.0.0",
      steamBuildId: "1", executableVersion: "2", packageVersion: "3",
    },
    domainAcquisitionIds: {
      arcana: "sha256:arcana", boons: "sha256:boons", guide: "sha256:guide",
      loadouts: "sha256:loadouts", weapons: "sha256:weapons",
    },
    domains: {
      boons: {
        boons: [{
          effects: { ExtractValues: [
            { ExtractAs: "PercentValue", Key: "ReportedPercent", Format: "Percent" },
            { ExtractAs: "VariantValue", Key: "ReportedVariant", Format: "PercentDelta" },
          ] },
          levelScaling: [sample],
        }],
      },
      weapons: { aspects: [], hammers: [] },
      arcana: { cards: [] },
      loadouts: { keepsakes: [], familiars: [], hexes: [] },
      guide: { namedRequirements: [] },
    } as unknown as CombinedDataset["domains"],
  };
}

describe("calculation verification", () => {
  it("parses calculation rules and evaluates Lua-style formulas without executing code", () => {
    const rules = parseCalculationRules(`AutomaticExtractProperties = {
      Damage = { AddHeroValue = "DamageBonus", },
    }`, `TraitRarityData = { RarityUpgradeOrder = { "Common", "Rare", }, }`);
    assert.deepEqual(rules, {
      automaticProperties: { Damage: { operation: "add", inputId: "DamageBonus" } },
      rarityOrder: ["Common", "Rare"],
    });
    assert.equal(evaluateFormula("round(((Override ~= 1 and Override or value) - 1) * 100, 1)", {
      Override: 1.5,
      value: 1.2,
    }), 50);
  });

  it("recalculates resolved values and exercises every selector variant", () => {
    const report = verifyCalculations(calculatedDataset("round(((value - 1) * 100), 0)"), calculationRules);
    assert.equal(report.complete, true);
    assert.equal(report.valueCount, 2);
    assert.equal(report.resolvedValueCount, 1);
    assert.equal(report.contextualValueCount, 1);
    assert.equal(report.boundaryCaseCount, 2);
  });

  it("rejects a selector name used as a numeric source value", () => {
    const report = verifyCalculations(calculatedDataset("round(((WeaponName - 1) * 100), 0)"), calculationRules);
    assert.equal(report.complete, false);
    assert.ok(report.issues.some((issue) => issue.code === "expression-mismatch"));
    assert.ok(report.issues.some((issue) => issue.code === "boundary-evaluation"));
  });

  it("does not claim Phase 5 completion while required manual evidence is absent", () => {
    const report = verifyDataset(calculatedDataset("round(((value - 1) * 100), 0)"), calculationRules);
    assert.equal(report.automatedComplete, true);
    assert.equal(report.manualComplete, false);
    assert.equal(report.phaseComplete, false);
    assert.ok(report.manualTasks.some((task) => task.id === "mechanics/combat-mechanic/behavior"));
    assert.ok(report.manualTasks.some((task) => task.claimKind === "editorial"));
  });
});
