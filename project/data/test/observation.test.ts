import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  parseObservationTrace,
  renderObserverConfig,
  summarizeObservationTrace,
  validateLuaStructure,
  type CombinedDataset,
  type ObservationEvent,
  type ObservationIdentity,
  type VerifiedCombinedDataset,
} from "../src/index.js";

const identity: ObservationIdentity = {
  observerVersion: "0.1.0",
  sourceAcquisitionId: "sha256:source",
  sourceManifestSha256: "source-manifest",
  datasetAcquisitionId: "sha256:dataset",
  datasetSha256: "dataset-hash",
  steamBuildId: "build",
  executableVersion: "executable",
  packageVersion: "package",
};

function event(
  sequence: number,
  kind: ObservationEvent["kind"],
  data: ObservationEvent["event"],
  context: Partial<ObservationEvent["context"]> = {},
): ObservationEvent {
  return {
    schema: "neodes2-observation-event-1",
    sequence,
    kind,
    worldTime: sequence,
    worldTimeUnmodified: sequence,
    context: {
      traitIds: [],
      weaponIds: [],
      ...context,
    },
    event: data,
    ...(sequence === 0 ? { identity } : {}),
  };
}

function traceBytes(events: readonly ObservationEvent[]): Buffer {
  return Buffer.from(`${events.map((entry) => JSON.stringify(entry)).join("\n")}\n`, "utf8");
}

function dataset(): CombinedDataset {
  return {
    schema: "neodes2-dataset-1",
    source: {
      acquisitionId: identity.sourceAcquisitionId,
      sourceManifestSha256: identity.sourceManifestSha256,
      exporterVersion: "exporter",
      steamBuildId: identity.steamBuildId,
      executableVersion: identity.executableVersion,
      packageVersion: identity.packageVersion,
    },
    domainAcquisitionIds: {} as CombinedDataset["domainAcquisitionIds"],
    domains: {
      weapons: {
        aspects: [{ id: "AspectA", weaponId: "WeaponA", name: "Aspect A" }],
      },
      loadouts: {
        hexes: [{
          id: "Laser",
          traitId: "SpellLaserTrait",
          displayName: "Laser",
          mechanics: { PreEquipWeapons: ["WeaponSpellLaser"] },
        }],
      },
      guide: {
        enemies: [{ id: "EnemyA" }],
        statusElements: [
          { id: "Charm", classification: "effect" },
          { id: "ElementalDamageBoon", classification: "element-or-infusion" },
        ],
      },
    } as unknown as CombinedDataset["domains"],
  };
}

describe("observation traces", () => {
  it("parses append-only events and derives review candidates without claiming manual completion", () => {
    const events = [
      event(0, "session-start", {}),
      event(1, "control-pressed", { controlId: "Attack1" }),
      event(2, "weapon-charging", { weaponId: "WeaponA", actorIsHero: true }, {
        activeAspectId: "AspectA",
        traitIds: ["ElementalDamageBoon", "SpellLaserTrait"],
      }),
      event(3, "weapon-fired", { weaponId: "WeaponSpellLaser", actorIsHero: true }, {
        activeAspectId: "AspectA",
        traitIds: ["ElementalDamageBoon", "SpellLaserTrait"],
      }),
      event(4, "effect-applied", { effectId: "Charm", targetName: "EnemyA" }, {
        activeAspectId: "AspectA",
        traitIds: ["ElementalDamageBoon", "SpellLaserTrait"],
      }),
      event(5, "hit", { weaponId: "WeaponA", targetName: "EnemyA", actorIsHero: true }, {
        activeAspectId: "AspectA",
        traitIds: ["ElementalDamageBoon", "SpellLaserTrait"],
      }),
    ];
    const parsed = parseObservationTrace(traceBytes(events));
    const report = summarizeObservationTrace(parsed, dataset());
    assert.equal(report.eventCount, 6);
    const bySet = new Map(report.candidates.map((candidate) => [candidate.targetSetId, candidate]));
    assert.deepEqual(bySet.get("weapon-aspects")?.missingTargetIds, []);
    assert.deepEqual(bySet.get("hexes")?.missingTargetIds, []);
    assert.deepEqual(bySet.get("status-elements")?.missingTargetIds, []);
    assert.deepEqual(bySet.get("enemies")?.missingTargetIds, []);
    assert.ok(bySet.get("core-combat-mechanics")?.observed.some((entry) => entry.targetId === "attack"));
    assert.ok(bySet.get("core-combat-mechanics")?.observed.some((entry) => entry.targetId === "omega"));
    assert.equal("complete" in report, false);
  });

  it("rejects partial lines, sequence gaps, repeated identity, and unknown fields", () => {
    const header = event(0, "session-start", {});
    assert.throws(() => parseObservationTrace(Buffer.from(JSON.stringify(header), "utf8")), /partial line/u);
    assert.throws(
      () => parseObservationTrace(traceBytes([header, event(2, "control-pressed", { controlId: "Attack1" })])),
      /not contiguous/u,
    );
    assert.throws(
      () => parseObservationTrace(traceBytes([header, { ...event(1, "control-pressed", { controlId: "Attack1" }), identity }])),
      /repeats session identity/u,
    );
    const unknown = { ...header, unexpected: true };
    assert.throws(() => parseObservationTrace(Buffer.from(`${JSON.stringify(unknown)}\n`, "utf8")), /unexpected field/u);
  });

  it("does not treat movement charges or familiar-only events as Omega evidence", () => {
    const events = [
      event(0, "session-start", {}),
      event(1, "weapon-charging", { weaponId: "WeaponBlink", actorIsHero: true }, { activeAspectId: "AspectA" }),
      event(2, "weapon-charging", { weaponId: "WeaponSprint", actorIsHero: true }, { activeAspectId: "AspectA" }),
      event(3, "hit", { actorName: "Familiar", targetName: "EnemyA" }, { activeAspectId: "AspectA" }),
    ];
    const report = summarizeObservationTrace(parseObservationTrace(traceBytes(events)), dataset());
    const bySet = new Map(report.candidates.map((candidate) => [candidate.targetSetId, candidate]));
    const coreIds = bySet.get("core-combat-mechanics")?.observed.map((entry) => entry.targetId) ?? [];
    assert.equal(coreIds.includes("omega"), false);
    assert.equal(coreIds.includes("magick"), false);
    assert.equal(bySet.get("weapon-aspects")?.observed[0]?.eventCount, 2);
  });
});

describe("observer deployment inputs", () => {
  it("renders one dataset-bound Lua config", () => {
    const combined = dataset();
    const verified: VerifiedCombinedDataset = {
      acquisitionId: identity.datasetAcquisitionId,
      datasetSha256: identity.datasetSha256,
      manifestSha256: "dataset-manifest",
      dataset: combined,
      validation: {} as VerifiedCombinedDataset["validation"],
    };
    const config = renderObserverConfig(verified);
    assert.match(config, /dataset_acquisition_id = "sha256:dataset"/u);
    assert.match(config, /source_acquisition_id = "sha256:source"/u);
    assert.doesNotMatch(config, /replace-with/u);
  });

  it("keeps the observer passive and matches its manifest version", async () => {
    const modDirectory = join(process.cwd(), "mod", "neodes2-observer");
    const [main, json, manifestText] = await Promise.all([
      readFile(join(modDirectory, "main.lua"), "utf8"),
      readFile(join(modDirectory, "json.lua"), "utf8"),
      readFile(join(modDirectory, "manifest.json"), "utf8"),
    ]);
    const manifest: unknown = JSON.parse(manifestText);
    assert.equal((manifest as Readonly<Record<string, unknown>>).version_number, /OBSERVER_VERSION = "([^"]+)"/u.exec(main)?.[1]);
    assert.doesNotMatch(main, /\b(?:game\.)?(?:GameState|CurrentRun|MapState|SessionMapState)(?:\.[A-Za-z_][A-Za-z0-9_]*|\[[^\]]+\])+\s*=/u);
    assert.doesNotMatch(main, /\bgame\.(?:AddTraitToHero|RemoveTrait|EquipWeapon|UnequipWeapon|Damage|Heal|LoadMap|Save|ApplyEffectFromWeapon|SpawnObstacle)\s*\(/u);
    assert.doesNotMatch(main, /math\.random/u);
    assert.match(main, /io\.open\(path, "ab"\)/u);
    assert.deepEqual(validateLuaStructure(main), []);
    assert.deepEqual(validateLuaStructure(json), []);
  });
});
