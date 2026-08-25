import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import type { JsonValue } from "../boons/runtime-schema.js";

export interface StaticCondition {
  readonly path: readonly string[];
  readonly comparison: "true" | "false" | "=" | "!=" | ">" | ">=" | "<" | "<=";
  readonly value?: JsonValue;
  readonly qualifiers: Readonly<Record<string, JsonValue>>;
}

export interface StaticCost {
  readonly resourceId: string;
  readonly amount: number;
}

export interface StaticElement {
  readonly id: string;
  readonly essenceTraitId: string;
}

export interface StaticGatheringTool {
  readonly id: string;
  readonly baseToolId: string;
  readonly level: number;
  readonly displayName: string;
  readonly description: string;
  readonly costs: readonly StaticCost[];
  readonly unlockConditions: readonly StaticCondition[];
  readonly elementYield: null | {
    readonly elementId: string;
    readonly essenceTraitId: string;
    readonly chance: number;
  };
}

export interface StaticFishCatchRule {
  readonly weight: number;
  readonly conditions: readonly StaticCondition[];
}

export interface StaticFish {
  readonly id: string;
  readonly resourceId: string;
  readonly regionId: string;
  readonly rarity: "common" | "rare" | "legendary";
  readonly catchRules: readonly StaticFishCatchRule[];
  readonly sellValue: number;
  readonly sellCurrencyId: string;
}

export interface StaticCultivation {
  readonly id: string;
  readonly seedResourceId: string;
  readonly outputResourceId: string;
  readonly outputAmount: number;
  readonly growTimeMin: number;
  readonly growTimeMax: number;
  readonly weight: number;
  readonly conditions: readonly StaticCondition[];
  readonly bonusSeedResourceId: string | null;
}

export interface StaticMarketOffer {
  readonly id: string;
  readonly categoryId: string;
  readonly outputResourceId: string;
  readonly outputAmount: number;
  readonly costs: readonly StaticCost[];
  readonly availability: readonly StaticCondition[];
  readonly refreshOncePerRun: boolean;
}

export interface StaticRunReward {
  readonly id: string;
  readonly displayName: string;
  readonly description: string | null;
  readonly effectKind:
    | "boon-choice"
    | "hermes-boon-choice"
    | "two-god-boon-choice"
    | "hex-choice"
    | "hammer-choice"
    | "boon-level"
    | "path-upgrades"
    | "maximum-health"
    | "maximum-magick"
    | "gold"
    | "resource";
  readonly amount: number | null;
  readonly resourceId: string | null;
  readonly availability: readonly StaticCondition[];
  readonly selectionSources: readonly {
    readonly storeId: string;
    readonly kind: "room-door" | "subroom" | "scripted";
    readonly alternatives: readonly (readonly StaticCondition[])[];
  }[];
}

export interface StaticOpeningState {
  readonly id: "first-night-opening";
  readonly roomId: string;
  readonly encounterId: string;
  readonly rewardKind: string;
  readonly godId: string;
  readonly boonIds: readonly string[];
  readonly forcedCommonRarity: boolean;
}

export interface StaticGodAppearance {
  readonly godId: string;
  readonly appearanceKind: "boon-pool" | "secret-door";
  readonly initialRequirementId: string;
  readonly initialConditions: readonly StaticCondition[];
  readonly repeatRequirementId: string | null;
  readonly repeatConditions: readonly StaticCondition[];
  readonly forcedRoomIds: readonly string[];
  readonly secretDoorChance: number | null;
  readonly minimumRoomsBetweenAppearances: number | null;
}

export interface StaticEncounterAid {
  readonly id: string;
  readonly providerId: string;
  readonly displayName: string;
  readonly description: string;
  readonly availability: readonly StaticCondition[];
  readonly buildTags: readonly string[];
}

export interface StaticEncounterAppearance {
  readonly encounterId: string;
  readonly regionId: string;
  readonly appearanceConditions: readonly StaticCondition[];
}

export interface StaticEncounterFriend {
  readonly id: string;
  readonly displayName: string;
  readonly appearances: readonly StaticEncounterAppearance[];
  readonly maxAppearancesPerBiome: number;
  readonly aidIds: readonly string[];
}

export interface StaticStrifeCurseStage {
  readonly regionId: string;
  readonly roomId: string;
  readonly maximumCompletedNights: number;
  readonly compensation: StaticCost;
}

export interface StaticStrifeCurse {
  readonly id: "strife-blessing";
  readonly traitId: "ErisCurseTrait";
  readonly displayName: string;
  readonly description: string;
  readonly baseEnemyDamagePercent: number;
  readonly perEncounterEnemyDamagePercent: number;
  readonly maximumEncounterAdditions: number;
  readonly maximumEnemyDamagePercent: number;
  readonly duration: "remainder-of-current-night";
  readonly criticalHealthSuppression: {
    readonly requiresNoDeathDefiance: true;
    readonly maximumHealthFraction: number;
  };
  readonly stages: readonly StaticStrifeCurseStage[];
}

export interface StaticSurfacePenalty {
  readonly id: "surface-ward";
  readonly traitId: "SurfacePenalty";
  readonly startingDamage: number;
  readonly intervalSeconds: number;
  readonly damageIncreasePerTick: number;
  readonly activationEncounterId: "OpeningGeneratedN";
  readonly cureIncantationId: "WorldUpgradeSurfacePenaltyCure";
}

export interface StaticGuideSystems {
  readonly schema: "neodes2-guide-static-systems-2";
  readonly elements: readonly StaticElement[];
  readonly gatheringTools: readonly StaticGatheringTool[];
  readonly fish: readonly StaticFish[];
  readonly cultivation: readonly StaticCultivation[];
  readonly marketOffers: readonly StaticMarketOffer[];
  readonly runRewards: readonly StaticRunReward[];
  readonly openingStates: readonly StaticOpeningState[];
  readonly godAppearances: readonly StaticGodAppearance[];
  readonly encounterFriends: readonly StaticEncounterFriend[];
  readonly encounterAids: readonly StaticEncounterAid[];
  readonly strifeCurses: readonly StaticStrifeCurse[];
  readonly surfacePenalties: readonly StaticSurfacePenalty[];
  readonly gardenPlotCount: number;
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function maskLua(source: string): string {
  const characters = source.split("");
  let quote: "\"" | "'" | undefined;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  for (let index = 0; index < characters.length; index += 1) {
    const current = characters[index] as string;
    const next = characters[index + 1];
    if (lineComment) {
      if (current === "\n") lineComment = false;
      else characters[index] = " ";
      continue;
    }
    if (blockComment) {
      if (current === "]" && next === "]") {
        characters[index] = " ";
        characters[index + 1] = " ";
        index += 1;
        blockComment = false;
      } else if (current !== "\n" && current !== "\r") characters[index] = " ";
      continue;
    }
    if (quote !== undefined) {
      if (escaped) escaped = false;
      else if (current === "\\") escaped = true;
      else if (current === quote) quote = undefined;
      if (current !== "\n" && current !== "\r") characters[index] = " ";
      continue;
    }
    if (current === "-" && next === "-") {
      characters[index] = " ";
      characters[index + 1] = " ";
      index += 1;
      if (characters[index + 1] === "[" && characters[index + 2] === "[") {
        characters[index + 1] = " ";
        characters[index + 2] = " ";
        index += 2;
        blockComment = true;
      } else lineComment = true;
      continue;
    }
    if (current === "\"" || current === "'") {
      quote = current;
      characters[index] = " ";
    }
  }
  return characters.join("");
}

function closingBrace(masked: string, start: number): number {
  let depth = 0;
  for (let index = start; index < masked.length; index += 1) {
    if (masked[index] === "{") depth += 1;
    else if (masked[index] === "}" && --depth === 0) return index;
  }
  throw new Error("Lua table has no closing brace.");
}

function tableAfter(source: string, anchor: RegExp): string {
  const masked = maskLua(source);
  const match = new RegExp(anchor.source, anchor.flags.replace("g", "")).exec(masked);
  if (match?.index === undefined) throw new Error(`Lua table anchor not found: ${anchor.source}`);
  const start = masked.indexOf("{", match.index + match[0].length);
  if (start < 0) throw new Error(`Lua table opening brace not found: ${anchor.source}`);
  return source.slice(start, closingBrace(masked, start) + 1);
}

interface NamedRecord {
  readonly id: string;
  readonly source: string;
}

function namedRecords(table: string): readonly NamedRecord[] {
  const masked = maskLua(table);
  const output: NamedRecord[] = [];
  let depth = 1;
  for (let index = 1; index < masked.length - 1; index += 1) {
    if (masked[index] === "{") {
      depth += 1;
      continue;
    }
    if (masked[index] === "}") {
      depth -= 1;
      continue;
    }
    if (depth !== 1 || !/[A-Za-z_]/u.test(masked[index] ?? "")) continue;
    const match = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*\{/u.exec(masked.slice(index));
    if (match === null) continue;
    const opening = index + match[0].lastIndexOf("{");
    const end = closingBrace(masked, opening);
    output.push({ id: match[1] as string, source: table.slice(opening, end + 1) });
    index = end;
  }
  return output;
}

function anonymousRecords(table: string): readonly string[] {
  const masked = maskLua(table);
  const output: string[] = [];
  let depth = 1;
  for (let index = 1; index < masked.length - 1; index += 1) {
    const character = masked[index];
    if (character === "{") {
      if (depth === 1) {
        let previous = index - 1;
        while (/\s/u.test(masked[previous] ?? "")) previous -= 1;
        const end = closingBrace(masked, index);
        if (masked[previous] !== "=") output.push(table.slice(index, end + 1));
        index = end;
      } else depth += 1;
      continue;
    }
    if (character === "}") depth -= 1;
  }
  return output;
}

function fieldTable(source: string, field: string): string | null {
  const masked = maskLua(source);
  let depth = 1;
  for (let index = 1; index < masked.length - 1; index += 1) {
    if (masked[index] === "{") {
      depth += 1;
      continue;
    }
    if (masked[index] === "}") {
      depth -= 1;
      continue;
    }
    if (depth !== 1 || !masked.startsWith(field, index)) continue;
    const match = new RegExp(`^${field}\\s*=\\s*\\{`, "u").exec(masked.slice(index));
    if (match === null) continue;
    const opening = index + match[0].lastIndexOf("{");
    return source.slice(opening, closingBrace(masked, opening) + 1);
  }
  return null;
}

function scalarField(source: string, field: string): JsonValue | undefined {
  const match = new RegExp(
    `\\b${field}\\s*=\\s*(?:"((?:\\\\.|[^"\\\\])*)"|(-?\\d+(?:\\.\\d+)?)|(true|false))`,
    "u",
  ).exec(source);
  if (match?.[1] !== undefined) return match[1];
  if (match?.[2] !== undefined) return Number(match[2]);
  if (match?.[3] !== undefined) return match[3] === "true";
  return undefined;
}

function stringArray(table: string | null): readonly string[] {
  if (table === null) return [];
  return [...table.matchAll(/"((?:\\.|[^"\\])*)"/gu)].map((entry) => entry[1] as string);
}

function numberMap(table: string | null): readonly StaticCost[] {
  if (table === null) return [];
  return [...maskLua(table).matchAll(/\b([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(-?\d+(?:\.\d+)?)/gu)]
    .map((entry) => ({ resourceId: entry[1] as string, amount: Number(entry[2]) }))
    .filter((entry) => Number.isFinite(entry.amount))
    .sort((left, right) => compareStrings(left.resourceId, right.resourceId));
}

function conditionTable(table: string): readonly StaticCondition[] {
  const named = [
    ["NamedRequirements", "true"],
    ["NamedRequirementsFalse", "false"],
  ] as const;
  const namedConditions = named.flatMap(([field, comparison]): readonly StaticCondition[] => {
    const values = stringArray(fieldTable(table, field));
    return values.length === 0 ? [] : [{ path: [field], comparison, value: values, qualifiers: {} }];
  });
  const pathConditions = anonymousRecords(table).flatMap((entry): readonly StaticCondition[] => {
    for (const [field, comparison] of [
      ["PathTrue", "true"],
      ["PathFalse", "false"],
      ["Path", scalarField(entry, "Comparison") ?? "="],
    ] as const) {
      const path = stringArray(fieldTable(entry, field));
      if (path.length === 0) continue;
      const value = scalarField(entry, "Value");
      const scalarQualifiers = Object.fromEntries([
        "PathFromArgs", "SumPrevRooms", "SumPrevRuns", "UseLength",
      ].flatMap((qualifier) => {
        const candidate = scalarField(entry, qualifier);
        return candidate === undefined ? [] : [[qualifier, candidate] as const];
      }));
      const collectionQualifiers = Object.fromEntries([
        "CountOf", "HasAll", "HasAny", "HasNone", "IsAny", "IsNone",
      ].flatMap((qualifier) => {
        const candidate = stringArray(fieldTable(entry, qualifier));
        return candidate.length === 0 ? [] : [[qualifier, candidate] as const];
      }));
      return [{
        path,
        comparison: comparison as StaticCondition["comparison"],
        ...(value === undefined ? {} : { value }),
        qualifiers: { ...scalarQualifiers, ...collectionQualifiers },
      }];
    }
    const functionName = scalarField(entry, "FunctionName");
    if (typeof functionName === "string") {
      const scalarQualifiers = Object.fromEntries([
        "Alive", "Count", "Event", "MaxHealthFraction", "MinHealthFraction", "MinRooms", "Name", "RoomName",
      ].flatMap((qualifier) => {
        const candidate = scalarField(entry, qualifier);
        return candidate === undefined ? [] : [[qualifier, candidate] as const];
      }));
      const collectionQualifiers = Object.fromEntries([
        "AnyNPC", "AnyOf", "IsAny", "IsNone", "Units",
      ].flatMap((qualifier) => {
        const candidate = stringArray(fieldTable(entry, qualifier));
        return candidate.length === 0 ? [] : [[qualifier, candidate] as const];
      }));
      const value = scalarField(entry, "Value");
      return [{
        path: ["Function", functionName],
        comparison: (scalarField(entry, "Comparison") ?? "true") as StaticCondition["comparison"],
        ...(value === undefined ? {} : { value }),
        qualifiers: { ...scalarQualifiers, ...collectionQualifiers },
      }];
    }
    if (maskLua(entry).replace(/[{},\s]/gu, "") !== "") {
      throw new Error(`Unsupported static requirement record: ${entry.slice(0, 160).replace(/\s+/gu, " ")}`);
    }
    return [];
  });
  return [...namedConditions, ...pathConditions];
}

function conditions(source: string): readonly StaticCondition[] {
  const table = fieldTable(source, "GameStateRequirements");
  return table === null ? [] : conditionTable(table);
}

function localizationRecord(source: string, id: string): { readonly displayName: string; readonly description: string } {
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const record = new RegExp(`\\{\\s*Id\\s*=\\s*"${escaped}"([\\s\\S]*?)\\n\\s*\\}`, "u").exec(source)?.[1] ?? "";
  const displayName = /\bDisplayName\s*=\s*"((?:\\.|[^"\\])*)"/u.exec(record)?.[1];
  const description = /\bDescription\s*=\s*"((?:\\.|[^"\\])*)"/u.exec(record)?.[1];
  if (displayName === undefined || description === undefined) throw new Error(`English localization is missing for ${id}.`);
  return { displayName, description };
}

function inheritedLocalizationRecord(
  source: string,
  id: string,
  seen: ReadonlySet<string> = new Set(),
): { readonly displayName: string; readonly description: string | null } {
  if (seen.has(id)) throw new Error(`English localization inheritance contains a cycle at ${id}.`);
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const record = new RegExp(`\\{\\s*Id\\s*=\\s*"${escaped}"([\\s\\S]*?)\\n\\s*\\}`, "u").exec(source)?.[1];
  if (record === undefined) throw new Error(`English localization is missing for ${id}.`);
  const displayName = /\bDisplayName\s*=\s*"((?:\\.|[^"\\])*)"/u.exec(record)?.[1];
  const description = /\bDescription\s*=\s*"((?:\\.|[^"\\])*)"/u.exec(record)?.[1];
  const inheritedId = /\bInheritFrom\s*=\s*"((?:\\.|[^"\\])*)"/u.exec(record)?.[1];
  const inherited = inheritedId === undefined
    ? null
    : inheritedLocalizationRecord(source, inheritedId, new Set([...seen, id]));
  const resolvedName = displayName ?? inherited?.displayName;
  if (resolvedName === undefined) throw new Error(`English localization has no display name for ${id}.`);
  return { displayName: resolvedName, description: description ?? inherited?.description ?? null };
}

function buildTags(id: string, displayName: string, description: string): readonly string[] {
  const text = `${id} ${displayName} ${description}`.toLowerCase();
  const tags = new Set<string>();
  const actionTokens = [
    ["attack", ["{$keywords.attack", "{$keywords.weaponset"]],
    ["special", ["{$keywords.special", "{$keywords.weaponset"]],
    ["cast", ["{$keywords.cast"]],
    ["omega", ["{$keywords.omega"]],
    ["dash", ["{$keywords.dash"]],
    ["sprint", ["{$keywords.sprint"]],
    ["hex", ["{$keywords.spell"]],
  ] as const;
  for (const [tag, patterns] of actionTokens) {
    if (patterns.some((pattern) => description.toLowerCase().includes(pattern))) tags.add(tag);
  }
  for (const [tag, patterns] of [
    ["armor", ["!icons.armortotal", "{$keywords.costume"]],
    ["health", ["!icons.health}", "!icons.healthup", "!icons.healthrestore", "!icons.extrachance", "{$keywords.extrachance"]],
    ["magick", ["!icons.mana", "{$keywords.reservemana"]],
    ["mobility", ["{$keywords.dodge", "move {#upgradeformat", "faster"]],
    ["economy", ["gold", "coin", "reward", "shop", "resource", "pom"]],
    ["arcana", ["arcana", "card", "grasp"]],
    ["familiar", ["familiar"]],
    ["keepsake", ["keepsake"]],
    ["fear", ["fear", "vow", "shrine"]],
    ["hammer", ["hammer"]],
  ] as const) {
    if (patterns.some((pattern) => text.includes(pattern))) tags.add(tag);
  }
  return [...tags].sort(compareStrings);
}

function parseGodAppearances(
  requirementsSource: string,
  biomeStateSource: string,
  underworldRoomSource: string,
  surfaceRoomSource: string,
  baseRoomSource: string,
): readonly StaticGodAppearance[] {
  const requirements = new Map(namedRecords(tableAfter(requirementsSource, /\bNamedRequirementsData\s*=/u)).map((record) => [record.id, record.source]));
  const rooms = [
    ...namedRecords(tableAfter(underworldRoomSource, /\bRoomSetData\.F\s*=/u)),
    ...namedRecords(tableAfter(surfaceRoomSource, /\bRoomSetData\.N\s*=/u)),
  ];
  const forcedRewards = rooms.flatMap((room) => {
    const rewards = fieldTable(room.source, "ForcedRewards");
    return rewards === null
      ? []
      : anonymousRecords(rewards).flatMap((reward) => {
        const lootName = scalarField(reward, "LootName");
        return typeof lootName === "string" ? [{ roomId: room.id, lootName, source: reward }] : [];
      });
  });
  const biomeStates = tableAfter(biomeStateSource, /\bBiomeStateData\s*=/u);
  const forceBiomeState = fieldTable(biomeStates, "ForceGameStateRequirements");
  const rain = namedRecords(fieldTable(biomeStates, "BiomeStates") ?? "{}")
    .find((record) => record.id === "Rain")?.source;
  if (forceBiomeState === null || rain === undefined) {
    throw new Error("BiomeStateData is missing the first-Zeus Rain schedule.");
  }
  const rainRequirements = fieldTable(rain, "GameStateRequirements");
  if (rainRequirements === null) throw new Error("BiomeStateData.Rain is missing GameStateRequirements.");
  const initialReward = (godId: string): { readonly roomId: string; readonly source: string } => {
    const lootName = `${godId}Upgrade`;
    const reward = forcedRewards.find((candidate) => candidate.lootName === lootName);
    if (reward === undefined) throw new Error(`RoomDataF is missing the forced first appearance for ${lootName}.`);
    return reward;
  };
  const namedRequirement = (id: string): string => {
    const source = requirements.get(id);
    if (source === undefined) throw new Error(`RequirementsData is missing ${id}.`);
    return source;
  };
  const boonPool = [
    ["Apollo", null, null],
    ["Zeus", null, null],
    ["Demeter", null, null],
    ["Poseidon", null, null],
    ["Hestia", null, null],
    ["Aphrodite", null, null],
    ["Hephaestus", "HephaestusUnlocked", null],
    ["Hermes", null, "HermesUpgradeRequirements"],
    ["Hera", "HeraUnlocked", null],
    ["Ares", "AresUnlocked", null],
  ] as const;
  const appearances = boonPool.map(([godId, namedInitialRequirementId, repeatRequirementId]): StaticGodAppearance => {
    const initial = initialReward(godId);
    const forcedRoomIds = namedInitialRequirementId === null
      ? [initial.roomId]
      : forcedRewards
        .filter((reward) => reward.lootName === `${godId}Upgrade` && reward.source.includes(`"${namedInitialRequirementId}"`))
        .map((reward) => reward.roomId);
    return {
      godId,
      appearanceKind: "boon-pool",
      initialRequirementId: namedInitialRequirementId ?? `${godId}FirstAppearance`,
      initialConditions: namedInitialRequirementId === null
        ? [
          ...conditions(initial.source),
          ...(godId === "Zeus" ? [...conditionTable(forceBiomeState), ...conditionTable(rainRequirements)] : []),
        ]
        : conditionTable(namedRequirement(namedInitialRequirementId)),
      repeatRequirementId,
      repeatConditions: repeatRequirementId === null ? [] : conditionTable(namedRequirement(repeatRequirementId)),
      forcedRoomIds: [...new Set(forcedRoomIds)].sort(compareStrings),
      secretDoorChance: null,
      minimumRoomsBetweenAppearances: null,
    };
  });
  const chaosUnlocked = namedRequirement("ChaosUnlocked");
  const noRecentChaos = namedRequirement("NoRecentChaosEncounter");
  const baseRoom = namedRecords(tableAfter(baseRoomSource, /\bRoomSetData\.Base\s*=/u))
    .find((room) => room.id === "BaseRoom")?.source;
  if (baseRoom === undefined) throw new Error("RoomData is missing BaseRoom.");
  const chaos: StaticGodAppearance = {
    godId: "Chaos",
    appearanceKind: "secret-door",
    initialRequirementId: "ChaosUnlocked",
    initialConditions: conditionTable(chaosUnlocked),
    repeatRequirementId: "NoRecentChaosEncounter",
    repeatConditions: conditionTable(noRecentChaos),
    forcedRoomIds: [],
    secretDoorChance: numericMatch(baseRoom, /SecretSpawnChance\s*=\s*(\d+(?:\.\d+)?)/u, "Chaos Gate base chance"),
    minimumRoomsBetweenAppearances: Number(scalarField(noRecentChaos, "SumPrevRooms") ?? 10),
  };
  return [...appearances, chaos].sort((left, right) => compareStrings(left.godId, right.godId));
}

function parseEncounterSupport(
  npcSource: string,
  encounterSources: readonly string[],
  traitTextSource: string,
  specialNpcSources: Readonly<Record<string, string>>,
  specialTraitSources: readonly string[],
): { readonly friends: readonly StaticEncounterFriend[]; readonly aids: readonly StaticEncounterAid[] } {
  const presets = new Map(namedRecords(tableAfter(npcSource, /\bPresetEventArgs\s*=/u)).map((record) => [record.id, record.source]));
  const encounters = new Map(encounterSources.flatMap((source) =>
    namedRecords(tableAfter(source, /\bEncounterData\s*,/u)).map((record) => [record.id, record.source] as const)));
  const traitRecords = new Map(specialTraitSources.flatMap((source) =>
    namedRecords(tableAfter(source, /\bOverwriteTableKeys\s*\(\s*TraitData\s*,/u)).map((record) => [record.id, record.source] as const)));
  const providers = [
    { id: "Arachne", menuId: "ArachneCostumeChoices", appearances: [["Story_Arachne_01", "F"]] },
    { id: "Narcissus", menuId: "NarcissusBenefitChoices", appearances: [["Story_Narcissus_01", "G"]] },
    { id: "Echo", menuId: "EchoBenefitChoices", appearances: [["Story_Echo_01", "H"]] },
    { id: "Medea", menuId: "MedeaCurseChoices", appearances: [["Story_Medea_01", "N"]] },
    { id: "Circe", menuId: "CirceBlessingChoices", appearances: [["Story_Circe_01", "O"]] },
    { id: "Icarus", menuId: "IcarusBenefitChoices", appearances: [["IcarusCombatIntro", "O"], ["IcarusCombatO", "O"], ["IcarusCombatP", "P"]] },
    { id: "Artemis", unitId: "NPC_Artemis_Field_01", appearances: [["ArtemisCombatIntro", "F"], ["ArtemisCombatF", "F"], ["ArtemisCombatG", "G"], ["ArtemisCombatN", "N"]] },
    { id: "Athena", unitId: "NPC_Athena_01", appearances: [["AthenaCombatIntro", "P"], ["AthenaCombatP", "P"]] },
    { id: "Dionysus", unitId: "NPC_Dionysus_01", appearances: [["Story_Dionysus_01", "O"]] },
    { id: "Hades", unitId: "NPC_Hades_Field_01", appearances: [["Story_Hades_01", "I"]] },
    { id: "Nemesis", appearances: [["NemesisCombatIntro", "F"], ["NemesisCombatF", "F"], ["NemesisCombatG", "G"], ["NemesisCombatH", "H"], ["NemesisCombatI", "I"]] },
    { id: "Heracles", appearances: [["HeraclesCombatN", "N"], ["HeraclesCombatO", "O"], ["HeraclesCombatP", "P"]] },
  ] as const;
  const configuredMenus = providers.flatMap((provider) => "menuId" in provider ? [provider.menuId] : []).sort(compareStrings);
  const discoveredMenus = [...presets.entries()]
    .filter(([, source]) => fieldTable(source, "UpgradeOptions") !== null)
    .map(([id]) => id)
    .sort(compareStrings);
  if (configuredMenus.length !== discoveredMenus.length || configuredMenus.some((id, index) => id !== discoveredMenus[index])) {
    throw new Error(`Encounter choice menus differ from the source inventory: configured=${configuredMenus.join(",")}; discovered=${discoveredMenus.join(",")}.`);
  }
  const aids: StaticEncounterAid[] = [];
  const friends = providers.map((provider): StaticEncounterFriend => {
    const menu = "menuId" in provider ? presets.get(provider.menuId) : undefined;
    const unitSource = "unitId" in provider ? specialNpcSources[provider.id] : undefined;
    const unit = "unitId" in provider && unitSource !== undefined
      ? tableAfter(unitSource, new RegExp(`\\b${provider.unitId}\\s*=`, "u"))
      : undefined;
    if ("menuId" in provider && menu === undefined) throw new Error(`Encounter choice data is missing for ${provider.id}.`);
    if ("unitId" in provider && unit === undefined) throw new Error(`Encounter unit data is missing for ${provider.id}.`);
    const aidIds: string[] = [];
    const options = menu === undefined
      ? stringArray(fieldTable(unit ?? "{}", "Traits")).map((aidId) => ({ aidId, source: traitRecords.get(aidId) ?? "{}" }))
      : anonymousRecords(fieldTable(menu, "UpgradeOptions") ?? "{}").flatMap((source) => {
        const aidId = scalarField(source, "ItemName");
        return typeof aidId === "string" ? [{ aidId, source }] : [];
      });
    for (const option of options) {
      const aidId = option.aidId;
      if (typeof aidId !== "string") continue;
      const localized = localizationRecord(traitTextSource, aidId);
      aidIds.push(aidId);
      aids.push({
        id: aidId,
        providerId: provider.id,
        ...localized,
        availability: conditions(option.source),
        buildTags: buildTags(aidId, localized.displayName, localized.description),
      });
    }
    const appearances = provider.appearances.map(([encounterId, regionId]): StaticEncounterAppearance => {
      const encounter = encounters.get(encounterId);
      if (encounter === undefined) throw new Error(`Encounter data is missing ${encounterId} for ${provider.id}.`);
      return { encounterId, regionId, appearanceConditions: conditions(encounter) };
    });
    const maxAppearances = appearances.map((appearance) => scalarField(encounters.get(appearance.encounterId) ?? "", "MaxAppearancesThisBiome"))
      .find((value): value is number => typeof value === "number");
    return {
      id: provider.id,
      displayName: provider.id,
      appearances,
      maxAppearancesPerBiome: maxAppearances ?? 1,
      aidIds: aidIds.sort(compareStrings),
    };
  });
  return {
    friends: friends.sort((left, right) => compareStrings(left.id, right.id)),
    aids: aids.sort((left, right) => compareStrings(left.id, right.id)),
  };
}

function parseTools(weaponShopSource: string, traitTextSource: string): readonly StaticGatheringTool[] {
  const itemRecords = new Map(namedRecords(tableAfter(weaponShopSource, /\bWeaponShopItemData\s*=/u)).map((record) => [record.id, record.source]));
  return ["ToolPickaxe", "ToolExorcismBook", "ToolShovel", "ToolFishingRod"]
    .flatMap((baseToolId) => [baseToolId, `${baseToolId}2`])
    .map((id): StaticGatheringTool => {
      const source = itemRecords.get(id);
      if (source === undefined) throw new Error(`WeaponShopItemData is missing ${id}.`);
      const localized = localizationRecord(traitTextSource, id);
      const elementChance = scalarField(source, "ElementChance");
      const elementName = scalarField(source, "ElementName");
      const elementId = typeof elementName === "string" ? elementName.replace(/Essence$/u, "") : null;
      return {
        id,
        baseToolId: id.endsWith("2") ? id.slice(0, -1) : id,
        level: typeof scalarField(source, "Level") === "number" ? scalarField(source, "Level") as number : 1,
        ...localized,
        costs: numberMap(fieldTable(source, "Cost")),
        unlockConditions: conditions(source),
        elementYield: typeof elementChance === "number" && typeof elementName === "string" && typeof elementId === "string" && elementId !== ""
          ? { elementId, essenceTraitId: elementName, chance: elementChance }
          : null,
      };
    });
}

function parseMarketOffers(marketSource: string): readonly StaticMarketOffer[] {
  const screen = tableAfter(marketSource, /\bScreenData\.MarketScreen\s*=/u);
  const categories = anonymousRecords(fieldTable(screen, "ItemCategories") ?? "{}");
  const offers: StaticMarketOffer[] = [];
  for (const [categoryIndex, category] of categories.entries()) {
    const categoryId = scalarField(category, "Name");
    if (typeof categoryId !== "string") continue;
    const categoryConditions = conditions(category);
    const refreshOncePerRun = scalarField(category, "RefreshOncePerRun") === true;
    for (const [offerIndex, offer] of anonymousRecords(category).entries()) {
      const outputResourceId = scalarField(offer, "BuyName");
      if (typeof outputResourceId !== "string") continue;
      const outputAmount = scalarField(offer, "BuyAmount");
      offers.push({
        id: `${categoryId}:${String(categoryIndex + 1)}:${String(offerIndex + 1)}:${outputResourceId}`,
        categoryId,
        outputResourceId,
        outputAmount: typeof outputAmount === "number" ? outputAmount : 1,
        costs: numberMap(fieldTable(offer, "Cost")),
        availability: [...categoryConditions, ...conditions(offer)],
        refreshOncePerRun,
      });
    }
  }
  return offers.sort((left, right) => compareStrings(left.id, right.id));
}

function parseRunRewards(
  consumableSource: string,
  lootSource: string,
  localizationSource: string,
): readonly StaticRunReward[] {
  const consumables = new Map(namedRecords(tableAfter(consumableSource, /\bConsumableData\s*=/u))
    .map((record) => [record.id, record.source]));
  const rewardStores = new Map(namedRecords(tableAfter(lootSource, /\bRewardStoreData\s*=/u))
    .map((entry) => [entry.id, entry.source]));
  const record = (records: ReadonlyMap<string, string>, id: string): string => {
    const value = records.get(id);
    if (value === undefined) throw new Error(`Run-reward source is missing ${id}.`);
    return value;
  };
  const localized = (id: string): { readonly displayName: string; readonly description: string | null } =>
    inheritedLocalizationRecord(localizationSource, id);
  const rewardStoreEntries = (storeId: string, rewardId: string): readonly string[] => {
    const store = record(rewardStores, storeId);
    const entries = anonymousRecords(store).filter((entry) => scalarField(entry, "Name") === rewardId);
    if (entries.length === 0) throw new Error(`${storeId} reward store is missing ${rewardId}.`);
    return entries;
  };
  const rewardStoreAvailability = (storeId: string, rewardId: string): readonly StaticCondition[] => {
    const entry = rewardStoreEntries(storeId, rewardId).find((candidate) => fieldTable(candidate, "GameStateRequirements") !== null);
    return entry === undefined ? [] : conditions(entry);
  };
  const selectionKind = (storeId: string): "room-door" | "subroom" | "scripted" => {
    if (storeId === "RunProgress" || storeId === "MetaProgress") return "room-door";
    if (storeId === "SubRoomRewards" || storeId === "SubRoomRewardsHard") return "subroom";
    return "scripted";
  };
  const selectionSources = (rewardId: string): StaticRunReward["selectionSources"] =>
    [...rewardStores.entries()]
      .flatMap(([storeId, store]) => {
        const entries = anonymousRecords(store).filter((entry) => scalarField(entry, "Name") === rewardId);
        if (entries.length === 0) return [];
        const storeConditions = conditions(store);
        return [{
          storeId,
          kind: selectionKind(storeId),
          alternatives: entries.map((entry) => [...storeConditions, ...conditions(entry)]),
        }];
      })
      .sort((left, right) => compareStrings(left.storeId, right.storeId));
  const selectableReward = (
    reward: Omit<StaticRunReward, "selectionSources">,
  ): StaticRunReward => {
    const sources = selectionSources(reward.id);
    if (sources.length === 0) throw new Error(`${reward.id} is not owned by a selectable reward store.`);
    return { ...reward, selectionSources: sources };
  };
  const resourceReward = (
    id: string,
    resourceId: string,
    availability: readonly StaticCondition[] = [],
  ): Omit<StaticRunReward, "selectionSources"> => {
    const source = record(consumables, id);
    const amount = numberMap(fieldTable(source, "AddResources"))
      .find((entry) => entry.resourceId === resourceId)?.amount;
    if (amount === undefined) throw new Error(`${id} does not add ${resourceId}.`);
    return {
      id,
      ...localized(id),
      effectKind: "resource",
      amount,
      resourceId,
      availability,
    };
  };
  const talent = record(consumables, "TalentDrop");
  const health = record(consumables, "MaxHealthDrop");
  const magick = record(consumables, "MaxManaDrop");
  const gold = record(consumables, "RoomMoneyDrop");
  const hammerAvailability = conditions(record(consumables, "WeaponUpgradeDrop"));
  const bonesAvailability = rewardStoreAvailability("MetaProgress", "MetaCurrencyDrop")
    .filter((condition) => condition.path.includes("LifetimeResourcesGained"));
  const records: StaticRunReward[] = [
    selectableReward({ id: "Boon", ...localized("Boon"), effectKind: "boon-choice", amount: null, resourceId: null, availability: [] }),
    selectableReward({ id: "HermesUpgrade", ...localized("HermesUpgrade_Store"), effectKind: "hermes-boon-choice", amount: 1, resourceId: null, availability: rewardStoreAvailability("RunProgress", "HermesUpgrade") }),
    selectableReward({ id: "Devotion", ...localized("DevotionMessage"), effectKind: "two-god-boon-choice", amount: null, resourceId: null, availability: rewardStoreAvailability("RunProgress", "Devotion") }),
    selectableReward({ id: "SpellDrop", ...localized("SpellDrop_Store"), effectKind: "hex-choice", amount: 1, resourceId: null, availability: rewardStoreAvailability("RunProgress", "SpellDrop") }),
    selectableReward({ id: "WeaponUpgrade", ...localized("WeaponUpgrade"), effectKind: "hammer-choice", amount: null, resourceId: null, availability: hammerAvailability }),
    selectableReward({
      id: "StackUpgrade",
      ...localized("StackUpgrade"),
      effectKind: "boon-level",
      amount: 1,
      resourceId: null,
      availability: rewardStoreAvailability("RunProgress", "StackUpgrade"),
    }),
    selectableReward({
      id: "TalentDrop",
      ...localized("TalentDrop"),
      effectKind: "path-upgrades",
      amount: Number(scalarField(talent, "AddTalentPoints")),
      resourceId: null,
      availability: rewardStoreAvailability("RunProgress", "TalentDrop"),
    }),
    selectableReward({
      id: "MaxHealthDrop",
      ...localized("MaxHealthDrop"),
      effectKind: "maximum-health",
      amount: Number(scalarField(health, "AddMaxHealth")),
      resourceId: null,
      availability: conditions(health),
    }),
    selectableReward({
      id: "MaxManaDrop",
      ...localized("MaxManaDrop"),
      effectKind: "maximum-magick",
      amount: Number(scalarField(magick, "AddMaxMana")),
      resourceId: null,
      availability: conditions(magick),
    }),
    selectableReward({
      id: "RoomMoneyDrop",
      ...localized("RoomMoneyDrop"),
      effectKind: "gold",
      amount: Number(scalarField(gold, "DropMoney")),
      resourceId: "Money",
      availability: conditions(gold),
    }),
    selectableReward(resourceReward("MetaCardPointsCommonDrop", "MetaCardPointsCommon", rewardStoreAvailability("MetaProgress", "MetaCardPointsCommonDrop"))),
    selectableReward(resourceReward("MetaCurrencyDrop", "MetaCurrency", bonesAvailability)),
    selectableReward(resourceReward("GiftDrop", "GiftPoints", rewardStoreAvailability("MetaProgress", "GiftDrop"))),
  ];
  for (const reward of records) {
    if (reward.amount !== null && !Number.isFinite(reward.amount)) {
      throw new Error(`Run-reward amount is missing for ${reward.id}.`);
    }
  }
  return records.sort((left, right) => compareStrings(left.id, right.id));
}

function fishRarity(id: string): StaticFish["rarity"] {
  if (id.endsWith("Legendary")) return "legendary";
  if (id.endsWith("Rare")) return "rare";
  return "common";
}

function parseFish(harvestSource: string, marketOffers: readonly StaticMarketOffer[]): readonly StaticFish[] {
  const fishing = tableAfter(harvestSource, /\bFishingData\s*=/u);
  const biomeFish = namedRecords(fieldTable(fishing, "BiomeFish") ?? "{}");
  const saleByFish = new Map<string, { amount: number; currencyId: string }>();
  for (const offer of marketOffers) {
    if (offer.outputResourceId === "MetaCurrency" && offer.costs.length === 1) {
      const cost = offer.costs[0];
      if (cost?.resourceId.startsWith("Fish") === true && cost.amount === 1) {
        saleByFish.set(cost.resourceId, { amount: offer.outputAmount, currencyId: offer.outputResourceId });
      }
    }
  }
  const rules = new Map<string, { regionId: string; catchRules: StaticFishCatchRule[] }>();
  for (const region of biomeFish.filter((entry) => entry.id !== "Defaults")) {
    for (const entry of anonymousRecords(region.source)) {
      const fishId = scalarField(entry, "Name");
      const weight = scalarField(entry, "Weight");
      if (typeof fishId !== "string" || typeof weight !== "number") continue;
      const current = rules.get(fishId) ?? { regionId: region.id, catchRules: [] };
      current.catchRules.push({ weight, conditions: conditions(entry) });
      rules.set(fishId, current);
    }
  }
  return [...rules.entries()].map(([id, rule]): StaticFish => {
    const sale = saleByFish.get(id);
    if (sale === undefined) throw new Error(`MarketData has no fish sale for ${id}.`);
    return {
      id,
      resourceId: id,
      regionId: rule.regionId,
      rarity: fishRarity(id),
      catchRules: rule.catchRules,
      sellValue: sale.amount,
      sellCurrencyId: sale.currencyId,
    };
  }).sort((left, right) => compareStrings(left.id, right.id));
}

function parseCultivation(gardenSource: string): { readonly records: readonly StaticCultivation[]; readonly plotCount: number } {
  const garden = tableAfter(gardenSource, /\bGardenData\s*=/u);
  const plotCount = [...(fieldTable(garden, "PlotOrder") ?? "").matchAll(/\b\d+\b/gu)].length;
  const records: StaticCultivation[] = [];
  for (const seed of namedRecords(fieldTable(garden, "Seeds") ?? "{}")) {
    const growTimeMin = scalarField(seed.source, "GrowTimeMin");
    const growTimeMax = scalarField(seed.source, "GrowTimeMax");
    if (typeof growTimeMin !== "number" || typeof growTimeMax !== "number") continue;
    for (const outcome of anonymousRecords(fieldTable(seed.source, "RandomOutcomes") ?? "{}")) {
      const outputs = numberMap(fieldTable(outcome, "AddResources"));
      const weight = scalarField(outcome, "Weight");
      const bonusSeed = scalarField(outcome, "BonusSeedName");
      for (const output of outputs) {
        records.push({
          id: `${seed.id}:${output.resourceId}`,
          seedResourceId: seed.id,
          outputResourceId: output.resourceId,
          outputAmount: output.amount,
          growTimeMin,
          growTimeMax,
          weight: typeof weight === "number" ? weight : 1,
          conditions: conditions(outcome),
          bonusSeedResourceId: typeof bonusSeed === "string" ? bonusSeed : null,
        });
      }
    }
  }
  return { records: records.sort((left, right) => compareStrings(left.id, right.id)), plotCount };
}

function parseOpeningState(roomSource: string): readonly StaticOpeningState[] {
  const rooms = tableAfter(roomSource, /\bRoomSetData\.F\s*=/u);
  const room = namedRecords(rooms).find((record) => record.id === "F_Combat01")?.source;
  if (room === undefined) throw new Error("RoomSetData.F is missing F_Combat01.");
  const forcedRewards = anonymousRecords(fieldTable(room, "ForcedRewards") ?? "{}");
  const firstReward = forcedRewards[0];
  if (firstReward === undefined) throw new Error("F_Combat01 has no forced reward.");
  const lootName = scalarField(firstReward, "LootName");
  const rewardKind = scalarField(firstReward, "Name");
  const encounterId = scalarField(room, "ForceIfEncounterNotCompleted");
  if (typeof lootName !== "string" || typeof rewardKind !== "string" || typeof encounterId !== "string") {
    throw new Error(`F_Combat01 forced opening data is incomplete: reward=${String(rewardKind)}, loot=${String(lootName)}, encounter=${String(encounterId)}.`);
  }
  return [{
    id: "first-night-opening",
    roomId: "F_Combat01",
    encounterId,
    rewardKind,
    godId: lootName.replace(/Upgrade$/u, ""),
    boonIds: stringArray(fieldTable(room, "ForceLootTableFirstRun")),
    forcedCommonRarity: scalarField(room, "ForceCommonLootFirstRun") === true,
  }];
}

function numericMatch(source: string, pattern: RegExp, label: string): number {
  const value = pattern.exec(source)?.[1];
  if (value === undefined || !Number.isFinite(Number(value))) throw new Error(`Static source is missing ${label}.`);
  return Number(value);
}

function parseStrifeCurse(
  traitSource: string,
  traitTextSource: string,
  requirementsSource: string,
  roomSources: Readonly<Record<"G" | "H" | "I", string>>,
): readonly StaticStrifeCurse[] {
  const traits = new Map(namedRecords(tableAfter(traitSource, /\bTraitSetData\.Base\s*=/u)).map((record) => [record.id, record.source]));
  const trait = traits.get("ErisCurseTrait");
  if (trait === undefined) throw new Error("TraitData is missing ErisCurseTrait.");
  const base = numericMatch(trait, /BaseDamageMultiplierAddition\s*=\s*(-?\d+(?:\.\d+)?)/u, "Eris base damage addition");
  const perEncounter = numericMatch(trait, /PerEncounterDamageMultiplierAddition\s*=\s*(-?\d+(?:\.\d+)?)/u, "Eris per-encounter damage addition");
  const maximumAdditions = numericMatch(trait, /MaxEncounterAdditions\s*=\s*(\d+)/u, "Eris encounter cap");
  const requirements = new Map(namedRecords(tableAfter(requirementsSource, /\bNamedRequirementsData\s*=/u)).map((record) => [record.id, record.source]));
  const healthThreshold = requirements.get("ErisCurseHealthThreshold");
  if (healthThreshold === undefined) throw new Error("RequirementsData is missing ErisCurseHealthThreshold.");
  const maximumHealthFraction = numericMatch(healthThreshold, /RequiredHealthFraction[\s\S]*?Value\s*=\s*(-?\d+(?:\.\d+)?)/u, "Eris health suppression threshold");
  const stages = ([
    ["G", "G_Intro", "MetaCardPointsCommon"],
    ["H", "H_Intro", "MemPointsCommon"],
    ["I", "I_Intro", "MetaCurrency"],
  ] as const).map(([regionId, roomId, resourceId]): StaticStrifeCurseStage => {
    const room = namedRecords(tableAfter(roomSources[regionId], new RegExp(`\\bRoomSetData\\.${regionId}\\s*=`, "u")))
      .find((record) => record.id === roomId)?.source;
    if (room === undefined) throw new Error(`Room data is missing ${roomId}.`);
    return {
      regionId,
      roomId,
      maximumCompletedNights: numericMatch(room, /CompletedRunsCache[\s\S]*?Value\s*=\s*(\d+)/u, `${roomId} completed-night cap`),
      compensation: {
        resourceId,
        amount: numericMatch(room, new RegExp(`${resourceId}\\s*=\\s*(\\d+)`, "u"), `${roomId} compensation`),
      },
    };
  });
  const localized = localizationRecord(traitTextSource, "ErisCurseTrait");
  return [{
    id: "strife-blessing",
    traitId: "ErisCurseTrait",
    ...localized,
    baseEnemyDamagePercent: base * 100,
    perEncounterEnemyDamagePercent: perEncounter * 100,
    maximumEncounterAdditions: maximumAdditions,
    maximumEnemyDamagePercent: (base + perEncounter * maximumAdditions) * 100,
    duration: "remainder-of-current-night",
    criticalHealthSuppression: { requiresNoDeathDefiance: true, maximumHealthFraction },
    stages,
  }];
}

function parseSurfacePenalty(traitSource: string, openingEncounterSource: string): readonly StaticSurfacePenalty[] {
  const traits = new Map(namedRecords(tableAfter(traitSource, /\bTraitSetData\.Base\s*=/u)).map((record) => [record.id, record.source]));
  const trait = traits.get("SurfacePenalty");
  const opening = namedRecords(tableAfter(openingEncounterSource, /\bEncounterData\s*,/u))
    .find((record) => record.id === "OpeningGeneratedN")?.source;
  if (trait === undefined || opening === undefined || !opening.includes('TraitName = "SurfacePenalty"')) {
    throw new Error("Surface-penalty source data is incomplete.");
  }
  return [{
    id: "surface-ward",
    traitId: "SurfacePenalty",
    startingDamage: numericMatch(trait, /\bDamage\s*=\s*(\d+(?:\.\d+)?)/u, "surface starting damage"),
    intervalSeconds: numericMatch(trait, /\bInterval\s*=\s*(\d+(?:\.\d+)?)/u, "surface damage interval"),
    damageIncreasePerTick: numericMatch(trait, /DamageIncrementPerTick\s*=\s*(\d+(?:\.\d+)?)/u, "surface damage increase"),
    activationEncounterId: "OpeningGeneratedN",
    cureIncantationId: "WorldUpgradeSurfacePenaltyCure",
  }];
}

export async function extractStaticGuideSystems(sourceAcquisitionDirectory: string): Promise<StaticGuideSystems> {
  const acquisition = resolve(sourceAcquisitionDirectory);
  const scripts = join(acquisition, "sources", "Content", "Scripts");
  const text = join(acquisition, "sources", "Content", "Game", "Text", "en");
  const [weaponShop, traitText, helpText, harvest, garden, market, consumable, loot, roomBase, roomF, roomG, roomH, roomI, roomN, requirements, biomeState, npc, traitData, encounterStory, encounterOpening,
    encounterIcarus, encounterArtemis, encounterAthena, encounterNemesis, encounterHeracles,
    npcArtemis, npcAthena, npcDionysus, npcHades,
    traitArtemis, traitAthena, traitDionysus, traitHades] = await Promise.all([
    readFile(join(scripts, "WeaponShopData.lua"), "utf8"),
    readFile(join(text, "TraitText.en.sjson"), "utf8"),
    readFile(join(text, "HelpText.en.sjson"), "utf8"),
    readFile(join(scripts, "HarvestData.lua"), "utf8"),
    readFile(join(scripts, "GardenData.lua"), "utf8"),
    readFile(join(scripts, "MarketData.lua"), "utf8"),
    readFile(join(scripts, "ConsumableData.lua"), "utf8"),
    readFile(join(scripts, "LootData.lua"), "utf8"),
    readFile(join(scripts, "RoomData.lua"), "utf8"),
    readFile(join(scripts, "RoomDataF.lua"), "utf8"),
    readFile(join(scripts, "RoomDataG.lua"), "utf8"),
    readFile(join(scripts, "RoomDataH.lua"), "utf8"),
    readFile(join(scripts, "RoomDataI.lua"), "utf8"),
    readFile(join(scripts, "RoomDataN.lua"), "utf8"),
    readFile(join(scripts, "RequirementsData.lua"), "utf8"),
    readFile(join(scripts, "BiomeStateData.lua"), "utf8"),
    readFile(join(scripts, "NPCData.lua"), "utf8"),
    readFile(join(scripts, "TraitData.lua"), "utf8"),
    readFile(join(scripts, "EncounterData_Story.lua"), "utf8"),
    readFile(join(scripts, "EncounterData_Opening.lua"), "utf8"),
    readFile(join(scripts, "EncounterData_Icarus.lua"), "utf8"),
    readFile(join(scripts, "EncounterData_Artemis.lua"), "utf8"),
    readFile(join(scripts, "EncounterData_Athena.lua"), "utf8"),
    readFile(join(scripts, "EncounterData_Nemesis.lua"), "utf8"),
    readFile(join(scripts, "EncounterData_Heracles.lua"), "utf8"),
    readFile(join(scripts, "NPCData_Artemis.lua"), "utf8"),
    readFile(join(scripts, "NPCData_Athena.lua"), "utf8"),
    readFile(join(scripts, "NPCData_Dionysus.lua"), "utf8"),
    readFile(join(scripts, "NPCData_Hades.lua"), "utf8"),
    readFile(join(scripts, "TraitData_Artemis.lua"), "utf8"),
    readFile(join(scripts, "TraitData_Athena.lua"), "utf8"),
    readFile(join(scripts, "TraitData_Dionysus.lua"), "utf8"),
    readFile(join(scripts, "TraitData_Hades.lua"), "utf8"),
  ]);
  const marketOffers = parseMarketOffers(market);
  const cultivation = parseCultivation(garden);
  const encounterSupport = parseEncounterSupport(
    npc,
    [encounterStory, encounterIcarus, encounterArtemis, encounterAthena, encounterNemesis, encounterHeracles],
    traitText,
    { Artemis: npcArtemis, Athena: npcAthena, Dionysus: npcDionysus, Hades: npcHades },
    [traitArtemis, traitAthena, traitDionysus, traitHades],
  );
  const gatheringTools = parseTools(weaponShop, traitText);
  const elements = [...new Map(gatheringTools.flatMap((tool) => tool.elementYield === null
    ? []
    : [[tool.elementYield.elementId, {
      id: tool.elementYield.elementId,
      essenceTraitId: tool.elementYield.essenceTraitId,
    }] as const])).values()].sort((left, right) => compareStrings(left.id, right.id));
  return {
    schema: "neodes2-guide-static-systems-2",
    elements,
    gatheringTools,
    fish: parseFish(harvest, marketOffers),
    cultivation: cultivation.records,
    marketOffers,
    runRewards: parseRunRewards(consumable, loot, `${traitText}\n${helpText}`),
    openingStates: parseOpeningState(roomF),
    godAppearances: parseGodAppearances(requirements, biomeState, roomF, roomN, roomBase),
    encounterFriends: encounterSupport.friends,
    encounterAids: encounterSupport.aids,
    strifeCurses: parseStrifeCurse(traitData, traitText, requirements, { G: roomG, H: roomH, I: roomI }),
    surfacePenalties: parseSurfacePenalty(traitData, encounterOpening),
    gardenPlotCount: cultivation.plotCount,
  };
}
