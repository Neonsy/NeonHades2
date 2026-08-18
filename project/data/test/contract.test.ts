import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  coverageLedger,
  acquisitionContract,
  productRequirements,
  validateContract,
  type DomainContract,
  type ProductRequirement,
} from "../src/contract/index.js";

describe("acquisition contract", () => {
  it("covers every product requirement with a valid field contract", () => {
    const result = validateContract(productRequirements, coverageLedger);

    assert.deepEqual(result.errors, []);
    assert.equal(result.report.requirementCount, productRequirements.length);
    assert.equal(result.report.launchBlockingRequirementCount, productRequirements.length);
    assert.equal(acquisitionContract.schema, "neodes2-acquisition-contract-1");
    assert.equal(acquisitionContract.game.steamAppId, "1145350");
    assert.equal(acquisitionContract.game.language, "en");

    for (const requirement of productRequirements) {
      assert.ok((result.report.coverage.get(requirement.id)?.length ?? 0) > 0);
    }
  });

  it("rejects duplicate and uncovered product requirements", () => {
    const requirement: ProductRequirement = {
      id: "test.requirement",
      section: "foundation",
      description: "Test requirement.",
      launchBlocking: true,
    };

    const result = validateContract([requirement, requirement], []);

    assert.ok(result.errors.includes("Duplicate product requirement id: test.requirement"));
    assert.ok(result.errors.includes("Uncovered product requirement: test.requirement"));
  });

  it("rejects fields with unknown requirements and incomplete evidence rules", () => {
    const requirement: ProductRequirement = {
      id: "test.requirement",
      section: "foundation",
      description: "Test requirement.",
      launchBlocking: true,
    };
    const domains: readonly DomainContract[] = [
      {
        id: "test",
        description: "Test domain.",
        records: [
          {
            id: "record",
            description: "Test record.",
            stableId: "test stable id",
            sourcePatterns: ["test source"],
            fields: [
              {
                id: "field",
                description: "Test field.",
                claimKind: "fact",
                cardinality: "exactly-one",
                sourceClasses: [],
                sourcePatterns: [],
                normalization: "scalar",
                validations: ["required"],
                publication: "public-fact",
                spoilerLevel: "none",
                completion: "launch-required",
                requirementIds: ["unknown.requirement"],
              },
            ],
          },
        ],
      },
    ];

    const result = validateContract([requirement], domains);

    assert.ok(
      result.errors.includes("test.record.field must identify at least one source class."),
    );
    assert.ok(
      result.errors.includes("test.record.field must identify at least one source pattern."),
    );
    assert.ok(result.errors.includes("test.record.field must be build-versioned."));
    assert.ok(
      result.errors.includes(
        "test.record.field references unknown product requirement unknown.requirement.",
      ),
    );
    assert.ok(result.errors.includes("Uncovered product requirement: test.requirement"));
  });

  it("requires launch coverage and spoiler review", () => {
    const requirement: ProductRequirement = {
      id: "test.requirement",
      section: "foundation",
      description: "Test requirement.",
      launchBlocking: true,
    };
    const domains: readonly DomainContract[] = [
      {
        id: "test",
        description: "Test domain.",
        records: [
          {
            id: "record",
            description: "Test record.",
            stableId: "test stable id",
            sourcePatterns: ["test source"],
            fields: [
              {
                id: "field",
                description: "Test field.",
                claimKind: "fact",
                cardinality: "exactly-one",
                sourceClasses: ["lua-source"],
                sourcePatterns: ["test source"],
                normalization: "scalar",
                validations: ["required", "build-versioned"],
                publication: "public-fact",
                spoilerLevel: "story",
                completion: "conditional",
                requirementIds: ["test.requirement"],
              },
            ],
          },
        ],
      },
    ];

    const result = validateContract([requirement], domains);

    assert.ok(
      result.errors.includes(
        "test.record.field is spoiler-sensitive and must require spoiler review.",
      ),
    );
    assert.ok(
      result.errors.includes(
        "Launch-blocking requirement lacks launch-required coverage: test.requirement",
      ),
    );
  });
});
