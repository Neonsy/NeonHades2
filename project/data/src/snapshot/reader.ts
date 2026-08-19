import { lstat, readFile, stat } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";

import { jsonBytes, sha256 } from "../boons/runtime-acquisition.js";
import type { FileEvidence } from "./snapshot.js";

function record(value: unknown, label: string): Readonly<Record<string, unknown>> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Readonly<Record<string, unknown>>;
}

async function stableRegularFile(path: string): Promise<Buffer> {
  const entry = await lstat(path);
  if (!entry.isFile() || entry.isSymbolicLink()) throw new Error(`Source evidence is not a regular file: ${path}`);
  const before = await stat(path, { bigint: true });
  const content = await readFile(path);
  const after = await stat(path, { bigint: true });
  if (before.size !== after.size || before.mtimeNs !== after.mtimeNs) {
    throw new Error(`Source evidence changed while it was being read: ${path}`);
  }
  return content;
}

function canonicalJson(content: Buffer, label: string): unknown {
  const value: unknown = JSON.parse(content.toString("utf8"));
  if (!content.equals(jsonBytes(value))) throw new Error(`${label} is not canonical JSON.`);
  return value;
}

function manifestIdentity(manifest: Readonly<Record<string, unknown>>): string {
  const identity = Object.fromEntries(
    Object.entries(manifest).filter(([field]) => field !== "acquisitionId" && field !== "installation"),
  );
  return `sha256:${sha256(JSON.stringify(identity))}`;
}

function sourceEvidence(value: unknown, label: string): FileEvidence {
  const input = record(value, label);
  if (
    typeof input.relativePath !== "string" || input.relativePath === "" ||
    typeof input.size !== "number" || !Number.isSafeInteger(input.size) || input.size < 0 ||
    typeof input.sha256 !== "string" || !/^[0-9a-f]{64}$/u.test(input.sha256)
  ) {
    throw new Error(`${label} is invalid.`);
  }
  return { relativePath: input.relativePath, size: input.size, sha256: input.sha256 };
}

export interface VerifiedSourceFile {
  readonly acquisitionId: string;
  readonly manifestSha256: string;
  readonly evidence: FileEvidence;
  readonly content: Buffer;
}

export async function readSourceSnapshotFile(directory: string, relativePath: string): Promise<VerifiedSourceFile> {
  if (!isAbsolute(directory)) throw new Error("Source acquisition path must be absolute.");
  if (isAbsolute(relativePath) || relativePath.split(/[\\/]/u).some((part) => part === ".." || part === "")) {
    throw new Error("Source evidence path must be a normalized relative path.");
  }
  const root = resolve(directory);
  const [manifestContent, completionContent] = await Promise.all([
    stableRegularFile(join(root, "manifest.json")),
    stableRegularFile(join(root, "complete.json")),
  ]);
  const manifestRecord = record(canonicalJson(manifestContent, "Source manifest"), "Source manifest");
  const completion = record(canonicalJson(completionContent, "Source completion marker"), "Source completion marker");
  if (manifestRecord.schema !== "neodes2-source-manifest-1") throw new Error("Unsupported source manifest schema.");
  if (completion.schema !== "neodes2-source-snapshot-completion-1") throw new Error("Unsupported source completion schema.");
  const acquisitionId = manifestRecord.acquisitionId;
  if (typeof acquisitionId !== "string" || acquisitionId !== manifestIdentity(manifestRecord)) {
    throw new Error("Source acquisition identifier does not match its manifest identity.");
  }
  const manifestSha256 = sha256(manifestContent);
  if (completion.acquisitionId !== acquisitionId || completion.manifestSha256 !== manifestSha256) {
    throw new Error("Source completion marker does not match its manifest.");
  }
  const sources = manifestRecord.sources;
  if (!Array.isArray(sources)) throw new Error("Source manifest sources must be an array.");
  const evidence = sources.map((entry, index) => sourceEvidence(entry, `Source manifest sources[${index}]`))
    .find((entry) => entry.relativePath === relativePath);
  if (evidence === undefined) throw new Error(`Source manifest does not contain ${relativePath}.`);
  const path = resolve(join(root, "sources", ...relativePath.split("/")));
  const sourceRoot = resolve(join(root, "sources"));
  const fromRoot = relative(sourceRoot, path);
  if (fromRoot === "" || fromRoot === ".." || fromRoot.startsWith(`..${sep}`) || isAbsolute(fromRoot)) {
    throw new Error("Source evidence path escapes the source snapshot.");
  }
  const content = await stableRegularFile(path);
  if (content.length !== evidence.size || sha256(content) !== evidence.sha256) {
    throw new Error(`Source evidence ${relativePath} does not match its manifest.`);
  }
  return { acquisitionId, manifestSha256, evidence, content };
}
