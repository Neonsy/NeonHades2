import {
  acquisitionContract,
  renderContractReport,
  validateContract,
} from "./contract/index.js";

const result = validateContract(
  acquisitionContract.requirements,
  acquisitionContract.domains,
);

if (result.errors.length > 0) {
  console.error("NeonHades2 acquisition contract is invalid:");
  for (const error of result.errors) {
    console.error(`- ${error}`);
  }
  process.exitCode = 1;
} else {
  process.stdout.write(
    renderContractReport(
      acquisitionContract.schema,
      acquisitionContract.requirements,
      result.report,
    ),
  );
}
