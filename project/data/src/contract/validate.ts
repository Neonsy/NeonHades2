import type {
  ContractReport,
  ContractValidationResult,
  CoverageLocation,
  DomainContract,
  ProductRequirement,
} from "./types.js";

const idPattern = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;

function addDuplicateError(
  errors: string[],
  seen: Set<string>,
  kind: string,
  id: string,
): void {
  if (seen.has(id)) {
    errors.push(`Duplicate ${kind} id: ${id}`);
  }
  seen.add(id);
}

function validateText(errors: string[], label: string, value: string): void {
  if (value.trim().length === 0) {
    errors.push(`${label} must not be empty.`);
  }
}

function validateUniqueValues(
  errors: string[],
  location: string,
  label: string,
  values: readonly string[],
): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      errors.push(`${location} repeats ${label} ${value}.`);
    }
    seen.add(value);
  }
}

function validateField(
  errors: string[],
  requirementIds: ReadonlySet<string>,
  domainId: string,
  recordId: string,
  field: DomainContract["records"][number]["fields"][number],
): void {
  const location = `${domainId}.${recordId}.${field.id}`;
  validateText(errors, `${location} description`, field.description);

  if (!idPattern.test(field.id)) {
    errors.push(`Invalid field id at ${location}: ${field.id}`);
  }
  if (field.sourceClasses.length === 0) {
    errors.push(`${location} must identify at least one source class.`);
  }
  if (field.sourcePatterns.length === 0) {
    errors.push(`${location} must identify at least one source pattern.`);
  }
  if (field.validations.length === 0) {
    errors.push(`${location} must identify at least one validation rule.`);
  }
  if (field.requirementIds.length === 0) {
    errors.push(`${location} must cover at least one product requirement.`);
  }
  if (!field.validations.includes("build-versioned")) {
    errors.push(`${location} must be build-versioned.`);
  }
  if (field.spoilerLevel !== "none" && !field.validations.includes("spoiler-reviewed")) {
    errors.push(`${location} is spoiler-sensitive and must require spoiler review.`);
  }

  validateUniqueValues(errors, location, "source class", field.sourceClasses);
  validateUniqueValues(errors, location, "source pattern", field.sourcePatterns);
  validateUniqueValues(errors, location, "validation rule", field.validations);

  if (field.claimKind === "fact") {
    if (field.sourceClasses.includes("editorial-analysis")) {
      errors.push(`${location} is factual and cannot use editorial analysis as a source.`);
    }
    if (field.publication === "public-editorial") {
      errors.push(`${location} is factual and cannot be published as editorial content.`);
    }
  }

  if (field.claimKind === "derived") {
    if (!field.sourceClasses.includes("normalized-facts")) {
      errors.push(`${location} is derived and must identify normalized facts as a source.`);
    }
    if (!field.validations.includes("deterministic-derivation")) {
      errors.push(`${location} is derived and must require deterministic derivation.`);
    }
  }

  if (field.claimKind === "editorial") {
    if (!field.sourceClasses.includes("editorial-analysis")) {
      errors.push(`${location} is editorial and must identify editorial analysis as a source.`);
    }
    if (field.publication !== "public-editorial") {
      errors.push(`${location} is editorial and must use the public editorial publication class.`);
    }
    if (!field.validations.includes("editorial-context-complete")) {
      errors.push(`${location} is editorial and must require complete editorial context.`);
    }
  }

  const seenRequirements = new Set<string>();
  for (const requirementId of field.requirementIds) {
    if (seenRequirements.has(requirementId)) {
      errors.push(`${location} repeats product requirement ${requirementId}.`);
    }
    seenRequirements.add(requirementId);

    if (!requirementIds.has(requirementId)) {
      errors.push(`${location} references unknown product requirement ${requirementId}.`);
    }
  }
}

export function validateContract(
  requirements: readonly ProductRequirement[],
  domains: readonly DomainContract[],
): ContractValidationResult {
  const errors: string[] = [];
  const requirementIds = new Set<string>();

  for (const requirement of requirements) {
    addDuplicateError(errors, requirementIds, "product requirement", requirement.id);
    if (!idPattern.test(requirement.id)) {
      errors.push(`Invalid product requirement id: ${requirement.id}`);
    }
    validateText(errors, `${requirement.id} description`, requirement.description);
  }

  const coverage = new Map<string, CoverageLocation[]>();
  const launchCoverage = new Set<string>();
  for (const requirement of requirements) {
    coverage.set(requirement.id, []);
  }

  const domainIds = new Set<string>();
  const recordIds = new Set<string>();
  const fieldLocations = new Set<string>();
  let recordCount = 0;
  let fieldCount = 0;

  for (const domain of domains) {
    addDuplicateError(errors, domainIds, "domain", domain.id);
    if (!idPattern.test(domain.id)) {
      errors.push(`Invalid domain id: ${domain.id}`);
    }
    validateText(errors, `${domain.id} description`, domain.description);

    if (domain.records.length === 0) {
      errors.push(`${domain.id} must own at least one record contract.`);
    }

    for (const record of domain.records) {
      recordCount += 1;
      const recordLocation = `${domain.id}.${record.id}`;
      addDuplicateError(errors, recordIds, "record", recordLocation);
      if (!idPattern.test(record.id)) {
        errors.push(`Invalid record id at ${recordLocation}: ${record.id}`);
      }
      validateText(errors, `${recordLocation} description`, record.description);
      validateText(errors, `${recordLocation} stable id`, record.stableId);

      if (record.sourcePatterns.length === 0) {
        errors.push(`${recordLocation} must identify at least one source pattern.`);
      }
      if (record.fields.length === 0) {
        errors.push(`${recordLocation} must define at least one field.`);
      }

      for (const field of record.fields) {
        fieldCount += 1;
        const fieldLocation = `${recordLocation}.${field.id}`;
        addDuplicateError(errors, fieldLocations, "field", fieldLocation);
        validateField(errors, requirementIds, domain.id, record.id, field);

        for (const requirementId of field.requirementIds) {
          const locations = coverage.get(requirementId);
          if (locations !== undefined) {
            locations.push({
              domainId: domain.id,
              recordId: record.id,
              fieldId: field.id,
            });
          }
          if (field.completion === "launch-required") {
            launchCoverage.add(requirementId);
          }
        }
      }
    }
  }

  for (const requirement of requirements) {
    const locations = coverage.get(requirement.id);
    if (locations === undefined || locations.length === 0) {
      errors.push(`Uncovered product requirement: ${requirement.id}`);
    }
    if (requirement.launchBlocking && !launchCoverage.has(requirement.id)) {
      errors.push(`Launch-blocking requirement lacks launch-required coverage: ${requirement.id}`);
    }
  }

  const frozenCoverage = new Map<string, readonly CoverageLocation[]>();
  for (const [requirementId, locations] of coverage) {
    frozenCoverage.set(requirementId, locations);
  }

  const report: ContractReport = {
    requirementCount: requirements.length,
    domainCount: domains.length,
    recordCount,
    fieldCount,
    launchBlockingRequirementCount: requirements.filter(
      (requirement) => requirement.launchBlocking,
    ).length,
    coverage: frozenCoverage,
  };

  return {
    errors,
    report,
  };
}
