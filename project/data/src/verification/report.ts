import { acquisitionContract, type ClaimKind, type SpoilerLevel, type ValidationRule } from "../contract/index.js";
import type { CombinedDataset } from "../dataset/index.js";
import type { CalculationRules } from "./source-rules.js";
import { verifyCalculations, type CalculationVerificationReport } from "./calculations.js";
import { compileRequirementGraph, type RequirementGraph } from "./requirements.js";

export type ManualVerificationKind = "observation" | "spoiler-review";

export interface ManualVerificationTask {
  readonly id: string;
  readonly claimKind: ClaimKind;
  readonly spoilerLevel: SpoilerLevel;
  readonly requiredChecks: readonly ManualVerificationKind[];
  readonly status: "pending";
}

export interface AutomatedVerificationReport {
  readonly schema: "neodes2-automated-verification-1";
  readonly sourceDatasetAcquisitionId: string;
  readonly requirementGraph: RequirementGraph;
  readonly calculations: CalculationVerificationReport;
  readonly manualTasks: readonly ManualVerificationTask[];
  readonly automatedComplete: boolean;
  readonly manualComplete: false;
  readonly phaseComplete: false;
}

const manualRules = {
  "observation-required": "observation",
  "spoiler-reviewed": "spoiler-review",
} as const satisfies Partial<Record<ValidationRule, ManualVerificationKind>>;

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function collectManualTasks(): readonly ManualVerificationTask[] {
  return acquisitionContract.domains.flatMap((domain) => domain.records.flatMap((record) => record.fields.flatMap((field) => {
    const requiredChecks = field.validations.flatMap((validation) => {
      const kind = manualRules[validation as keyof typeof manualRules];
      return kind === undefined ? [] : [kind];
    });
    if (requiredChecks.length === 0) return [];
    return [{
      id: `${domain.id}/${record.id}/${field.id}`,
      claimKind: field.claimKind,
      spoilerLevel: field.spoilerLevel,
      requiredChecks: [...new Set(requiredChecks)].sort(compareStrings),
      status: "pending" as const,
    }];
  }))).sort((left, right) => compareStrings(left.id, right.id));
}

export function verifyDataset(
  dataset: CombinedDataset,
  calculationRules: CalculationRules,
): AutomatedVerificationReport {
  const requirementGraph = compileRequirementGraph(dataset);
  const calculations = verifyCalculations(dataset, calculationRules);
  return {
    schema: "neodes2-automated-verification-1",
    sourceDatasetAcquisitionId: dataset.source.acquisitionId,
    requirementGraph,
    calculations,
    manualTasks: collectManualTasks(),
    automatedComplete: requirementGraph.complete && calculations.complete,
    manualComplete: false,
    phaseComplete: false,
  };
}
