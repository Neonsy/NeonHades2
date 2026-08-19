import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  createAspectTrainingPlan,
  renderAspectTrainingCommand,
  renderRestoreTrainingCommand,
  renderTrainingArm,
  renderTrainingConfig,
  validateLuaStructure,
  type CombinedDataset,
  type VerifiedCombinedDataset,
} from "../src/index.js";

function dataset(): VerifiedCombinedDataset {
  const combined = {
    schema: "neodes2-dataset-1",
    source: {
      acquisitionId: "sha256:source",
      sourceManifestSha256: "source-manifest",
      exporterVersion: "exporter",
      steamBuildId: "build",
      executableVersion: "executable",
      packageVersion: "package",
    },
    domainAcquisitionIds: {} as CombinedDataset["domainAcquisitionIds"],
    domains: {
      weapons: {
        aspects: [
          { id: "ZAspect", weaponId: "WeaponZ", name: "Aspect Z" },
          { id: "AAspect", weaponId: "WeaponA", name: "Aspect A" },
        ],
      },
    } as unknown as CombinedDataset["domains"],
  } satisfies CombinedDataset;
  return {
    acquisitionId: "sha256:dataset",
    datasetSha256: "dataset-hash",
    manifestSha256: "dataset-manifest",
    dataset: combined,
    validation: {} as VerifiedCombinedDataset["validation"],
  };
}

describe("aspect training preparation", () => {
  it("derives deterministic dataset-bound aspect commands", () => {
    const verified = dataset();
    const plan = createAspectTrainingPlan(verified);
    assert.deepEqual(plan.scenarios.map((scenario) => scenario.aspectId), ["AAspect", "ZAspect"]);
    assert.equal(plan.scenarios[0]?.commandId, "aspect-01-AAspect");
    const command = renderAspectTrainingCommand(plan.scenarios[0]!, verified.acquisitionId);
    assert.match(command, /^schema=neodes2-training-command-1$/mu);
    assert.match(command, /^dataset_acquisition_id=sha256:dataset$/mu);
    assert.match(command, /^weapon_id=WeaponA$/mu);
    assert.match(command, /^aspect_id=AAspect$/mu);
    assert.match(renderRestoreTrainingCommand(verified.acquisitionId), /^action=restore$/mu);
    assert.match(renderTrainingArm("nonce", verified.acquisitionId), /^session_nonce=nonce$/mu);
    assert.match(renderTrainingConfig(verified), /schema = "neodes2-training-config-1"/u);
  });

  it("keeps the runtime harness armed, reversible, and outside progression APIs", async () => {
    const modDirectory = join(process.cwd(), "mod", "neodes2-training-harness");
    const [main, manifestText] = await Promise.all([
      readFile(join(modDirectory, "main.lua"), "utf8"),
      readFile(join(modDirectory, "manifest.json"), "utf8"),
    ]);
    const manifest: unknown = JSON.parse(manifestText);
    assert.equal((manifest as Readonly<Record<string, unknown>>).version_number, /HARNESS_VERSION = "([^"]+)"/u.exec(main)?.[1]);
    assert.match(main, /session_nonce == session_nonce/u);
    assert.match(main, /restore_original/u);
    assert.match(main, /NeonHades2TrainingHarnessGeneration/u);
    assert.match(main, /while game\[GENERATION_KEY\] == active_generation do/u);
    assert.match(main, /game\.thread\(poll_commands, active_generation\)/u);
    assert.match(main, /game\.wait\(0\.25\)/u);
    assert.equal(main.match(/game\.RefillMana\(\)/gu)?.length, 1);
    assert.doesNotMatch(main, /(?<![.\w])(?:thread|wait)\s*\(/u);
    assert.doesNotMatch(main, /\bgame\.(?:SaveProfile|LoadMap|StartOver|CheckQuestStatus|UnlockAchievement|SendAchievement)\s*\(/u);
    assert.doesNotMatch(main, /GameState\.(?:WeaponsUnlocked|WorldUpgrades|WorldUpgradesAdded|QuestStatus|TextLinesRecord)\s*\[/u);
    assert.deepEqual(validateLuaStructure(main), []);
  });

  it("equips the linked spell required by an aspect", async () => {
    const main = await readFile(join(process.cwd(), "mod", "neodes2-training-harness", "main.lua"), "utf8");
    assert.match(main, /if trait_data\.LinkedSpell then/u);
    assert.match(main, /game\.SpellData\[trait_data\.LinkedSpell\]/u);
    assert.match(main, /game\.GetHeroTrait\(spell_data\.TraitName\) == nil/u);
    assert.match(main, /game\.CurrentRun\.Hero\.SlottedSpell = game\.DeepCopyTable\(spell_data\)/u);
    assert.match(main, /game\.CreateTalentTree\(spell_data\)/u);
    assert.match(main, /game\.UpdateSpellActiveStatus\(\)/u);
  });

  it("applies aspect weapon models outside the weapon shop", async () => {
    const main = await readFile(join(process.cwd(), "mod", "neodes2-training-harness", "main.lua"), "utf8");
    assert.match(main, /game\.UpdateWeaponKitUpgrade\(trait_data\.RequiredWeapon, aspect_id\)/u);
    assert.match(main, /Property = "GrannyAlternateModelAttachment"/u);
    assert.match(main, /OriginalAttachmentModel = original_model/u);
    assert.match(main, /DestinationId = game\.CurrentRun\.Hero\.ObjectId/u);
  });

  it("finishes aspect cleanup before starting replacement setup", async () => {
    const main = await readFile(join(process.cwd(), "mod", "neodes2-training-harness", "main.lua"), "utf8");
    const cleanup = "game.CallFunctionName(trait_data.OnUnequipFunctionName)";
    const unequip = "game.UnequipWeaponUpgrade({ SkipUIUpdate = true, SkipUnequipFunctionName = skip_unequip_function })";
    const cleanupBoundary = "game.wait(0.1)";
    assert.ok(main.includes(cleanup));
    assert.ok(main.includes(unequip));
    assert.ok(main.includes(cleanupBoundary));
    assert.ok(main.indexOf(cleanup) < main.indexOf(unequip));
    assert.ok(main.indexOf(unequip) < main.indexOf(cleanupBoundary));
  });
});
