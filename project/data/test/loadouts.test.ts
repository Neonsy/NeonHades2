import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import { auditLoadoutSources } from "../src/index.js";

function localized(id: string, description = true): string {
  return `{
  Id = "${id}"
  DisplayName = "${id} name"
${description ? `  Description = "${id} description"\n` : ""}}
`;
}

async function writeSyntheticSources(directory: string): Promise<void> {
  const scripts = join(directory, "sources", "Content", "Scripts");
  const text = join(directory, "sources", "Content", "Game", "Text", "en");
  await mkdir(scripts, { recursive: true });
  await mkdir(text, { recursive: true });

  const keepsakes = Array.from({ length: 33 }, (_, index) => `Keepsake${index + 1}`);
  const familiars = Array.from({ length: 5 }, (_, index) => `Familiar${index + 1}`);
  const upgradeGroups = Array.from({ length: 15 }, (_, index) => `FamiliarUpgrade${index + 1}`);
  const hexes = Array.from({ length: 9 }, (_, index) => ({
    id: `Hex${index + 1}`,
    traitId: `HexTrait${index + 1}`,
    talentId: `HexTalent${index + 1}`,
  }));
  const incantationId = "WorldUpgradeSynthetic";

  await writeFile(
    join(scripts, "KeepsakeData.lua"),
    keepsakes.map((id) => `{ Gift = "${id}" },`).join("\n"),
  );
  await writeFile(
    join(scripts, "TraitData_Keepsake.lua"),
    `TraitData = {
  Active = { ExtractValues = { { Format = "Percent" } } },
  -- Commented = { ExtractValues = { { Format = "UnsupportedCommentedFormat" } } },
}
`,
  );
  await writeFile(
    join(scripts, "FamiliarData.lua"),
    `FamiliarOrderData = { ${familiars.map((id) => `"${id}"`).join(", ")} }
TraitData = {}
`,
  );
  await writeFile(
    join(scripts, "FamiliarShopData.lua"),
    `FamiliarShopItemData = {
${upgradeGroups.flatMap((id) => [id, `${id}2`, `${id}3`]).map((id) => `  ${id} = {},`).join("\n")}
}
${upgradeGroups.map((id) => `{ ShowLastInGroup = "${id}" },`).join("\n")}
`,
  );
  await writeFile(
    join(scripts, "SpellData.lua"),
    `SpellData = {
${hexes.map((hex) => `  ${hex.id} = { TraitName = "${hex.traitId}", Talents = { "${hex.talentId}" } },`).join("\n")}
}
`,
  );
  await writeFile(
    join(scripts, "TraitData_Spell.lua"),
    "TraitData = {}\n",
  );
  await writeFile(
    join(scripts, "TraitData_Talent.lua"),
    `TraitSetData.Talents = {
  Damage = { ExtractValues = { { Format = "DamageOverTime" } } },
  Slot = { ExtractValues = { { Format = "SlottedBoon" } } },
  -- Old = { ExtractValues = { { Format = "UnsupportedCommentedFormat" } } },
}
`,
  );
  await writeFile(
    join(scripts, "WorldUpgradeData.lua"),
    `WorldUpgradeData = { ${incantationId} = {} }
GameData.WorldUpgradeAutomaticUnlocks = {}
`,
  );

  const localization = [
    ...keepsakes.map((id) => localized(id)),
    ...familiars.flatMap((id) => [localized(id, false), localized(`${id}_FlavorText`, false)]),
    ...upgradeGroups.map((id) => localized(id)),
    ...hexes.flatMap((hex) => [localized(hex.traitId), localized(hex.talentId)]),
    localized(incantationId),
  ].join("\n");
  const localizationFiles = [
    "HelpText.en.sjson",
    "TraitText.en.sjson",
    "_FamiliarData.en.sjson",
    "_KeepsakeData.en.sjson",
    "_TraitData_Keepsake.en.sjson",
    "_TraitData_Spell.en.sjson",
    "_WorldUpgradeData.en.sjson",
  ];
  await Promise.all(
    localizationFiles.map((name, index) => writeFile(join(text, name), index === 0 ? localization : "")),
  );
}

describe("loadout source audit", () => {
  it("ignores commented identifiers and recognizes supported Path of Stars formats", async () => {
    const directory = await mkdtemp(join(tmpdir(), "neodes2-loadout-audit-"));
    try {
      await writeSyntheticSources(directory);
      const audit = await auditLoadoutSources(directory);

      assert.equal(audit.complete, true);
      assert.deepEqual(audit.extractionFormats, ["DamageOverTime", "Percent", "SlottedBoon"]);
      assert.equal(audit.extractionFormats.includes("UnsupportedCommentedFormat"), false);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
