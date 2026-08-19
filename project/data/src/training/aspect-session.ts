import { mkdir, rename, writeFile } from "node:fs/promises";
import { basename, isAbsolute, join, resolve } from "node:path";

import { jsonBytes, sha256 } from "../boons/runtime-acquisition.js";
import { readCombinedDataset, type VerifiedCombinedDataset } from "../dataset/index.js";
import { assertLocalOutputPath } from "../snapshot/index.js";

export const trainingHarnessVersion = "0.1.0";

export interface AspectTrainingScenario {
  readonly commandId: string;
  readonly aspectId: string;
  readonly aspectName: string;
  readonly weaponId: string;
  readonly actions: readonly ["Attack", "Special", "Cast", "Omega Attack", "Omega Special", "Omega Cast"];
}

export interface AspectTrainingPlan {
  readonly schema: "neodes2-aspect-training-plan-1";
  readonly sourceDatasetAcquisitionId: string;
  readonly sourceDatasetSha256: string;
  readonly harnessVersion: string;
  readonly coreActions: readonly ["Attack", "Special", "Cast", "Dash", "Sprint", "Hex", "Magick", "Omega"];
  readonly scenarios: readonly AspectTrainingScenario[];
}

export interface AspectTrainingPreparation {
  readonly acquisitionId: string;
  readonly directory: string;
  readonly plan: AspectTrainingPlan;
  readonly planSha256: string;
}

function luaString(value: string): string {
  return JSON.stringify(value);
}

function commandValue(value: string, label: string): string {
  if (value.length === 0 || /[\r\n=]/u.test(value)) throw new Error(`${label} is unsafe for a training command.`);
  return value;
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function createAspectTrainingPlan(dataset: VerifiedCombinedDataset): AspectTrainingPlan {
  const aspects = [...dataset.dataset.domains.weapons.aspects].sort((left, right) => compareStrings(left.id, right.id));
  if (aspects.length === 0) throw new Error("The combined dataset has no weapon aspects.");
  const seen = new Set<string>();
  const scenarios = aspects.map((aspect, index): AspectTrainingScenario => {
    if (seen.has(aspect.id)) throw new Error(`The combined dataset repeats aspect ${aspect.id}.`);
    seen.add(aspect.id);
    commandValue(aspect.id, "Aspect identifier");
    commandValue(aspect.weaponId, "Weapon identifier");
    return {
      commandId: `aspect-${String(index + 1).padStart(2, "0")}-${aspect.id}`,
      aspectId: aspect.id,
      aspectName: aspect.name,
      weaponId: aspect.weaponId,
      actions: ["Attack", "Special", "Cast", "Omega Attack", "Omega Special", "Omega Cast"],
    };
  });
  return {
    schema: "neodes2-aspect-training-plan-1",
    sourceDatasetAcquisitionId: dataset.acquisitionId,
    sourceDatasetSha256: dataset.datasetSha256,
    harnessVersion: trainingHarnessVersion,
    coreActions: ["Attack", "Special", "Cast", "Dash", "Sprint", "Hex", "Magick", "Omega"],
    scenarios,
  };
}

export function renderTrainingConfig(dataset: VerifiedCombinedDataset): string {
  const source = dataset.dataset.source;
  return `return {
\tschema = "neodes2-training-config-1",
\tsource_acquisition_id = ${luaString(source.acquisitionId)},
\tsource_manifest_sha256 = ${luaString(source.sourceManifestSha256)},
\tdataset_acquisition_id = ${luaString(dataset.acquisitionId)},
\tdataset_sha256 = ${luaString(dataset.datasetSha256)},
\tsteam_build_id = ${luaString(source.steamBuildId)},
\texecutable_version = ${luaString(source.executableVersion)},
\tpackage_version = ${luaString(source.packageVersion)},
}
`;
}

export function renderAspectTrainingCommand(scenario: AspectTrainingScenario, datasetAcquisitionId: string): string {
  const fields = [
    ["schema", "neodes2-training-command-1"],
    ["dataset_acquisition_id", commandValue(datasetAcquisitionId, "Dataset acquisition identifier")],
    ["command_id", commandValue(scenario.commandId, "Command identifier")],
    ["action", "aspect"],
    ["weapon_id", commandValue(scenario.weaponId, "Weapon identifier")],
    ["aspect_id", commandValue(scenario.aspectId, "Aspect identifier")],
    ["end", "neodes2-training-command-1"],
  ] as const;
  return `${fields.map(([key, value]) => `${key}=${value}`).join("\n")}\n`;
}

export function renderRestoreTrainingCommand(datasetAcquisitionId: string): string {
  return `schema=neodes2-training-command-1
dataset_acquisition_id=${commandValue(datasetAcquisitionId, "Dataset acquisition identifier")}
command_id=restore-original
action=restore
end=neodes2-training-command-1
`;
}

export function renderTrainingArm(sessionNonce: string, datasetAcquisitionId: string): string {
  return `schema=neodes2-training-arm-1
session_nonce=${commandValue(sessionNonce, "Session nonce")}
dataset_acquisition_id=${commandValue(datasetAcquisitionId, "Dataset acquisition identifier")}
end=neodes2-training-arm-1
`;
}

async function writeNewFile(path: string, content: Buffer | string): Promise<void> {
  await writeFile(path, content, { flag: "wx" });
}

export async function prepareAspectTrainingSession(
  datasetDirectory: string,
  outputRoot: string,
  now: () => Date = () => new Date(),
): Promise<AspectTrainingPreparation> {
  if (!isAbsolute(datasetDirectory)) throw new Error("Combined dataset path must be absolute.");
  if (!isAbsolute(outputRoot)) throw new Error("Aspect training output root must be absolute.");
  assertLocalOutputPath(outputRoot);
  const dataset = await readCombinedDataset(resolve(datasetDirectory));
  const plan = createAspectTrainingPlan(dataset);
  const planContent = jsonBytes(plan);
  const planSha256 = sha256(planContent);
  const config = renderTrainingConfig(dataset);
  const commands = plan.scenarios.map((scenario) => ({
    path: `commands/aspects/${scenario.commandId}.txt`,
    content: renderAspectTrainingCommand(scenario, dataset.acquisitionId),
  }));
  commands.push({ path: "commands/restore-original.txt", content: renderRestoreTrainingCommand(dataset.acquisitionId) });
  const manifestIdentity = {
    schema: "neodes2-aspect-training-manifest-1" as const,
    harnessVersion: trainingHarnessVersion,
    sourceDatasetAcquisitionId: dataset.acquisitionId,
    sourceDatasetSha256: dataset.datasetSha256,
    planSha256,
    commands: commands.map((command) => ({ path: command.path, sha256: sha256(command.content) })),
  };
  const acquisitionId = `sha256:${sha256(JSON.stringify(manifestIdentity))}`;
  const resolvedRoot = resolve(outputRoot);
  await mkdir(resolvedRoot, { recursive: true });
  const timestamp = now().toISOString().replace(/[-:.]/gu, "");
  const incompleteDirectory = join(resolvedRoot, `${timestamp}-incomplete-${acquisitionId.slice(7, 19)}`);
  await mkdir(join(incompleteDirectory, "commands", "aspects"), { recursive: true });
  try {
    await writeNewFile(join(incompleteDirectory, "plan.json"), planContent);
    await writeNewFile(join(incompleteDirectory, "config.lua"), config);
    for (const command of commands) await writeNewFile(join(incompleteDirectory, ...command.path.split("/")), command.content);
    const manifestContent = jsonBytes({ ...manifestIdentity, acquisitionId });
    await writeNewFile(join(incompleteDirectory, "manifest.json"), manifestContent);
    await writeNewFile(join(incompleteDirectory, "complete.json"), jsonBytes({
      schema: "neodes2-aspect-training-completion-1",
      acquisitionId,
      manifestSha256: sha256(manifestContent),
      planSha256,
    }));
    const finalDirectory = join(resolvedRoot, `${timestamp}-${acquisitionId.slice(7, 19)}-${basename(incompleteDirectory).slice(-4)}`);
    await rename(incompleteDirectory, finalDirectory);
    return { acquisitionId, directory: finalDirectory, plan, planSha256 };
  } catch (error) {
    throw new Error(`Unable to prepare aspect training session in ${incompleteDirectory}.`, { cause: error });
  }
}
