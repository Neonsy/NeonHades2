import { acquisitionContract } from "../contract/index.js";
import type { PublicationStatus } from "../contract/index.js";
import type { PublicationAllowlist } from "./types.js";

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isPublicPublication(value: PublicationStatus): value is Exclude<PublicationStatus, "internal-evidence"> {
  return value !== "internal-evidence";
}

export function createPublicationAllowlist(): PublicationAllowlist {
  const fields = acquisitionContract.domains.flatMap((domain) => domain.records.flatMap((record) =>
    record.fields.map((field) => ({ field, id: `${domain.id}/${record.id}/${field.id}` }))));
  return {
    schema: "neodes2-publication-allowlist-1",
    structuralKeys: ["recordType", "id"],
    allowedFields: fields
      .flatMap(({ field, id }) => isPublicPublication(field.publication)
        ? [{ id, publication: field.publication, spoilerLevel: field.spoilerLevel }]
        : [])
      .sort((left, right) => compareStrings(left.id, right.id)),
    excludedFields: fields
      .filter(({ field }) => field.publication === "internal-evidence")
      .map(({ id }) => ({ id, reason: "internal-evidence" as const }))
      .sort((left, right) => compareStrings(left.id, right.id)),
    forbiddenPayloadCategories: [
      "raw-source-text",
      "raw-runtime-structures",
      "private-save-state",
      "binary-assets",
    ],
  };
}
