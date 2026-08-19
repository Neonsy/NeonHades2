import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";

import {
  assertLocalOutputPath,
  createSourceSnapshot,
  discoverGameInstallation,
  matchesSourcePattern,
  parseSteamAppManifest,
  parseSteamLibraryFolders,
  parseValveKeyValues,
  readSourceSnapshotFile,
  validateSourcePolicy,
} from "../src/snapshot/index.js";

const fixturePatterns = [
  "Content/Scripts/*.lua",
  "Content/Scripts/RequirementsData.lua",
  "Content/Game/**/*.sjson",
  "Content/Game/Text/en/*.sjson",
  "Content/Game/Projectiles/*.sjson",
  "Content/Game/Units/Enemies.sjson",
  "Content/Game/Weapons/*.sjson",
] as const;

interface FixtureOptions {
  readonly buildId?: string;
  readonly targetBuildId?: string;
  readonly installDir?: string;
  readonly omitEnemies?: boolean;
}

interface SteamFixture {
  readonly steamRoot: string;
  readonly libraryRoot: string;
  readonly manifestPath: string;
  readonly gameRoot: string;
}

function appManifest(options: FixtureOptions = {}): string {
  const buildId = options.buildId ?? "100";
  const targetBuildId = options.targetBuildId ?? buildId;
  const installDir = options.installDir ?? "Hades II";
  return `"AppState"
{
  "appid" "1145350"
  "name" "Hades II"
  "StateFlags" "4"
  "installdir" "${installDir}"
  "buildid" "${buildId}"
  "TargetBuildID" "${targetBuildId}"
  "LastOwner" "private-test-value"
}`;
}

function libraryFolders(libraryRoot: string): string {
  const escaped = libraryRoot.replaceAll("\\", "\\\\");
  return `"libraryfolders"
{
  "0"
  {
    "path" "${escaped}"
    "apps" { "1145350" "1" }
  }
}`;
}

async function writeFixtureFile(root: string, relativePath: string, content: string): Promise<void> {
  const path = join(root, ...relativePath.split("/"));
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content);
}

async function createSteamFixture(
  parent: string,
  name: string,
  options: FixtureOptions = {},
): Promise<SteamFixture> {
  const steamRoot = join(parent, `${name}-steam`);
  const libraryRoot = join(parent, `${name}-library`);
  const manifestPath = join(libraryRoot, "steamapps", "appmanifest_1145350.acf");
  const gameRoot = join(
    libraryRoot,
    "steamapps",
    "common",
    options.installDir ?? "Hades II",
  );

  await mkdir(join(steamRoot, "steamapps"), { recursive: true });
  await mkdir(join(libraryRoot, "steamapps", "common"), { recursive: true });
  await writeFile(
    join(steamRoot, "steamapps", "libraryfolders.vdf"),
    libraryFolders(libraryRoot),
  );
  await writeFile(manifestPath, appManifest(options));
  await writeFixtureFile(gameRoot, "Content/packagever", "90\n");
  await writeFixtureFile(gameRoot, "Release/Hades2.exe", "release executable");
  await writeFixtureFile(gameRoot, "Ship/Hades2.exe", "ship executable");
  await writeFixtureFile(gameRoot, "Content/Scripts/RequirementsData.lua", "return { Value = 1 }\n");
  await writeFixtureFile(gameRoot, "Content/Game/Text/en/Test.en.sjson", "{ Text = test }\n");
  await writeFixtureFile(gameRoot, "Content/Game/Projectiles/Test.sjson", "{ Projectile = test }\n");
  await mkdir(join(gameRoot, "Content", "Game", "Units"), { recursive: true });
  if (!options.omitEnemies) {
    await writeFixtureFile(gameRoot, "Content/Game/Units/Enemies.sjson", "{ Enemy = test }\n");
  }
  await writeFixtureFile(gameRoot, "Content/Game/Weapons/Test.sjson", "{ Weapon = test }\n");
  await writeFixtureFile(gameRoot, "Content/Packages/Forbidden.pkg", "not copied");

  return { steamRoot, libraryRoot, manifestPath, gameRoot };
}

async function withTemporaryDirectory(
  run: (directory: string) => Promise<void>,
): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), "neodes2-snapshot-test-"));
  try {
    await run(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

const testVersionReader = async (): Promise<{
  readonly fileVersion: string;
  readonly productVersion: string;
}> => ({ fileVersion: "101", productVersion: "101" });

describe("Steam discovery", () => {
  it("discovers one installed app manifest without retaining private manifest fields", async () => {
    await withTemporaryDirectory(async (directory) => {
      const fixture = await createSteamFixture(directory, "only");
      const installation = await discoverGameInstallation({ steamRoots: [fixture.steamRoot] });

      assert.equal(installation.appManifestPath, fixture.manifestPath);
      assert.equal(installation.gameRoot, fixture.gameRoot);
      assert.equal(installation.manifest.buildId, "100");
      assert.equal("LastOwner" in installation.manifest, false);
    });
  });

  it("requires an explicit manifest when discovery is ambiguous", async () => {
    await withTemporaryDirectory(async (directory) => {
      const first = await createSteamFixture(directory, "first");
      const second = await createSteamFixture(directory, "second");

      await assert.rejects(
        discoverGameInstallation({ steamRoots: [first.steamRoot, second.steamRoot] }),
        /Multiple Hades II Steam app manifests/u,
      );

      const selected = await discoverGameInstallation({ manifestPath: first.manifestPath });
      assert.equal(selected.gameRoot, first.gameRoot);
    });
  });

  it("rejects unresolved installation paths and mixed builds", () => {
    assert.throws(
      () => parseSteamAppManifest(appManifest({ installDir: "../outside" })),
      /unresolved install directory/u,
    );
    assert.throws(
      () => parseSteamAppManifest(appManifest({ buildId: "100", targetBuildId: "101" })),
      /mixed installed and target builds/u,
    );
  });

  it("rejects malformed Valve KeyValues strings", () => {
    assert.throws(() => parseValveKeyValues('"key" "'), /Unterminated quoted value/u);
  });

  it("rejects relative Steam library paths", () => {
    assert.throws(
      () =>
        parseSteamLibraryFolders(`"libraryfolders"
{
  "0" { "path" "relative-library" }
}`),
      /relative path/u,
    );
  });
});

describe("source snapshot", () => {
  it("is deterministic for one installation and changes identity with source content", async () => {
    await withTemporaryDirectory(async (directory) => {
      const fixture = await createSteamFixture(directory, "stable");
      const outputRoot = join(directory, ".local", "acquisitions");
      const options = {
        steamRoots: [fixture.steamRoot],
        outputRoot,
        requiredSourcePatterns: fixturePatterns,
        executableVersionReader: testVersionReader,
        now: () => new Date("2026-08-18T12:00:00.000Z"),
      } as const;

      const first = await createSourceSnapshot(options);
      const second = await createSourceSnapshot(options);
      const firstManifest = await readFile(first.manifestPath, "utf8");
      const secondManifest = await readFile(second.manifestPath, "utf8");

      assert.notEqual(first.directory, second.directory);
      assert.equal(first.acquisitionId, second.acquisitionId);
      assert.equal(first.manifestSha256, second.manifestSha256);
      assert.equal(firstManifest, secondManifest);
      assert.doesNotMatch(firstManifest, /private-test-value|LastOwner/u);
      assert.doesNotMatch(firstManifest, /\.pkg/u);
      const verifiedSource = await readSourceSnapshotFile(first.directory, "Content/Scripts/RequirementsData.lua");
      assert.equal(verifiedSource.acquisitionId, first.acquisitionId);
      assert.equal(verifiedSource.content.toString("utf8"), "return { Value = 1 }\n");

      await writeFixtureFile(
        fixture.gameRoot,
        "Content/Scripts/RequirementsData.lua",
        "return { Value = 2 }\n",
      );
      const changed = await createSourceSnapshot(options);
      assert.notEqual(changed.acquisitionId, first.acquisitionId);
    });
  });

  it("rejects missing required files", async () => {
    await withTemporaryDirectory(async (directory) => {
      const fixture = await createSteamFixture(directory, "missing", { omitEnemies: true });

      await assert.rejects(
        createSourceSnapshot({
          steamRoots: [fixture.steamRoot],
          outputRoot: join(directory, ".local", "acquisitions"),
          requiredSourcePatterns: fixturePatterns,
          executableVersionReader: testVersionReader,
        }),
        /Required source file is missing/u,
      );
    });
  });

  it("rejects forbidden file classes in a source policy", () => {
    const forbiddenPolicy = {
      schema: "neodes2-source-policy-1",
      rules: [{ directory: "Content/Packages", extension: ".pkg", files: "all" }],
    };

    assert.throws(() => validateSourcePolicy(forbiddenPolicy), /Forbidden source file class/u);
  });

  it("rejects mixed executable versions", async () => {
    await withTemporaryDirectory(async (directory) => {
      const fixture = await createSteamFixture(directory, "mixed-executable");

      await assert.rejects(
        createSourceSnapshot({
          steamRoots: [fixture.steamRoot],
          outputRoot: join(directory, ".local", "acquisitions"),
          requiredSourcePatterns: fixturePatterns,
          executableVersionReader: async (path) => ({
            fileVersion: path.includes("Ship") ? "102" : "101",
            productVersion: "101",
          }),
        }),
        /executable variants report mixed versions/u,
      );
    });
  });

  it("requires CLI output to remain under .local", () => {
    assert.doesNotThrow(() => assertLocalOutputPath(join("project", ".local", "acquisitions")));
    assert.throws(() => assertLocalOutputPath(join("project", "acquisitions")), /inside a \.local/u);
  });

  it("matches recursive and single-directory contract patterns", () => {
    assert.equal(
      matchesSourcePattern("Content/Game/Text/en/Test.sjson", "Content/Game/**/*.sjson"),
      true,
    );
    assert.equal(
      matchesSourcePattern("Content/Scripts/Test.lua", "Content/Scripts/*.lua"),
      true,
    );
    assert.equal(
      matchesSourcePattern("Content/Scripts/Nested/Test.lua", "Content/Scripts/*.lua"),
      false,
    );
  });
});
