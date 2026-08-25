import type { PublicationAllowlist } from "../data-ready/index.js";
import type { PublicationDataset, PublicationReport } from "./types.js";

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function forbiddenValue(value: unknown): boolean {
  return (
    typeof value === "string" &&
    (/^[A-Za-z0-9_]+Data\.[A-Za-z0-9_.:-]+$/u.test(value) ||
      /^[A-Za-z]:\\|^(?:\/|\\\\)/u.test(value))
  );
}

export function createPublicationReport(
  dataset: PublicationDataset,
  allowlist: PublicationAllowlist,
): PublicationReport {
  const allowed = new Set(allowlist.allowedFields.map((field) => field.id));
  const recordKeys = dataset.records.map((record) => record.key);
  const recordKeySet = new Set(recordKeys);
  const duplicateRecordKeys = [
    ...new Set(
      recordKeys.filter(
        (recordKey, index) => recordKeys.indexOf(recordKey) !== index,
      ),
    ),
  ].sort(compareStrings);
  const expectedFields = new Map<string, string[]>();
  for (const field of allowlist.allowedFields) {
    const recordType = field.id.slice(0, field.id.lastIndexOf("/"));
    const fields = expectedFields.get(recordType) ?? [];
    fields.push(field.id);
    expectedFields.set(recordType, fields);
  }
  const missingAllowedFieldIds = dataset.records
    .flatMap((record) => {
      const actual = new Set(record.fields.map((field) => field.id));
      return (expectedFields.get(record.recordType) ?? [])
        .filter((fieldId) => !actual.has(fieldId))
        .map((fieldId) => `${record.key}/${fieldId}`);
    })
    .sort(compareStrings);
  const forbiddenFieldIds = [
    ...new Set(
      dataset.records.flatMap((record) =>
        record.fields
          .filter(
            (field) =>
              !allowed.has(field.id) ||
              !field.id.startsWith(`${record.recordType}/`),
          )
          .map((field) => `${record.key}/${field.id}`),
      ),
    ),
  ].sort(compareStrings);
  const forbiddenPayloadPaths: string[] = [];
  const forbiddenKey =
    /^(?:evidence|runtimePath|runtimePaths|localizationPath|saveData|binary|sourceText)$|(?:Icon|Animation|Granny|Vfx|Sfx|Sound|Cue|Voice|TextLine|Portrait|Texture|Model|Image|Video|Audio)/iu;
  const scan = (value: unknown, path: string): void => {
    if (
      forbiddenValue(value) ||
      (typeof value === "string" &&
        /\{(?:#|!|\$[A-Za-z0-9_]+Data\.)/u.test(value))
    ) {
      forbiddenPayloadPaths.push(path);
    } else if (Array.isArray(value))
      value.forEach((entry, index) => scan(entry, `${path}[${index}]`));
    else if (typeof value === "object" && value !== null) {
      for (const [entryKey, entry] of Object.entries(value)) {
        const entryPath = `${path}.${entryKey}`;
        if (forbiddenKey.test(entryKey)) forbiddenPayloadPaths.push(entryPath);
        if (entryKey !== "href") scan(entry, entryPath);
      }
    }
  };
  scan(
    {
      records: dataset.records,
      pages: dataset.pages,
      search: dataset.search,
      relationships: dataset.relationships,
      conditions: dataset.conditions,
    },
    "publication",
  );
  const forwardKeys = new Set(
    dataset.relationships.forward.map(
      (edge) =>
        `${edge.sourceKey}\u0000${edge.targetKey}\u0000${edge.fields.join("\u0000")}`,
    ),
  );
  const reverseKeys = new Set(
    dataset.relationships.reverse.map(
      (edge) =>
        `${edge.targetKey}\u0000${edge.sourceKey}\u0000${edge.fields.join("\u0000")}`,
    ),
  );
  const incompleteReverseRelationships = [
    ...[...forwardKeys]
      .filter((edge) => !reverseKeys.has(edge))
      .map((edge) => `missing:${edge}`),
    ...[...reverseKeys]
      .filter((edge) => !forwardKeys.has(edge))
      .map((edge) => `extra:${edge}`),
  ].sort(compareStrings);
  const pagesWithoutRecords = dataset.pages
    .filter((page) => page.recordKeys.length === 0)
    .map((page) => page.id)
    .sort(compareStrings);
  const searchable = new Set(dataset.search.map((entry) => entry.recordKey));
  const recordsWithoutSearchTerms = dataset.records
    .filter((record) => record.public !== null && !searchable.has(record.key))
    .map((record) => record.key)
    .sort(compareStrings);
  const publicRoutes = new Map<string, PublicationDataset["records"][number][]>();
  for (const record of dataset.records) {
    if (
      record.public === null ||
      record.public.presentation !== "detail" ||
      !record.public.href.startsWith("/knowledge/records/")
    )
      continue;
    const matches = publicRoutes.get(record.public.href) ?? [];
    matches.push(record);
    publicRoutes.set(record.public.href, matches);
  }
  const duplicatePublicRoutes = [...publicRoutes.entries()]
    .filter(([, matches]) => matches.length > 1)
    .map(
      ([href, matches]) =>
        `${href}:${matches
          .map((record) => record.key)
          .sort(compareStrings)
          .join(",")}`,
    )
    .sort(compareStrings);
  const invalidPublicModels = dataset.records
    .flatMap((record) => {
      const model = record.public;
      if (model === null) {
        return record.publication.status === "excluded"
          ? []
          : [`${record.key}:disposition`];
      }
      const failures: string[] = [];
      if (record.publication.status !== "published")
        failures.push("disposition");
      else if (
        record.publication.category !== model.category ||
        record.publication.presentation !== model.presentation
      ) {
        failures.push("ownership");
      }
      if (model.name.trim() === "") failures.push("name");
      if (model.slug.trim() === "") failures.push("slug");
      if (model.typeLabel.trim() === "") failures.push("typeLabel");
      if (model.category.trim() === "") failures.push("category");
      if (!model.href.startsWith("/") || /[A-Z_]/u.test(model.href))
        failures.push("href");
      return failures.map((failure) => `${record.key}:${failure}`);
    })
    .sort(compareStrings);
  const relationshipTargets = new Set([
    ...recordKeys,
    ...dataset.conditions.map((condition) => condition.key),
  ]);
  const unresolvedReferences = [
    ...dataset.relationships.forward
      .filter(
        (edge) =>
          !recordKeySet.has(edge.sourceKey) ||
          !relationshipTargets.has(edge.targetKey),
      )
      .map((edge) => `relationship:${edge.sourceKey}->${edge.targetKey}`),
    ...dataset.conditions.flatMap((condition) =>
      condition.dependentRecordKeys
        .filter((recordKey) => !recordKeySet.has(recordKey))
        .map((recordKey) => `condition:${condition.key}->${recordKey}`),
    ),
    ...dataset.pages.flatMap((page) =>
      page.recordKeys
        .filter((recordKey) => !recordKeySet.has(recordKey))
        .map((recordKey) => `page:${page.id}->${recordKey}`),
    ),
    ...dataset.search
      .filter((entry) => !recordKeySet.has(entry.recordKey))
      .map((entry) => `search:${entry.normalizedTerm}->${entry.recordKey}`),
  ].sort(compareStrings);
  const report: PublicationReport = {
    schema: "neodes2-publication-report-1",
    counts: {
      records: dataset.records.length,
      pages: dataset.pages.length,
      searchEntries: dataset.search.length,
      forwardRelationships: dataset.relationships.forward.length,
      reverseRelationships: dataset.relationships.reverse.length,
      conditions: dataset.conditions.length,
    },
    duplicateRecordKeys,
    missingAllowedFieldIds,
    forbiddenFieldIds,
    forbiddenPayloadPaths: [...new Set(forbiddenPayloadPaths)].sort(
      compareStrings,
    ),
    unresolvedReferences,
    incompleteReverseRelationships,
    pagesWithoutRecords,
    recordsWithoutSearchTerms,
    duplicatePublicRoutes,
    invalidPublicModels,
    complete: false,
  };
  return {
    ...report,
    complete: [
      report.duplicateRecordKeys,
      report.missingAllowedFieldIds,
      report.forbiddenFieldIds,
      report.forbiddenPayloadPaths,
      report.unresolvedReferences,
      report.incompleteReverseRelationships,
      report.pagesWithoutRecords,
      report.recordsWithoutSearchTerms,
      report.duplicatePublicRoutes,
      report.invalidPublicModels,
    ].every((issues) => issues.length === 0),
  };
}
