import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import { jsonBytes, sha256 } from "../src/boons/runtime-acquisition.js";
import { createRuntimeExportArchive } from "../src/runtime-export/index.js";

async function writeFinalizedReport(root: string, directory: string): Promise<void> {
  const target = join(root, directory);
  await mkdir(target, { recursive: true });
  const report = jsonBytes({ schema: `report-${directory || "boons"}` });
  const reportHash = sha256(report);
  await writeFile(join(target, "runtime-report.json"), report);
  await writeFile(join(target, "manifest.json"), jsonBytes({
    schema: `manifest-${directory || "boons"}`,
    reportFile: "runtime-report.json",
    reportSha256: reportHash,
  }));
  await writeFile(join(target, "complete.json"), jsonBytes({ reportSha256: reportHash }));
}

async function fixture(root: string): Promise<string> {
  const runtime = join(root, "run-1");
  for (const directory of ["", "weapons", "arcana", "loadouts", "guide"]) {
    await writeFinalizedReport(runtime, directory);
  }
  const evidenceDirectory = join(runtime, "evidence");
  await mkdir(evidenceDirectory);
  const table = jsonBytes({ schema: "neodes2-processed-table-evidence-1", tableName: "TraitData" });
  await writeFile(join(evidenceDirectory, "table-00001.json"), table);
  const manifest = jsonBytes({
    schema: "neodes2-runtime-evidence-manifest-1",
    exporterVersion: "0.7.1",
    game: {
      steamBuildId: "1",
      executableVersion: "2",
      packageVersion: "3",
      acquisitionId: "sha256:source",
      sourceManifestSha256: "source",
    },
    files: [{ tableName: "TraitData", file: "table-00001.json", sha256: sha256(table) }],
  });
  await writeFile(join(evidenceDirectory, "manifest.json"), manifest);
  await writeFile(join(evidenceDirectory, "complete.json"), jsonBytes({ manifestSha256: sha256(manifest) }));
  return runtime;
}

describe("complete runtime export archive", () => {
  it("copies every finalized mod output into one hash-listed local archive", async () => {
    const root = await mkdtemp(join(tmpdir(), "neodes2-runtime-export-"));
    try {
      const runtime = await fixture(root);
      const result = await createRuntimeExportArchive({
        runtimeRun: runtime,
        outputRoot: join(root, ".local", "runtime-exports"),
        now: () => new Date("2026-08-29T12:00:00.000Z"),
      });
      assert.equal(result.fileCount, 18);
      const manifest = JSON.parse(await readFile(join(result.directory, "manifest.json"), "utf8")) as {
        files: Array<{ path: string }>;
      };
      assert.deepEqual(manifest.files.map((file) => file.path), [
        "arcana/complete.json", "arcana/manifest.json", "arcana/runtime-report.json",
        "complete.json", "evidence/complete.json", "evidence/manifest.json", "evidence/table-00001.json",
        "guide/complete.json", "guide/manifest.json", "guide/runtime-report.json",
        "loadouts/complete.json", "loadouts/manifest.json", "loadouts/runtime-report.json",
        "manifest.json", "runtime-report.json",
        "weapons/complete.json", "weapons/manifest.json", "weapons/runtime-report.json",
      ]);
      assert.deepEqual(
        await readFile(join(result.directory, "raw", "guide", "runtime-report.json")),
        await readFile(join(runtime, "guide", "runtime-report.json")),
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects a run with untracked output instead of silently dropping it", async () => {
    const root = await mkdtemp(join(tmpdir(), "neodes2-runtime-export-"));
    try {
      const runtime = await fixture(root);
      await writeFile(join(runtime, "untracked.json"), "{}");
      await assert.rejects(createRuntimeExportArchive({
        runtimeRun: runtime,
        outputRoot: join(root, ".local", "runtime-exports"),
      }), /Unexpected: untracked\.json/u);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
