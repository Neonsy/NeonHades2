import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, it } from "node:test";
import { tmpdir } from "node:os";

import {
  compileRequirementGraph,
  evaluateFormula,
  parseCalculationRules,
  readManualEvidenceLedger,
  validateManualEvidenceLedger,
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
      weapons: {
        weapons: [{ id: "WeaponA", name: "Weapon A" }],
        aspects: [{ id: "AspectA", weaponId: "WeaponA", name: "Aspect A", mechanics: {}, rankEffects: [] }],
        hammers: [{ id: "HammerA", weaponId: "WeaponA", name: "Hammer A", mechanics: {}, effects: [] }],
      },
      arcana: { cards: [] },
      loadouts: {
        keepsakes: [], familiars: [],
        hexes: [{ id: "HexA", displayName: "Hex A", mechanics: {}, baseEffects: [], talents: [] }],
        incantations: [{ id: "IncantationA", displayName: "Incantation A" }],
      },
      guide: {
        namedRequirements: [],
        achievements: [{ id: "AchievementA", displayName: "Achievement A" }],
        enemies: [{ id: "EnemyA", displayName: "Enemy A" }],
        narrative: [{ id: "NarrativeA", displayName: "Narrative A" }],
        outros: [{ id: "OutroA", displayName: "Outro A" }],
        runClearMessages: [{ id: "RunClearA", displayName: "Run Clear A" }],
        oathConditions: [{ id: "OathA", displayName: "Oath A" }],
        prophecies: [{ id: "ProphecyA", displayName: "Prophecy A" }],
        relationships: [{ id: "RelationshipA", displayName: "Relationship A" }],
        statusElements: [{ id: "StatusA", displayName: "Status A" }],
      },
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
    const report = verifyDataset(
      calculatedDataset("round(((value - 1) * 100), 0)"),
      calculationRules,
      "sha256:combined-dataset",
    );
    assert.equal(report.automatedComplete, true);
    assert.equal(report.manualComplete, false);
    assert.equal(report.phaseComplete, false);
    assert.deepEqual(report.manualTasks.map((task) => task.id), [
      "foundation/record-metadata/spoiler-level",
      "mechanics/combat-mechanic/behavior",
      "mechanics/weapon-aspect/attack-pattern",
      "world-progression/achievement/name-description",
      "world-progression/achievement/trigger",
      "world-progression/narrative-milestone/completion-evidence",
      "world-progression/narrative-milestone/kind",
      "world-progression/narrative-milestone/requirements",
      "world-progression/prophecy/name",
      "world-progression/prophecy/objectives",
      "world-progression/prophecy/rewards",
      "world-progression/prophecy/unlock-requirements",
      "world-progression/relationship/character",
      "world-progression/relationship/gift-track",
      "world-progression/relationship/rewards",
    ]);
    assert.ok(report.manualTasks.every((task) => task.claimKind !== "editorial"));
    assert.deepEqual(report.observationPlan.sessions.map((session) => session.id), ["training-combat", "spoiler-review"]);
    assert.equal(report.manualEvidence.requiredCheckCount, 15);
    assert.equal(report.manualEvidence.pendingCheckCount, report.observationPlan.assignments.length);
    assert.equal(report.sourceDatasetAcquisitionId, "sha256:combined-dataset");
    assert.equal(report.observationPlan.sourceDatasetAcquisitionId, "sha256:combined-dataset");
  });

  it("requires passing evidence for every planned target before completing Phase 5", async () => {
    const dataset = calculatedDataset("round(((value - 1) * 100), 0)");
    const pending = verifyDataset(dataset, calculationRules, "sha256:combined-dataset");
    const targetSets = new Map(pending.observationPlan.targetSets.map((targetSet) => [targetSet.id, targetSet]));
    const entries = pending.observationPlan.assignments.map((assignment) => ({
      id: `${assignment.taskId}/${assignment.check}`,
      taskId: assignment.taskId,
      check: assignment.check,
      outcome: "pass" as const,
      targetIds: targetSets.get(assignment.targetSetId)!.targets.map((target) => target.id),
      evidence: [{ path: "evidence.txt", sha256: "0".repeat(64) }],
      note: "Verified against the planned targets.",
    })).sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0);
    const root = await mkdtemp(join(tmpdir(), "neodes2-complete-evidence-"));
    const directory = join(root, ".local", "evidence");
    await mkdir(directory, { recursive: true });
    try {
      const evidenceContent = "Complete synthetic manual evidence\n";
      const evidenceHash = createHash("sha256").update(evidenceContent).digest("hex");
      await writeFile(join(directory, "evidence.txt"), evidenceContent, "utf8");
      for (const entry of entries) entry.evidence[0]!.sha256 = evidenceHash;
      const ledger = {
        schema: "neodes2-manual-evidence-1",
        sourceDatasetAcquisitionId: "sha256:combined-dataset",
        entries,
      } as const;
      const ledgerPath = join(directory, "ledger.json");
      await writeFile(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`, "utf8");
      const evidence = await readManualEvidenceLedger(ledgerPath);
      const complete = verifyDataset(dataset, calculationRules, "sha256:combined-dataset", evidence);
      assert.equal(complete.manualComplete, true);
      assert.equal(complete.phaseComplete, true);
      assert.ok(complete.manualTasks.every((task) => task.status === "complete"));

      const unknownTargetLedger = structuredClone(ledger);
      unknownTargetLedger.entries[0]!.targetIds = ["unknown-target"];
      await writeFile(ledgerPath, `${JSON.stringify(unknownTargetLedger, null, 2)}\n`, "utf8");
      const unknownTargetEvidence = await readManualEvidenceLedger(ledgerPath);
      assert.throws(
        () => verifyDataset(dataset, calculationRules, "sha256:combined-dataset", unknownTargetEvidence),
        /references unknown target/u,
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("manual evidence ledger", () => {
  it("reads hash-checked local evidence and rejects traversal or changed content", async () => {
    const root = await mkdtemp(join(tmpdir(), "neodes2-manual-evidence-"));
    const directory = join(root, ".local", "evidence");
    await mkdir(directory, { recursive: true });
    try {
      const evidenceContent = "Observed result\n";
      const evidenceHash = createHash("sha256").update(evidenceContent).digest("hex");
      await writeFile(join(directory, "observation.txt"), evidenceContent, "utf8");
      const ledger = {
        schema: "neodes2-manual-evidence-1",
        sourceDatasetAcquisitionId: "sha256:source",
        entries: [{
          id: "combat-observation",
          taskId: "mechanics/combat-mechanic/behavior",
          check: "observation",
          outcome: "pass",
          targetIds: ["attack"],
          evidence: [{ path: "observation.txt", sha256: evidenceHash }],
          note: "Attack behavior matched the normalized record.",
        }],
      };
      const ledgerPath = join(directory, "ledger.json");
      await writeFile(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`, "utf8");
      const verified = await readManualEvidenceLedger(ledgerPath);
      assert.equal(verified.evidenceFileCount, 1);
      assert.equal(verified.ledger.entries[0]?.id, "combat-observation");

      await writeFile(join(directory, "observation.txt"), "Changed\n", "utf8");
      await assert.rejects(() => readManualEvidenceLedger(ledgerPath), /hash changed/u);

      const traversal = structuredClone(ledger);
      traversal.entries[0]!.evidence[0]!.path = "../outside.txt";
      assert.throws(() => validateManualEvidenceLedger(traversal), /normalized relative path/u);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
