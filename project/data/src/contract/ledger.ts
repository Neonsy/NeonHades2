import { editorialDomain } from "./domains/editorial.js";
import { foundationDomain } from "./domains/foundation.js";
import { mechanicsDomain } from "./domains/mechanics.js";
import { worldProgressionDomain } from "./domains/world-progression.js";
import type { DomainContract } from "./types.js";

export const coverageLedger = [
  foundationDomain,
  mechanicsDomain,
  worldProgressionDomain,
  editorialDomain,
] as const satisfies readonly DomainContract[];
