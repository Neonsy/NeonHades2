import { basename, isAbsolute, join, resolve } from "node:path";
import { mkdir, mkdtemp, readFile, rename, writeFile } from "node:fs/promises";

import type { NormalizedArcanaDataset } from "../arcana/index.js";
import { jsonBytes, readStableRegularFile, sha256 } from "../boons/runtime-acquisition.js";
import type { NormalizedBoonDataset } from "../boons/index.js";
import type { NormalizedGuideDataset } from "../guide/index.js";
import type { NormalizedLoadoutDataset } from "../loadouts/index.js";
import { assertLocalOutputPath } from "../snapshot/index.js";
import type { NormalizedWeaponDataset } from "../weapons/index.js";
import type {
  CombinedDataset,
  DatasetBuildOptions,
  DatasetBuildResult,
  DatasetDomainName,
  DatasetSource,
  DomainProvenance,
  NormalizedDomains,
} from "./types.js";
import { validateNormalizedDomains } from "./validation.js";

interface DomainConfig {
  readonly manifestSchema: string;
  readonly completionSchema: string;
  readonly coverageSchema: string;
  readonly datasetSchema: string;
  readonly datasetFile: string;
}

interface VerifiedDomain<T> {
  readonly dataset: T;
  readonly source: DatasetSource;
  readonly provenance: DomainProvenance;
}

const domainOrder = ["arcana", "boons", "guide", "loadouts", "weapons"] as const;

const domainConfigs: Readonly<Record<DatasetDomainName, DomainConfig>> = {
  arcana: {
    manifestSchema: "neodes2-arcana-acquisition-manifest-1",
    completionSchema: "neodes2-arcana-acquisition-completion-1",
    coverageSchema: "neodes2-arcana-coverage-1",
    datasetSchema: "neodes2-arcana-1",
    datasetFile: "arcana.json",
  },
  boons: {
    manifestSchema: "neodes2-boon-acquisition-manifest-2",
    completionSchema: "neodes2-boon-acquisition-completion-2",
    coverageSchema: "neodes2-boon-coverage-2",
    datasetSchema: "neodes2-boons-2",
    datasetFile: "boons.json",
  },
  guide: {
    manifestSchema: "neodes2-guide-acquisition-manifest-1",
    completionSchema: "neodes2-guide-acquisition-completion-1",
    coverageSchema: "neodes2-guide-coverage-1",
    datasetSchema: "neodes2-guide-data-2",
    datasetFile: "guide.json",
  },
  loadouts: {
    manifestSchema: "neodes2-loadout-acquisition-manifest-1",
    completionSchema: "neodes2-loadout-acquisition-completion-1",
    coverageSchema: "neodes2-loadout-coverage-1",
    datasetSchema: "neodes2-loadouts-2",
    datasetFile: "loadouts.json",
  },
  weapons: {
    manifestSchema: "neodes2-weapon-acquisition-manifest-1",
    completionSchema: "neodes2-weapon-acquisition-completion-1",
    coverageSchema: "neodes2-weapon-coverage-1",
    datasetSchema: "neodes2-weapons-1",
    datasetFile: "weapons.json",
  },
};

function record(value: unknown, label: string): Readonly<Record<string, unknown>> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Readonly<Record<string, unknown>>;
}

function stringValue(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${label} must be a nonempty string.`);
  }
  return value;
}

function arrayValue(value: unknown, label: string): readonly unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`);
  return value;
}

function integerValue(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a nonnegative integer.`);
  }
  return value;
}

function parseCanonicalJson(content: Buffer, label: string): unknown {
  const value: unknown = JSON.parse(content.toString("utf8"));
  if (!content.equals(jsonBytes(value))) {
    throw new Error(`${label} is not in the supported deterministic JSON representation.`);
  }
  return value;
}

function validateSource(
  domain: DatasetDomainName,
  manifest: Readonly<Record<string, unknown>>,
  dataset: Readonly<Record<string, unknown>>,
): DatasetSource {
  const manifestGame = record(manifest.game, `${domain} manifest.game`);
  const datasetSource = record(dataset.source, `${domain} dataset.source`);
  const source = {
    acquisitionId: stringValue(manifest.sourceAcquisitionId, `${domain} manifest.sourceAcquisitionId`),
    sourceManifestSha256: stringValue(manifest.sourceManifestSha256, `${domain} manifest.sourceManifestSha256`),
    exporterVersion: stringValue(manifest.exporterVersion, `${domain} manifest.exporterVersion`),
    steamBuildId: stringValue(manifestGame.steamBuildId, `${domain} manifest.game.steamBuildId`),
    executableVersion: stringValue(manifestGame.executableVersion, `${domain} manifest.game.executableVersion`),
    packageVersion: stringValue(manifestGame.packageVersion, `${domain} manifest.game.packageVersion`),
  };
  for (const [field, expected] of [
    ["acquisitionId", source.acquisitionId],
    ["exporterVersion", source.exporterVersion],
    ["steamBuildId", source.steamBuildId],
    ["executableVersion", source.executableVersion],
    ["packageVersion", source.packageVersion],
  ] as const) {
    if (datasetSource[field] !== expected) {
      throw new Error(`${domain} normalized source ${field} differs from its acquisition manifest.`);
    }
  }
  return source;
}

function derivedCounts(domain: DatasetDomainName, dataset: Readonly<Record<string, unknown>>): Readonly<Record<string, number>> {
  const length = (field: string): number => arrayValue(dataset[field], `${domain} dataset.${field}`).length;
  if (domain === "boons") return { gods: length("gods"), boons: length("boons") };
  if (domain === "weapons") {
    const aspects = arrayValue(dataset.aspects, "weapons dataset.aspects").map((value, index) => record(value, `weapons dataset.aspects[${index}]`));
    return {
      weapons: length("weapons"), aspects: aspects.length,
      ranks: aspects.reduce((count, aspect) => count + arrayValue(aspect.ranks, "weapon aspect.ranks").length, 0),
      hammers: length("hammers"),
    };
  }
  if (domain === "arcana") {
    const cards = arrayValue(dataset.cards, "arcana dataset.cards").map((value, index) => record(value, `arcana dataset.cards[${index}]`));
    const grasp = record(dataset.grasp, "arcana dataset.grasp");
    const levels = arrayValue(grasp.levels, "arcana dataset.grasp.levels").map((value, index) => record(value, `arcana dataset.grasp.levels[${index}]`));
    return {
      cards: cards.length,
      ranks: cards.reduce((count, card) => count + arrayValue(card.ranks, "arcana card.ranks").length, 0),
      automaticCards: cards.filter((card) => Object.keys(record(card.autoActivationRequirements, "arcana card.autoActivationRequirements")).length > 0).length,
      graspLevels: levels.length,
      maximumGrasp: levels.length === 0 ? 0 : integerValue(levels.at(-1)?.cumulativeCapacity, "final Grasp capacity"),
    };
  }
  if (domain === "loadouts") {
    const familiars = arrayValue(dataset.familiars, "loadouts dataset.familiars").map((value, index) => record(value, `loadouts dataset.familiars[${index}]`));
    const upgrades = familiars.flatMap((familiar) => arrayValue(familiar.upgrades, "loadout familiar.upgrades").map((value) => record(value, "loadout familiar upgrade")));
    const hexes = arrayValue(dataset.hexes, "loadouts dataset.hexes").map((value, index) => record(value, `loadouts dataset.hexes[${index}]`));
    return {
      keepsakes: length("keepsakes"), familiars: familiars.length,
      familiarUpgradeTracks: upgrades.length,
      familiarUpgradeRanks: upgrades.reduce((count, upgrade) => count + arrayValue(upgrade.ranks, "loadout familiar upgrade.ranks").length, 0),
      hexes: hexes.length,
      hexTalents: hexes.reduce((count, hex) => count + arrayValue(hex.talents, "loadout hex.talents").length, 0),
      incantations: length("incantations"),
      automaticIncantations: length("automaticWorldUpgradeIds"),
    };
  }
  const statusElements = length("statusElements");
  return {
    routes: length("routes"), regions: length("regions"), rooms: length("rooms"),
    encounters: length("encounters"), enemies: length("enemies"), rewards: length("rewards"),
    resources: length("resources"), statusElements, oathConditions: length("oathConditions"),
    bounties: length("bounties"), relationships: length("relationships"), prophecies: length("prophecies"),
    narrative: length("narrative"), outros: length("outros"), achievements: length("achievements"),
    namedRequirements: length("namedRequirements"),
    gatheringTools: length("gatheringTools"), fish: length("fish"), cultivation: length("cultivation"),
    marketOffers: length("marketOffers"), runRewards: length("runRewards"), openingStates: length("openingStates"),
    godAppearances: length("godAppearances"), encounterFriends: length("encounterFriends"),
    encounterAids: length("encounterAids"), encounterAidEffects: length("encounterAidEffects"), strifeCurses: length("strifeCurses"),
    surfacePenalties: length("surfacePenalties"),
  };
}

function validateManifestCounts(
  domain: DatasetDomainName,
  manifest: Readonly<Record<string, unknown>>,
  dataset: Readonly<Record<string, unknown>>,
): void {
  const counts = record(manifest.counts, `${domain} manifest.counts`);
  for (const [field, value] of Object.entries(counts)) integerValue(value, `${domain} manifest.counts.${field}`);
  for (const [field, expected] of Object.entries(derivedCounts(domain, dataset))) {
    if (counts[field] !== expected) {
      throw new Error(`${domain} manifest count ${field} is ${String(counts[field])}, but normalized data contains ${expected}.`);
    }
  }
}

function assertDatasetShape(
  domain: DatasetDomainName,
  value: unknown,
  config: DomainConfig,
): Readonly<Record<string, unknown>> {
  const dataset = record(value, `${domain} normalized dataset`);
  if (dataset.schema !== config.datasetSchema) throw new Error(`Unsupported ${domain} normalized dataset schema.`);
  const requiredArrays: Readonly<Record<DatasetDomainName, readonly string[]>> = {
    arcana: ["layout", "cards"], boons: ["gods", "boons"],
    guide: ["routes", "regions", "rooms", "encounters", "enemies", "rewards", "consumables", "resources", "statusElements", "oathConditions", "bounties", "bountyOrder", "relationships", "prophecies", "narrative", "outros", "outroPriorities", "achievements", "namedRequirements", "runClearMessages", "gatheringTools", "fish", "cultivation", "marketOffers", "runRewards", "openingStates", "godAppearances", "encounterFriends", "encounterAids", "encounterAidEffects", "strifeCurses", "surfacePenalties"],
    loadouts: ["keepsakes", "familiars", "hexes", "incantations", "automaticWorldUpgradeIds"],
    weapons: ["weapons", "aspects", "hammers"],
  };
  for (const field of requiredArrays[domain]) arrayValue(dataset[field], `${domain} dataset.${field}`);
  if (domain === "loadouts") record(dataset.incantationRevealPolicy, "loadouts dataset.incantationRevealPolicy");
  if (domain === "guide") integerValue(dataset.gardenPlotCount, "guide dataset.gardenPlotCount");
  return dataset;
}

async function verifyDomain<T>(
  domain: DatasetDomainName,
  directory: string,
): Promise<VerifiedDomain<T>> {
  if (!isAbsolute(directory)) throw new Error(`${domain} acquisition path must be absolute.`);
  const config = domainConfigs[domain];
  const root = resolve(directory);
  const [manifestFile, completionFile, datasetFile, runtimeFile, coverageFile, coverageMarkdownFile] = await Promise.all([
    readStableRegularFile(join(root, "manifest.json")), readStableRegularFile(join(root, "complete.json")),
    readStableRegularFile(join(root, config.datasetFile)), readStableRegularFile(join(root, "runtime-report.json")),
    readStableRegularFile(join(root, "coverage.json")), readStableRegularFile(join(root, "coverage.md")),
  ]);
  const manifest = record(JSON.parse(manifestFile.content.toString("utf8")), `${domain} manifest`);
  const completion = record(JSON.parse(completionFile.content.toString("utf8")), `${domain} completion marker`);
  if (manifest.schema !== config.manifestSchema) throw new Error(`Unsupported ${domain} acquisition manifest schema.`);
  if (completion.schema !== config.completionSchema) throw new Error(`Unsupported ${domain} acquisition completion schema.`);
  const acquisitionId = stringValue(manifest.acquisitionId, `${domain} manifest.acquisitionId`);
  if (completion.acquisitionId !== acquisitionId || completion.manifestSha256 !== manifestFile.sha256) {
    throw new Error(`${domain} acquisition completion marker does not match its manifest.`);
  }
  const identity = Object.fromEntries(Object.entries(manifest).filter(([field]) => field !== "acquisitionId"));
  if (acquisitionId !== `sha256:${sha256(JSON.stringify(identity))}`) {
    throw new Error(`${domain} acquisition identifier does not match its manifest identity.`);
  }
  const expectedHashes = {
    normalizedDatasetSha256: datasetFile.sha256,
    runtimeReportSha256: runtimeFile.sha256,
    coverageReportSha256: coverageFile.sha256,
    coverageMarkdownSha256: coverageMarkdownFile.sha256,
  };
  for (const [field, expected] of Object.entries(expectedHashes)) {
    if (manifest[field] !== expected) throw new Error(`${domain} ${field} does not match its file.`);
  }
  const datasetValue = parseCanonicalJson(datasetFile.content, `${domain} normalized dataset`);
  const coverage = record(parseCanonicalJson(coverageFile.content, `${domain} coverage report`), `${domain} coverage report`);
  if (coverage.schema !== config.coverageSchema) throw new Error(`Unsupported ${domain} coverage schema.`);
  if (manifest.coverageComplete !== true || coverage.complete !== true || arrayValue(coverage.issues, `${domain} coverage issues`).length !== 0) {
    throw new Error(`${domain} acquisition coverage is incomplete.`);
  }
  const dataset = assertDatasetShape(domain, datasetValue, config);
  const source = validateSource(domain, manifest, dataset);
  validateManifestCounts(domain, manifest, dataset);
  return {
    dataset: dataset as unknown as T,
    source,
    provenance: {
      acquisitionId, manifestSha256: manifestFile.sha256,
      normalizedDatasetSha256: datasetFile.sha256, runtimeReportSha256: runtimeFile.sha256,
      coverageReportSha256: coverageFile.sha256, coverageMarkdownSha256: coverageMarkdownFile.sha256,
    },
  };
}

function assertSameSource(domains: Readonly<Record<DatasetDomainName, VerifiedDomain<unknown>>>): DatasetSource {
  const expected = domains.boons.source;
  for (const domain of domainOrder) {
    const actual = domains[domain].source;
    for (const field of Object.keys(expected) as readonly (keyof DatasetSource)[]) {
      if (actual[field] !== expected[field]) throw new Error(`${domain} ${field} differs from the other domain acquisitions.`);
    }
  }
  return expected;
}

export async function createCombinedDataset(options: DatasetBuildOptions): Promise<DatasetBuildResult> {
  assertLocalOutputPath(options.outputRoot);
  const verified = {
    arcana: await verifyDomain<NormalizedArcanaDataset>("arcana", options.acquisitions.arcana),
    boons: await verifyDomain<NormalizedBoonDataset>("boons", options.acquisitions.boons),
    guide: await verifyDomain<NormalizedGuideDataset>("guide", options.acquisitions.guide),
    loadouts: await verifyDomain<NormalizedLoadoutDataset>("loadouts", options.acquisitions.loadouts),
    weapons: await verifyDomain<NormalizedWeaponDataset>("weapons", options.acquisitions.weapons),
  };
  const source = assertSameSource(verified);
  const domains: NormalizedDomains = {
    arcana: verified.arcana.dataset, boons: verified.boons.dataset, guide: verified.guide.dataset,
    loadouts: verified.loadouts.dataset, weapons: verified.weapons.dataset,
  };
  const validation = validateNormalizedDomains(domains);
  if (!validation.complete) {
    const first = validation.issues[0];
    throw new Error(`Combined dataset validation failed with ${validation.issues.length} issue(s). First issue: ${first?.domain}/${first?.path}: ${first?.detail}`);
  }
  const dataset: CombinedDataset = {
    schema: "neodes2-dataset-1", source,
    domainAcquisitionIds: {
      arcana: verified.arcana.provenance.acquisitionId, boons: verified.boons.provenance.acquisitionId,
      guide: verified.guide.provenance.acquisitionId, loadouts: verified.loadouts.provenance.acquisitionId,
      weapons: verified.weapons.provenance.acquisitionId,
    },
    domains,
  };
  const datasetContent = jsonBytes(dataset);
  const validationContent = jsonBytes(validation);
  const provenance = Object.fromEntries(domainOrder.map((domain) => [domain, verified[domain].provenance]));
  const identity = {
    schema: "neodes2-dataset-manifest-1" as const,
    source,
    domains: provenance,
    datasetSha256: sha256(datasetContent),
    validationSha256: sha256(validationContent),
    validationComplete: true,
    domainRecordCounts: validation.domainRecordCounts,
  };
  const acquisitionId = `sha256:${sha256(JSON.stringify(identity))}`;
  const outputRoot = resolve(options.outputRoot);
  await mkdir(outputRoot, { recursive: true });
  const timestamp = (options.now ?? (() => new Date()))().toISOString().replace(/[-:.]/gu, "");
  const incompletePrefix = join(outputRoot, `${timestamp}-incomplete-`);
  let currentDirectory = await mkdtemp(incompletePrefix);
  try {
    for (const [name, content] of [
      ["dataset.json", datasetContent], ["validation.json", validationContent],
      ["manifest.json", jsonBytes({ ...identity, acquisitionId })],
    ] as const) {
      const temporary = join(currentDirectory, `${name}.tmp`);
      await writeFile(temporary, content, { flag: "wx" });
      await rename(temporary, join(currentDirectory, name));
    }
    const suffix = basename(currentDirectory).slice(basename(incompletePrefix).length);
    const finalDirectory = join(outputRoot, `${timestamp}-${acquisitionId.slice(7, 19)}-${suffix}`);
    await rename(currentDirectory, finalDirectory);
    currentDirectory = finalDirectory;
    const [writtenDataset, writtenValidation, writtenManifest] = await Promise.all([
      readFile(join(finalDirectory, "dataset.json")),
      readFile(join(finalDirectory, "validation.json")),
      readFile(join(finalDirectory, "manifest.json")),
    ]);
    if (
      sha256(writtenDataset) !== identity.datasetSha256 ||
      sha256(writtenValidation) !== identity.validationSha256
    ) {
      throw new Error("Finalized dataset files do not match their manifest hashes.");
    }
    const manifestSha256 = sha256(writtenManifest);
    const completion = {
      schema: "neodes2-dataset-completion-1", acquisitionId, manifestSha256,
      datasetSha256: identity.datasetSha256, validationSha256: identity.validationSha256,
    };
    const temporary = join(finalDirectory, "complete.json.tmp");
    await writeFile(temporary, jsonBytes(completion), { flag: "wx" });
    await rename(temporary, join(finalDirectory, "complete.json"));
    return { acquisitionId, datasetSha256: identity.datasetSha256, directory: finalDirectory, validation };
  } catch (error) {
    try {
      await writeFile(join(currentDirectory, "failure.json"), jsonBytes({
        schema: "neodes2-dataset-failure-1",
        message: error instanceof Error ? error.message : "Unknown dataset build failure.",
      }), { flag: "wx" });
    } catch {
      // Preserve the original write failure.
    }
    throw error;
  }
}
