import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createPublicationAllowlist } from "../src/index.js";

describe("data-ready publication policy", () => {
  it("allows only public contract fields and keeps sensitive collections behind their reviewed boundaries", () => {
    const allowlist = createPublicationAllowlist();
    assert.deepEqual(allowlist.structuralKeys, ["recordType", "id"]);
    assert.deepEqual(allowlist.excludedFields, [
      { id: "foundation/record-metadata/source-references", reason: "internal-evidence" },
      { id: "foundation/record-metadata/stable-id", reason: "internal-evidence" },
      { id: "foundation/record-metadata/verified-build", reason: "internal-evidence" },
      { id: "world-progression/narrative-milestone/completion-evidence", reason: "internal-evidence" },
    ]);
    assert.deepEqual([...new Set(allowlist.allowedFields.map((field) => field.publication))].sort(), ["public-editorial", "public-fact"]);
    assert.equal(allowlist.allowedFields.find((field) => field.id === "world-progression/achievement/trigger")?.spoilerLevel, "ending");
    assert.equal(allowlist.allowedFields.find((field) => field.id === "world-progression/prophecy/objectives")?.spoilerLevel, "ending");
    assert.equal(allowlist.allowedFields.find((field) => field.id === "world-progression/relationship/character")?.spoilerLevel, "story");
    assert.deepEqual(allowlist.forbiddenPayloadCategories, [
      "raw-source-text",
      "raw-runtime-structures",
      "private-save-state",
      "binary-assets",
    ]);
  });
});
