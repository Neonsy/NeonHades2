import { isAbsolute, resolve } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { readCombinedDataset, type VerifiedCombinedDataset } from "../dataset/index.js";
import { assertLocalOutputPath } from "../snapshot/index.js";

function luaString(value: string): string {
  return JSON.stringify(value);
}

export function renderObserverConfig(dataset: VerifiedCombinedDataset): string {
  const source = dataset.dataset.source;
  return `return {
\tschema = "neodes2-observer-config-1",
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

export async function createObserverConfig(datasetDirectory: string, outputPath: string): Promise<string> {
  if (!isAbsolute(datasetDirectory)) throw new Error("Combined dataset path must be absolute.");
  if (!isAbsolute(outputPath)) throw new Error("Observer config output path must be absolute.");
  assertLocalOutputPath(outputPath);
  const dataset = await readCombinedDataset(resolve(datasetDirectory));
  const resolvedOutput = resolve(outputPath);
  await mkdir(dirname(resolvedOutput), { recursive: true });
  await writeFile(resolvedOutput, renderObserverConfig(dataset), { encoding: "utf8", flag: "wx" });
  return resolvedOutput;
}
