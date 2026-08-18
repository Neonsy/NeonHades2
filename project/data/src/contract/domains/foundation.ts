import { derived, editorial, fact } from "../field.js";
import type { DomainContract } from "../types.js";

export const foundationDomain = {
  id: "foundation",
  description: "Shared identity, localization, provenance, search, and spoiler contracts.",
  records: [
    {
      id: "record-metadata",
      description: "Metadata shared by every authoritative factual record.",
      stableId: "record-metadata",
      sourcePatterns: [
        "Content/Scripts/*.lua",
        "Content/Game/**/*.sjson",
        "Content/Game/Text/en/*.sjson",
      ],
      fields: [
        fact({
          id: "stable-id",
          description: "Stable internal game identifier used as the canonical record key.",
          sourceClasses: ["runtime-table", "lua-source", "gameplay-sjson"],
          sourcePatterns: ["Processed table keys", "Lua table keys", "SJSON object names"],
          normalization: "stable-id",
          validations: ["required", "unique", "runtime-source-agree"],
          publication: "internal-evidence",
          requirementIds: ["foundation.authoritative-records"],
        }),
        fact({
          id: "official-name",
          description: "Official English display name associated with the stable identifier.",
          sourceClasses: ["localization-sjson", "runtime-table"],
          sourcePatterns: ["Content/Game/Text/en/*.sjson", "Processed localization tables"],
          normalization: "localized-text",
          validations: ["required", "localized", "runtime-source-agree"],
          requirementIds: ["foundation.authoritative-records", "foundation.search-aliases"],
        }),
        editorial({
          id: "search-aliases",
          description: "Reviewed common names, abbreviations, and useful search aliases.",
          normalization: "ordered-values",
          cardinality: "zero-or-more",
          validations: ["unique"],
          requirementIds: ["foundation.search-aliases"],
        }),
        fact({
          id: "source-references",
          description: "Source and runtime references that support the factual record.",
          sourceClasses: ["lua-source", "gameplay-sjson", "localization-sjson", "runtime-table"],
          sourcePatterns: ["Acquisition source manifest", "Versioned runtime report"],
          normalization: "evidence-reference",
          cardinality: "one-or-more",
          validations: ["required", "references-exist", "runtime-source-agree"],
          publication: "internal-evidence",
          requirementIds: ["foundation.provenance"],
        }),
        fact({
          id: "verified-build",
          description: "Steam build and game content versions verified for the record.",
          sourceClasses: ["runtime-table", "official-platform"],
          sourcePatterns: ["Runtime report envelope", "Steam app manifest"],
          normalization: "evidence-reference",
          validations: ["required"],
          publication: "internal-evidence",
          requirementIds: ["foundation.provenance"],
        }),
        derived({
          id: "spoiler-level",
          description: "Reviewed spoiler classification inherited by public uses of the record.",
          validations: ["spoiler-reviewed"],
          requirementIds: ["foundation.spoilers"],
        }),
      ],
    },
  ],
} as const satisfies DomainContract;
