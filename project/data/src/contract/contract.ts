import { coverageLedger } from "./ledger.js";
import { productRequirements } from "./requirements.js";
import type { AcquisitionContract } from "./types.js";

export const acquisitionContract = {
  schema: "neodes2-acquisition-contract-1",
  project: "NeonHades2",
  game: {
    steamAppId: "1145350",
    language: "en",
  },
  requirements: productRequirements,
  domains: coverageLedger,
} as const satisfies AcquisitionContract;
