import type { ContractReport, ProductRequirement } from "./types.js";

export function renderContractReport(
  schema: string,
  requirements: readonly ProductRequirement[],
  report: ContractReport,
): string {
  const lines = [
    "NeonHades2 acquisition contract",
    `Contract schema: ${schema}`,
    `Product requirements: ${report.requirementCount}`,
    `Launch-blocking requirements: ${report.launchBlockingRequirementCount}`,
    `Domains: ${report.domainCount}`,
    `Record contracts: ${report.recordCount}`,
    `Field contracts: ${report.fieldCount}`,
    "",
    "Coverage by product requirement:",
  ];

  for (const requirement of requirements) {
    const locations = report.coverage.get(requirement.id) ?? [];
    const renderedLocations = locations
      .map(({ domainId, recordId, fieldId }) => `${domainId}.${recordId}.${fieldId}`)
      .join(", ");
    lines.push(`- ${requirement.id}: ${renderedLocations}`);
  }

  return `${lines.join("\n")}\n`;
}
