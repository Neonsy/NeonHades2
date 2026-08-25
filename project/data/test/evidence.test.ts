import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import { jsonBytes, sha256 } from "../src/boons/runtime-acquisition.js";
import { createEvidenceArchive, preflightEvidenceExporter } from "../src/evidence/index.js";

async function fixture(
  root: string,
  denyGameState = true,
  excludeRuntimeNamespaces = true,
): Promise<{ source: string; runtime: string }> {
  const source = join(root, "source");
  const runtime = join(root, "runtime");
  await mkdir(source, { recursive: true });
  await mkdir(runtime, { recursive: true });
  const sourceManifest = jsonBytes({
    schema: "neodes2-source-manifest-1",
    acquisitionId: "sha256:source",
    game: { steamBuildId: "1", executableVersion: "2", packageVersion: "3" },
    sources: [{ relativePath: "Content/Scripts/Test.lua", size: 1, sha256: "source" }],
  });
  await writeFile(join(source, "manifest.json"), sourceManifest);
  await writeFile(join(source, "complete.json"), jsonBytes({ manifestSha256: sha256(sourceManifest) }));
  const firstTableContent = jsonBytes({
    schema: "neodes2-processed-table-evidence-2",
    tableName: "TraitData",
    root: { ref: 1 },
    nodes: [{ id: 1, entries: [{ key: "Shared", keyType: "string", value: { ref: 2 } }] }],
    omissions: [],
  });
  const secondTableContent = jsonBytes({
    schema: "neodes2-processed-table-evidence-2",
    tableName: "WeaponData",
    root: { ref: 2 },
    nodes: [{ id: 2, entries: [] }],
    omissions: [],
  });
  await writeFile(join(runtime, "table-00001.json"), firstTableContent);
  await writeFile(join(runtime, "table-00002.json"), secondTableContent);
  const runtimeManifest = jsonBytes({
    schema: "neodes2-runtime-evidence-manifest-2",
    exporterVersion: "1.0.0",
    game: {
      steamBuildId: "1",
      executableVersion: "2",
      packageVersion: "3",
      acquisitionId: "sha256:source",
      sourceManifestSha256: sha256(sourceManifest),
    },
    files: [
      { tableName: "TraitData", file: "table-00001.json", sha256: sha256(firstTableContent) },
      { tableName: "WeaponData", file: "table-00002.json", sha256: sha256(secondTableContent) },
    ],
    totalNodeCount: 2,
    deniedPlayerStateTables: denyGameState ? ["GameState", "CurrentRun"] : ["CurrentRun"],
    excludedRuntimeNamespaces: excludeRuntimeNamespaces ? ["_G", "package", "rom"] : ["_G", "package"],
  });
  await writeFile(join(runtime, "manifest.json"), runtimeManifest);
  await writeFile(join(runtime, "complete.json"), jsonBytes({
    schema: "neodes2-runtime-evidence-completion-2",
    manifestSha256: sha256(runtimeManifest),
  }));
  return { source, runtime };
}

describe("private evidence archive", () => {
  it("preflights the repository exporter and its player-state boundary", async () => {
    const result = await preflightEvidenceExporter(join(process.cwd(), "mod", "neodes2-boon-exporter"));
    assert.equal(result.complete, true, result.issues.join("\n"));
    assert.equal(result.exporterVersion, "0.8.0");
  });

  it("imports hash-bound processed tables and preserves the player-state denial", async () => {
    const root = await mkdtemp(join(tmpdir(), "neodes2-evidence-"));
    try {
      const input = await fixture(root);
      const result = await createEvidenceArchive({
        sourceAcquisition: input.source,
        runtimeEvidence: input.runtime,
        outputRoot: join(root, ".local", "evidence"),
        now: () => new Date("2026-08-29T12:00:00.000Z"),
      });
      assert.equal(result.tableCount, 2);
      const manifest = JSON.parse(await readFile(join(result.directory, "manifest.json"), "utf8")) as {
        deniedPlayerStateTables: string[];
        excludedRuntimeNamespaces: string[];
        totalNodeCount: number;
      };
      assert.ok(manifest.deniedPlayerStateTables.includes("GameState"));
      assert.ok(manifest.excludedRuntimeNamespaces.includes("rom"));
      assert.equal(manifest.totalNodeCount, 2);
      assert.equal(JSON.parse(await readFile(join(result.directory, "tables", "table-00001.json"), "utf8")).tableName, "TraitData");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects runtime evidence without the player-state denial", async () => {
    const root = await mkdtemp(join(tmpdir(), "neodes2-evidence-"));
    try {
      const input = await fixture(root, false);
      await assert.rejects(createEvidenceArchive({
        sourceAcquisition: input.source,
        runtimeEvidence: input.runtime,
        outputRoot: join(root, ".local", "evidence"),
      }), /player-state denial boundary/u);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects runtime evidence without the non-game namespace boundary", async () => {
    const root = await mkdtemp(join(tmpdir(), "neodes2-evidence-"));
    try {
      const input = await fixture(root, true, false);
      await assert.rejects(createEvidenceArchive({
        sourceAcquisition: input.source,
        runtimeEvidence: input.runtime,
        outputRoot: join(root, ".local", "evidence"),
      }), /does not exclude rom/u);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
