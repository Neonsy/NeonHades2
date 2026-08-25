import type { JsonObject, JsonValue } from "../boons/index.js";
import { jsonBytes, sha256 } from "../boons/runtime-acquisition.js";
import type { SpoilerLevel } from "../contract/index.js";
import type {
  PublicationAllowlist,
  PublicationField,
} from "../data-ready/index.js";
import type { CombinedDataset } from "../dataset/index.js";
import type {
  AspectBuildVariantRecord,
  EditorialDataset,
  EditorialReference,
} from "../editorial/index.js";
import type {
  PublicationCompileResult,
  PublicationCondition,
  PublicationDataset,
  PublicationDisposition,
  PublicationPage,
  PublicationRecord,
  PublicationRecordField,
  PublicationRecordPublicModel,
  PublicationRelationship,
  PublicationSearchEntry,
  PublicationSourceIdentity,
} from "./types.js";
import { createPublicationReport } from "./report.js";
import {
  publicRequirements,
  readableFriendAppearance,
  readableGodAppearance,
  readableStaticConditions,
} from "./readable-conditions.js";

export { createPublicationReport };

interface Subject {
  readonly recordType: string;
  readonly id: string;
  readonly officialName: string;
  readonly publicName: string | null;
  readonly values: Readonly<Record<string, unknown>>;
}

interface PublicTypeDefinition {
  readonly label: string;
  readonly collection: string;
  readonly route:
    | "collection"
    | "detail"
    | "guide"
    | "aspect-build"
    | "weapon-build"
    | "boon-tier"
    | "arcana-tier"
    | "familiar-tier"
    | "hex-tier";
}

const PUBLIC_TYPE_DEFINITIONS: Readonly<Record<string, PublicTypeDefinition>> =
  {
    "editorial/arcana-rating": {
      label: "Arcana ranking",
      collection: "tier-lists/arcana",
      route: "arcana-tier",
    },
    "editorial/aspect-guide": {
      label: "Aspect build",
      collection: "builds",
      route: "aspect-build",
    },
    "editorial/boon-rating": {
      label: "Boon ranking",
      collection: "tier-lists/boons",
      route: "boon-tier",
    },
    "editorial/familiar-rating": {
      label: "Familiar ranking",
      collection: "tier-lists/familiars",
      route: "familiar-tier",
    },
    "editorial/hex-rating": {
      label: "Hex ranking",
      collection: "tier-lists/hexes",
      route: "hex-tier",
    },
    "editorial/progression-stage": {
      label: "Walkthrough milestone",
      collection: "guide",
      route: "guide",
    },
    "editorial/weapon-guide": {
      label: "Weapon builds",
      collection: "builds",
      route: "weapon-build",
    },
    "mechanics/arcana-card": {
      label: "Arcana Card",
      collection: "arcana",
      route: "detail",
    },
    "mechanics/boon": { label: "Boon", collection: "boons", route: "detail" },
    "mechanics/combat-mechanic": {
      label: "Combat mechanic",
      collection: "boons",
      route: "detail",
    },
    "mechanics/cultivation": {
      label: "Cultivation",
      collection: "resources",
      route: "collection",
    },
    "mechanics/encounter-aid": {
      label: "Encounter benefit",
      collection: "regions",
      route: "detail",
    },
    "mechanics/familiar": {
      label: "Animal Familiar",
      collection: "familiars",
      route: "detail",
    },
    "mechanics/fish": {
      label: "Fish",
      collection: "resources",
      route: "detail",
    },
    "mechanics/gathering-tool": {
      label: "Gathering tool",
      collection: "resources",
      route: "collection",
    },
    "mechanics/god": {
      label: "Olympian",
      collection: "boons",
      route: "detail",
    },
    "mechanics/grasp-progression": {
      label: "Arcana system",
      collection: "arcana",
      route: "detail",
    },
    "mechanics/hammer-upgrade": {
      label: "Daedalus Hammer",
      collection: "hammers",
      route: "detail",
    },
    "mechanics/hex": { label: "Hex", collection: "hexes", route: "detail" },
    "mechanics/incantation": {
      label: "Incantation",
      collection: "incantations",
      route: "detail",
    },
    "mechanics/keepsake": {
      label: "Keepsake",
      collection: "keepsakes",
      route: "detail",
    },
    "mechanics/market-offer": {
      label: "Broker exchange",
      collection: "resources",
      route: "collection",
    },
    "mechanics/resource": {
      label: "Resource",
      collection: "resources",
      route: "detail",
    },
    "mechanics/run-reward": {
      label: "Room reward",
      collection: "resources",
      route: "detail",
    },
    "mechanics/status-element": {
      label: "Status effect",
      collection: "boons",
      route: "detail",
    },
    "mechanics/weapon": {
      label: "Weapon",
      collection: "weapons",
      route: "weapon-build",
    },
    "mechanics/weapon-aspect": {
      label: "Weapon aspect",
      collection: "weapons",
      route: "aspect-build",
    },
    "world-progression/achievement": {
      label: "Achievement",
      collection: "achievements",
      route: "detail",
    },
    "world-progression/encounter": {
      label: "Encounter",
      collection: "regions",
      route: "collection",
    },
    "world-progression/encounter-friend": {
      label: "Encounter friend",
      collection: "regions",
      route: "detail",
    },
    "world-progression/enemy": {
      label: "Enemy",
      collection: "enemies",
      route: "detail",
    },
    "world-progression/narrative-milestone": {
      label: "Story requirement",
      collection: "story",
      route: "collection",
    },
    "world-progression/oath-condition": {
      label: "Oath condition",
      collection: "oath",
      route: "detail",
    },
    "world-progression/opening-state": {
      label: "Opening",
      collection: "regions",
      route: "collection",
    },
    "world-progression/prophecy": {
      label: "Fated List prophecy",
      collection: "prophecies",
      route: "detail",
    },
    "world-progression/region": {
      label: "Region",
      collection: "regions",
      route: "detail",
    },
    "world-progression/relationship": {
      label: "Relationship",
      collection: "relationships",
      route: "detail",
    },
    "world-progression/strife-curse": {
      label: "Progression effect",
      collection: "regions",
      route: "detail",
    },
    "world-progression/surface-penalty": {
      label: "Surface condition",
      collection: "regions",
      route: "detail",
    },
    "world-progression/testament-bounty": {
      label: "Testament",
      collection: "oath",
      route: "detail",
    },
  };

const PUBLIC_NAME_OVERRIDES: Readonly<Record<string, string>> = {
  "mechanics/run-reward:Devotion": "Family Dispute",
  "mechanics/run-reward:MaxManaDrop": "Soul Tonic",
  "mechanics/run-reward:MemPointsCommonDrop": "Psyche",
  "mechanics/run-reward:MetaCardPointsCommonDrop": "Ashes",
  "mechanics/run-reward:MetaCurrencyDrop": "Bones",
  "world-progression/encounter:OpeningGeneratedN":
    "First City of Ephyra combat",
  "world-progression/enemy:CrawlerMiniboss": "King Vermin (Uh-oh)",
  "world-progression/region:Home": "The Crossroads",
  "world-progression/region:N_SubRooms": "City of Ephyra side rooms",
};

const PUBLIC_SLUG_OVERRIDES: Readonly<Record<string, string>> = {
  "mechanics/incantation:WorldUpgradeReviveIcarus": "night-life-for-the-dead",
  "mechanics/incantation:WorldUpgradeReviveIcarusRepeatable":
    "night-life-for-the-dead-repeatable",
  "world-progression/enemy:CrawlerMiniboss": "uh-oh",
};

const PUBLIC_SEARCH_ALIAS_OVERRIDES: Readonly<
  Record<string, readonly string[]>
> = {
  "world-progression/enemy:CrawlerMiniboss": [
    "Uh-oh",
    "King Vermin",
    "Vermin King",
  ],
};

const PUBLIC_GUIDE_STAGE_ANCHORS: Readonly<Record<string, string>> = {
  "exhaustive-completion": "exhaustive-completion",
  "first-route-clear": "first-route-clear",
  "main-story": "advance-both-routes",
  "practical-postgame": "complete-loadout",
  "true-ending": "true-ending",
};

const PUBLIC_MARKET_CATEGORIES: Readonly<Record<string, string>> = {
  MarketScreen_Exchange: "Standard exchanges",
  MarketScreen_Gifts: "Gift exchanges",
  MarketScreen_Resources: "Limited resource offers",
  MarketScreen_Sell: "Fish sales",
};

const spoilerOrder: Readonly<Record<SpoilerLevel, number>> = {
  none: 0,
  progression: 1,
  story: 2,
  ending: 3,
};

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function key(recordType: string, id: string): string {
  return `${recordType}:${id}`;
}

function reference(recordType: string, id: string): EditorialReference {
  return { recordType, id };
}

function object(value: unknown): Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Readonly<Record<string, unknown>>)
    : {};
}

function array(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : [];
}

function stringRules(value: unknown): readonly string[] {
  return array(value).filter(
    (rule): rule is string => typeof rule === "string" && rule.trim() !== "",
  );
}

function string(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() !== "" ? value : fallback;
}

function forbiddenValue(value: unknown): boolean {
  return (
    typeof value === "string" &&
    (/^[A-Za-z0-9_]+Data\.[A-Za-z0-9_.:-]+$/u.test(value) ||
      /^[A-Za-z]:\\|^(?:\/|\\\\)/u.test(value))
  );
}

function missingPublicToken(kind: string, value: string): never {
  throw new Error(`Missing public ${kind} label for ${value}.`);
}

function publicSlug(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLocaleLowerCase("en-US")
    .replace(/['’]/gu, "")
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "");
}

function keywordLabel(value: string): string {
  const known = (
    {
      AllElements: "all elements",
      AllElementsWithCount: "all elements",
      AutoEquip: "Awakening",
      AutofireAspect: "Devil Sparks",
      Armor: "Armor",
      Aspect: "Aspect",
      AspectPlural: "Aspects",
      Attack: "Attack",
      AttackBoon: "Attack boon",
      AttackEX: "Omega Attack",
      AttackSet: "Attacks",
      Bartender: "Taverna Keeper",
      Blind: "Daze",
      BladeRift: "Blade Rift",
      Block: "Parry",
      Burn: "Scorch",
      Biome: "region",
      BiomeF: "Erebus",
      BiomeG: "Oceanus",
      BiomeH: "the Fields of Mourning",
      BiomeI: "Tartarus",
      BiomeN: "the City of Ephyra",
      BiomeO: "the Rift of Thessaly",
      BiomeP: "Mount Olympus",
      BiomePlural: "regions",
      BiomeQ: "the Summit",
      Boss: "Guardian",
      BossPlural: "Guardians",
      BossPluralAlt: "Guardians",
      BossPlural_NoTooltip: "Guardians",
      BountyBoard: "Pitch-Black Stone",
      Broker: "Wretched Broker",
      Card: "Arcana Card",
      CardPlural: "Arcana Cards",
      CardTable: "Altar of Ashes",
      Cast: "Cast",
      CastEX: "Omega Cast",
      CastEXNoTooltip: "Omega Cast",
      CastSet: "Casts",
      CharFates: "the Fates",
      CharChaos: "Chaos",
      CharCharon: "Charon",
      CharChronos: "Chronos",
      CharDora: "Dora",
      CharHades: "Hades",
      CharHypnos: "Hypnos",
      CharIcarus: "Icarus",
      CharMoros: "Moros",
      CharNarcissus: "Narcissus",
      CharSelene: "Selene",
      CharSkelly: "Schelemeus",
      CharTyphon: "Typhon",
      ChallengeSwitch: "Infernal Trove",
      Cloud: "Festive Fog",
      ComboAspect: "Purifying Grace",
      ComboBuff: "Destructive",
      Codex: "Book of Shadows",
      Common: "Common",
      CommonWithCount: "Common",
      Costume: "Outfit",
      Crit: "Critical",
      Charm: "Charm",
      DeathBuff: "Omega Combo",
      DeathWeapon: "Inferno-Bomb",
      DelayedKnockback: "Glow",
      Dash: "Dash",
      DashSet: "Rushing",
      DashStrike: "Dash-Strike",
      DamageOverTime: "Hangover",
      DaggerBlockBuff: "Riposte",
      Deflect: "Deflect",
      Dodge: "Dodge",
      Duo: "Duo Boon",
      Echo: "Blitz",
      DiggingPointPlural: "digging spots",
      EliteChallengeSwitch: "elite Trove",
      Encounter: "encounter",
      EncounterAlt: "encounter",
      EncounterPlural: "encounters",
      EosAspectShot: "Daybreaker",
      Epic: "Epic",
      ExorcismPointPlural: "Lost Shades",
      ExtraChance: "Death Defiance",
      ExtraChanceAlt: "Death Defiance",
      ExtraChanceAthena: "Death Defiance",
      ExtraChanceCat: "Death Defiance",
      ExtraChanceMisc: "Death Defiance",
      ExtraMiniboss: "Shadow Servants",
      Familiar: "Animal Familiar",
      FamiliarPlural: "Animal Familiars",
      FamiliarBuff: "Psychic Leash",
      FishingPier: "Fishing Pier",
      FishingPointPlural: "fishing spots",
      Fountain: "Fountain",
      FountainPlural: "Fountains",
      FirstTimeSpell: "Godsent",
      FrenzyBuff: "Berserk",
      Fuel: "Sprouted",
      GardenPlots: "garden plots",
      GodBoon: "boon",
      GodBoonNoTooltip: "boon",
      GodBoonPlural: "boons",
      GodBoonPluralAlt: "boons",
      GodBoonPluralNoTooltip: "boons",
      GunAspect: "Frost Mane",
      HotSprings: "Hot Springs",
      Hold: "channel",
      HoldAlt: "channel",
      HoldNoTooltip: "channel",
      HeartBurst: "Heartthrob",
      HeartBurstPlural: "Heartthrobs",
      HadesSweep: "Scorn",
      HadesUrn: "Soul Urns",
      HarvestPointPlural: "Flora",
      Historian: "Learned Sage",
      Invulnerable: "invulnerable",
      InvulnerableAlt: "invulnerable",
      Invisible: "Dark",
      KeepsakeAlt: "Keepsake",
      KnockbackAmplify: "Froth",
      Keepsakes: "Keepsakes",
      MiniBossPlural: "minibosses",
      ManaDropZeus: "Aether Font",
      Mark: "Marked",
      MetaReward: "permanent resource",
      MetaRewardAlt: "Minor Finds",
      MusicPlayer: "Music Maker",
      MoonBeamVulnerability: "Shine",
      NyxAspectBuff: "Nightspawn",
      NyxSprint: "Omega Boost",
      Omega: "Omega moves",
      Overheat: "Valkyrie",
      PackagedBounties: "Chaos Trials",
      Polymorph: "Polymorph",
      PerfectClearChallengeSwitch: "Perfect Clear Trove",
      PickaxePointPlural: "mineral deposits",
      Perks: "Perks",
      PomLevel: "level",
      PowerShot: "Power Shot",
      PowerShotSpecial: "Power Shot",
      Rare: "Rare",
      Rarity: "rarity",
      RarityUpgrade: "Rarify",
      RaiseDeadAspect: "Ankh Scepter",
      RallyAspect: "Rock Lion Mace",
      Random: "Fates' Whim",
      Rend: "Wounds",
      ReserveMana: "Prime",
      ReserveManaAlt: "Prime",
      RecipeSpell: "recipe",
      RespawnEgg: "Revenant",
      RewardFinderObject: "Golden Boughs",
      RNG: "random seed",
      RoomAlt: "location",
      RoomPlural: "chambers",
      Root: "Freeze",
      RunReward: "room reward",
      SafeZone: "Ward Circle",
      SellTraitShop: "Pool of Purging",
      ShadeMerc: "recruited Shades",
      Shrine: "Oath of the Unseen",
      ShrineUpgradePlural: "Vows",
      ShrinePointReward: "Nightmare reward",
      SlowField: "Gust",
      Shell: "Shell",
      Shells: "Shells",
      Special: "Special",
      SpecialBoon: "Special boon",
      SpecialEX: "Omega Special",
      SpecialSet: "Specials",
      Spell: "Hex",
      Sprint: "Sprint",
      SprintBoon: "Sprint boon",
      SprintBoonAlt: "Sprint boon",
      Statistican: "Record Keeper",
      Steam: "Steam",
      Status: "status effect",
      StatusPlural: "Curses",
      StatusPluralAlt: "status effects",
      SurfaceShop: "Hermes Shrine",
      Synergy: "Infusion",
      TalentPoint: "Path of Stars upgrade",
      Taverna: "Crossroads Taverna",
      ThanatosAspectBuff: "Mortality",
      TraitExchangeAlt: "Sacrifice Boons",
      TripleAspect: "Crow Cutters",
      TripleAspectStrike: "Blood Triad",
      Tool: "gathering tool",
      ToolPlural: "gathering tools",
      Heroic: "Heroic",
      Legendary: "Legendary Boon",
      Link: "Hitch",
      BaseDamage: "Power",
      Warded: "warded",
      Weak: "Weak",
      Weapon: "Nocturnal Arm",
      WeaponPlural: "Nocturnal Arms",
      WeaponSet: "Weapon",
      WeaponShop: "Silver Pool",
      WellShop: "Well of Charon",
      ZoomOutObject: "bat cages",
      DrinkDrop: "Grape Juice",
      UnusedWeaponBonus: "Grave Thirst",
    } as Readonly<Record<string, string>>
  )[value];
  if (known !== undefined) return known;
  return missingPublicToken("keyword", value);
}

function iconLabel(value: string): string {
  const normalized = value
    .replace(/_NoTooltip$/u, "")
    .replace(/IconAlt$/u, "")
    .replace(/Icon$/u, "");
  return (
    (
      {
        ArmorTotal: "Armor",
        AirBoonAlt: "Air",
        BloodDrop: "Blood Drop",
        BountySkull: "",
        CardUpgradePoints: "Moon Dust",
        CharonPoints: "Obol Points",
        Clock: "encounters",
        CosmeticsPoints: "Prestige",
        CurseAether: "Aether",
        CurseAir: "Air",
        CurseEarth: "Earth",
        CurseFire: "Fire",
        CurseWater: "Water",
        DreamPoints: "Shiny Stars",
        EarthBoonAlt: "Earth",
        AirNoTooltip: "Air",
        EarthNoTooltip: "Earth",
        EnemyHealth: "foe's Life",
        FireNoTooltip: "Fire",
        WaterNoTooltip: "Water",
        AetherNoTooltip: "Aether",
        AllElementsBoonHack: "any single element",
        Currency: "Gold",
        ExtraChance: "Death Defiance",
        ExtraChanceMisc: "Death Defiance",
        FamiliarPoints: "Witch's Delight",
        FireBoonAlt: "Fire",
        GemPoints: "Gemstone",
        GiftPoints: "Nectar",
        GiftPointsEpic: "Bath Salts",
        GiftPointsRare: "Twin Lures",
        Hammer: "Daedalus Hammer",
        Health: "Life",
        HealthDown: "maximum Life",
        HealDrop: "Healing",
        HealthRestore: "Life restored",
        HealthRestoreAlt: "Life restored",
        HealthRestoreHome: "Life",
        HealthUp: "maximum Life",
        HealthUpAlt: "maximum Life",
        HealthUpTotal: "maximum Life",
        HypnosPoints: "Dream Vapor",
        IcarusPoints: "Fig Leaf",
        LastStandGiftItem: "Kiss of Styx",
        Mana: "Magick",
        ManaCrystal: "Grasp",
        ManaItem: "Magick",
        ManaUp: "maximum Magick",
        MaxManaDrop: "Soul Tonic",
        MemPointsCommon: "Psyche",
        MetaCardPointsCommon: "Ashes",
        MetaCurrency: "Bones",
        MetaFabric: "Fate Fabric",
        Mixer5Common: "Star Dust",
        MixerHBoss: "Tears",
        MixerShadow: "Shadow",
        MoneyDrop: "Gold",
        Moon_Full: "",
        Onion: "Onion",
        OreFSilver: "Silver",
        PlantFMoly: "Moly",
        PlantFNightshade: "Nightshade",
        PlantFNightshadeSeed: "Nightshade Seeds",
        PlantGLotus: "Lotus",
        PerkFrenzy: "",
        ReRollAlt: "rerolls",
        QuestProgressComplete: "",
        QuestProgressIncomplete: "",
        RandomLootGiftItem: "Mystery Boon",
        RandomPom: "Pom Slice",
        SeedMystery: "Mystery Seeds",
        ShieldHealth: "Barrier",
        ShrinePointNoTooltip: "Fear",
        Slash: "",
        SuperGiftPoints: "Ambrosia",
        ToolRodNoTooltip: "Fishing Rod",
        ToolRodIconNoTooltip: "Fishing Rod",
        TrashPoints: "Rubbish",
        WaterBoonAlt: "Water",
      } as Readonly<Record<string, string>>
    )[normalized] ?? missingPublicToken("icon", normalized)
  );
}

function publicText(value: string): string {
  const text = value
    .replace(/\{#[^}]+\}/gu, "")
    .replace(
      /\{!Icons\.([^}]+)\}/gu,
      (_match, label: string) => ` ${iconLabel(label)}`,
    )
    .replace(/\{\$Keywords\.([^}:]+)(?::[^}]*)?\}/gu, (_match, label: string) =>
      keywordLabel(label),
    )
    .replace(/\{![^}]+\}/gu, "")
    .replace(/[‘’]/gu, "'")
    .replace(/[“”]/gu, '"')
    .replace(/\s*—\s*/gu, ", ")
    .replace(
      /;\s*(\p{L})/gu,
      (_match, letter: string) => `. ${letter.toLocaleUpperCase()}`,
    )
    .replace(/;/gu, ".")
    .replace(/(\d)–(\d)/gu, "$1 to $2")
    .replace(/\bHealth\b/gu, "Life")
    .replace(/\bGraspGrasp\b/gu, "Grasp")
    .replace(/\bthe the\b/giu, "the")
    .replace(/\s+/gu, " ")
    .replace(/\s+([,.%])/gu, "$1")
    .replace(
      /\bdeal(s)? (\d+(?:\.\d+)?)% damage\b/gu,
      (_match, suffix: string | undefined, value: string) =>
        `deal${suffix ?? ""} ${value}% more damage`,
    )
    .replace(
      /\bhave (\d+(?:\.\d+)?)% maximum Health\b/gu,
      "have $1% more maximum Health",
    )
    .replace(
      /\b1 (rerolls|times|chances)\b/gu,
      (_match, noun: string) => `1 ${noun.slice(0, -1)}`,
    )
    .replace(
      /\b(\d+) (time|chance)\(s\)/gu,
      (_match, count: string, noun: string) =>
        `${count} ${count === "1" ? noun : `${noun}s`}`,
    )
    .replace(/\+(\d+) time\b/gu, "$1 additional time")
    .replace(/\+(\d+)level\b/gu, "$1 levels")
    .replace(/\b(move|Sprint is) (\d+(?:\.\d+)?) faster\b/gu, "$1 $2% faster")
    .replace(/\bhas (\d+(?:\.\d+)?%) chance\b/gu, "has a $1 chance")
    .replace(/\bYou have (\d+(?:\.\d+)?%) chance\b/gu, "You have a $1 chance")
    .replace(/\b(gain|have) (\d+(?:\.\d+)?%) chance\b/gu, "$1 a $2 chance")
    .replace(/\btake -(\d+(?:\.\d+)?)% damage\b/gu, "take $1% less damage")
    .replace(/\bdeal \+(\d+(?:\.\d+)?)%/gu, "deal $1% more")
    .replace(
      /\byour Attack or Special deal\b/gu,
      "your Attack or Special deals",
    )
    .replace(
      /\buse -(\d+(?:\.\d+)?)% Magick(?: less than before)?/gu,
      "use $1% less Magick",
    )
    .replace(/\bhave \+(\d+(?:\.\d+)?)% chance\b/gu, "have a $1% chance")
    .replace(
      /\bfind \+(\d+(?:\.\d+)?)% resources\b/gu,
      "find $1% more resources",
    )
    .replace(/\bhave \+(\d+(?:\.\d+)?)% range/gu, "have $1% more range")
    .replace(/\bhave -(\d+(?:\.\d+)?)% range/gu, "have $1% less range")
    .replace(/\buses -(\d+(?:\.\d+)?)% Magick/gu, "uses $1% less Magick")
    .replace(/\bmove -(\d+(?:\.\d+)?)% slower/gu, "move $1% slower")
    .replace(
      /\bhave \+(\d+(?:\.\d+)?) base damage/gu,
      "deal $1 additional base damage",
    )
    .replace(/\buse \+(\d+(?:\.\d+)?) Magick/gu, "use $1 additional Magick")
    .replace(/\bGain \+(\d+(?:\.\d+)?) Armor/gu, "Gain $1 Armor")
    .replace(
      /\bchannel \+(\d+(?:\.\d+)?) Magick into\b/gu,
      "channel $1 additional Magick into",
    )
    .replace(
      /\b(\d+(?:\.\d+)?) Sec\./gu,
      (_match, value: string) =>
        `${value} ${value === "1" ? "second" : "seconds"}`,
    )
    .replace(/\bevery 1 second\b/gu, "every second")
    .trim();
  const unresolved = /\{\$[^}]+\}/u.exec(text)?.[0];
  if (unresolved !== undefined) {
    throw new Error(
      `Reader-facing text contains an unresolved game template: ${unresolved}`,
    );
  }
  return text;
}

function enemyAttackLabel(enemyId: string, attackId: string): string {
  const stripped = attackId
    .replace(
      new RegExp(`^${enemyId.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}`, "u"),
      "",
    )
    .replace(/_(?:Elite|Miniboss|Shadow|Assist|AmbientBattle).*$/u, "")
    .replace(/(?:Selector|Weapon)$/u, "")
    .replace(/(?:_?P\d+|\d+)$/u, "")
    .replace(/_/gu, " ")
    .replace(/([a-z0-9])([A-Z])/gu, "$1 $2")
    .replace(/([A-Z])([A-Z][a-z])/gu, "$1 $2")
    .replace(/\s+/gu, " ")
    .trim();
  return stripped === "" ? "Primary attack" : stripped;
}

function enemyPriority(
  enemy: CombinedDataset["domains"]["guide"]["enemies"][number],
): number {
  const data = object(enemy.data);
  const classifications = new Set(enemy.classifications);
  return (
    (data.IsBoss === true ? 10_000 : 0) +
    (classifications.has("guardian") ? 5_000 : 0) +
    (classifications.has("miniboss") ? 1_000 : 0) +
    (classifications.has("normal") ? 100 : 0) +
    (typeof data.MaxHealth === "number"
      ? Math.min(data.MaxHealth, 99_999) / 100_000
      : 0) +
    enemy.regionIds.length -
    (/^NPC_/u.test(enemy.id) ? 20_000 : 0) -
    (/(?:_Elite|_Shadow|_SuperElite|_Support|_TyphonFight)$/u.test(enemy.id)
      ? 500
      : 0)
  );
}

function publicSentence(value: string): string {
  const text = publicText(value);
  return /[.!?]$/u.test(text) ? text : `${text}.`;
}

const ARCANA_DESCRIPTION_OVERRIDES: Readonly<Record<string, string>> = {
  BonusDodge: "Your Casts briefly make you invulnerable and move 50% faster.",
  BonusHealth: "Gain 20 maximum Life and 20 maximum Magick.",
  BonusRarity: "Each Boon offering has a 6% chance to include a Duo Boon.",
  CardDraw:
    "Activate 3 random inactive Arcana Cards whenever you vanquish a Guardian.",
  CastBuff: "Deal 20% more damage to foes in your Cast.",
  CastCount: "While you channel an Omega move, everything moves 40% slower.",
  ChanneledBlock:
    "Take no damage from the first hit in each Guardian encounter.",
  ChanneledCast: "Channel Omega moves 20% faster.",
  DoorReroll: "Gain 1 reroll that can change a room reward.",
  EpicRarityBoost:
    "Each Boon offering has a 5% chance to include an Epic Boon.",
  HealthRegen: "After you leave a chamber, restore 3 Life.",
  LastStand: "Gain 1 Death Defiance.",
  LowHealthBonus:
    "While you have no Death Defiance, take 30% less damage and deal 20% more damage.",
  LowManaDamageBonus:
    "While your Magick is below its maximum, your Attacks and Specials deal 30% more damage.",
  MagicCrit:
    "Each move in an Omega Combo has a 9% chance to deal Critical damage.",
  ManaOverTime: "Restore 6 Magick every second.",
  MaxHealthPerRoom:
    "Gain 3 maximum Life and 3 maximum Magick whenever you pass through 5 chambers.",
  MetaToRunUpgrade:
    "Once each night, turn a permanent resource reward into a random room reward.",
  RarityBoost:
    "Each Boon offering has a 30% chance to include a Legendary Boon. Otherwise, it includes at least one Rare Boon.",
  ScreenReroll:
    "Gain 1 reroll that can change a Boon offering or another eligible choice.",
  SorceryRegenUpgrade:
    "Your Hex gains charge equal to 1 Magick spent every second.",
  SprintShield: "Your Sprint is 5% faster and lets you pass through most foes.",
  StartingGold: "Begin each night with 200 Gold.",
  StatusVulnerability:
    "Deal 25% more damage to foes with at least 2 status effects from different Olympians.",
  TradeOff: "Gain 2 rerolls.",
};

const BOON_DESCRIPTION_OVERRIDES: Readonly<Record<string, string>> = {
  AllElementalBoon:
    "Gain 1 of every element and 1 Infusion Boon for each element.",
  ChaosCastCurse:
    "For the next 3 to 5 encounters, using Cast deals 3 to 6 damage to you.",
  ChaosCommonCurse:
    "The next 2 to 3 boons you find offer only Common blessings.",
  ChaosDamageCurse:
    "For the next 3 to 5 encounters, you take 20% to 50% more damage.",
  ChaosDashCurse:
    "For the next 3 to 5 encounters, each Dash costs 10 to 20 Magick.",
  ChaosDeathWeaponCurse:
    "For the next 3 to 5 encounters, slain foes throw an Inferno-Bomb at you.",
  ChaosExAttackCurse:
    "For the next 3 to 5 encounters, using an Omega move deals 5 to 8 damage to you.",
  ChaosHealthCurse:
    "For the next 3 to 5 encounters, your maximum Life is reduced.",
  ChaosHiddenRoomRewardCurse:
    "For the next 4 to 6 locations, chamber reward previews are hidden.",
  ChaosManaFocusCurse:
    "For the next 3 to 5 encounters, spending Magick Primes more Magick until the next chamber.",
  ChaosMetaUpgradeCurse:
    "For the next 3 to 6 encounters, your Arcana Cards have no effect.",
  ChaosNoMoneyCurse: "For the next 3 to 5 encounters, you cannot earn Gold.",
  ChaosPrimaryAttackCurse:
    "For the next 3 to 5 encounters, each Attack deals 3 to 6 damage to you.",
  ChaosRestrictBoonCurse:
    "The next 2 to 4 boons you find offer one fewer blessing.",
  ChaosSecondaryAttackCurse:
    "For the next 3 to 5 encounters, each Special deals 3 to 6 damage to you.",
  ChaosSpeedCurse:
    "For the next 3 to 5 encounters, you move and Sprint 40% to 60% slower.",
  ChaosStunCurse:
    "For the next 3 to 5 encounters, taking damage also stuns you for 0.5 to 1.4 seconds.",
  ChaosTimeCurse:
    "For the next 2 to 3 encounters, failing to clear the encounter within 120 seconds deals 500 damage to you.",
  CoverRegenerationBoon:
    "Whenever you Dodge or a foe misses because of Daze, restore some Life.",
  MissingHealthCritBoon:
    "Gain a chance to deal 200% damage. The chance rises as your remaining Life falls.",
  MoneyDamageBoon:
    "Fine Line and Ocean Swell have a 30% chance to trigger twice.",
  MoneyMultiplierBoon:
    "All Gold you gain is worth more. Receive 100 Gold immediately, including the Boon's bonus.",
  ElementalRarityUpgradeBoon:
    "While you have at least 2 of every element, all your Common Boons gain rarity.",
  InstantRootKill:
    "Foes afflicted with Freeze shatter when they reach 10% Life, damaging nearby foes.",
};

const ASPECT_DESCRIPTION_OVERRIDES: Readonly<Record<string, string>> = {
  SuitHexAspect:
    "Start each night with a unique Hex that strikes multiple foes and applies Shine.",
};

function boonDescription(
  id: string,
  description: string,
  effectsValue: unknown,
  mechanicsValue: unknown,
): string {
  return (
    BOON_DESCRIPTION_OVERRIDES[id] ??
    publicDescription(description, effectsValue, mechanicsValue)
  );
}

function publicSummary(subject: Subject): string | null {
  const name = subject.publicName ?? subject.officialName;
  const override = (
    {
      "mechanics/familiar:CatFamiliar":
        "Restores more Life through Death Defiance, attacks nearby foes, and helps locate fishing spots.",
      "mechanics/familiar:FrogFamiliar":
        "Adds maximum Life, leaps at foes, and helps locate Lost Shades.",
      "mechanics/familiar:HoundFamiliar":
        "Adds maximum Magick, periodically stuns nearby foes, and helps locate digging spots.",
      "mechanics/familiar:PolecatFamiliar":
        "Adds Dodge chance and move speed, retaliates against foes, and helps locate plants.",
      "mechanics/familiar:RavenFamiliar":
        "Adds Critical chance, pecks at foes, and helps locate mineral deposits.",
      "world-progression/region:Chaos":
        "Enter a Chaos Gate during a night to visit Chaos, accept a temporary curse, and receive its lasting blessing after the curse ends.",
      "world-progression/region:Home":
        "The Crossroads is the between-night hub where you prepare Arcana, craft equipment, perform incantations, and advance relationships.",
      "world-progression/region:N_SubRooms":
        "The City of Ephyra contains optional side rooms that hold rewards and help open the route to its Guardian.",
      "world-progression/strife-curse:strife-blessing":
        "Early Surface progress can trigger a staged curse that begins at 20% extra enemy damage and gains 5 percentage points after each encounter, up to 100% for that night.",
      "world-progression/surface-penalty:surface-ward":
        "Before its cure, the first Surface combat deals 1 self-damage after five seconds and increases the damage by 1 on every later tick.",
    } as Readonly<Record<string, string>>
  )[key(subject.recordType, subject.id)];
  if (override !== undefined) return override;

  const directDescription = subject.values.description;
  if (typeof directDescription === "string" && directDescription.trim() !== "")
    return directDescription;

  for (const fieldId of [
    "name-description",
    "base-effect",
    "effect",
    "effects",
    "behavior",
  ] as const) {
    const value = object(subject.values[fieldId]);
    if (
      typeof value.description === "string" &&
      value.description.trim() !== ""
    )
      return value.description;
  }

  if (subject.recordType === "mechanics/god") {
    return stringRules(object(subject.values.availability).rules)[0] ?? null;
  }
  if (subject.recordType === "world-progression/enemy") {
    const stats = object(subject.values.stats);
    const classification = object(subject.values.classification);
    const roles = array(classification.classifications).flatMap((value) =>
      typeof value === "string" ? [value] : [],
    );
    const role = roles.includes("guardian")
      ? "Guardian"
      : roles.includes("miniboss")
        ? "miniboss"
        : "enemy";
    const maximumLife = stats["maximum-life"];
    return typeof maximumLife === "number"
      ? `${role[0]?.toUpperCase() ?? "E"}${role.slice(1)} with ${String(maximumLife)} maximum Life, exact combat traits, and extracted attack patterns.`
      : `${role[0]?.toUpperCase() ?? "E"}${role.slice(1)} with exact combat traits and extracted attack patterns.`;
  }
  if (subject.recordType === "world-progression/encounter-friend") {
    return stringRules(object(subject.values.appearance).rules)[0] ?? null;
  }
  if (subject.recordType === "world-progression/region") {
    return (
      stringRules(object(subject.values["unlock-requirements"]).rules)[0] ??
      null
    );
  }
  if (subject.recordType === "world-progression/relationship") {
    const giftTrack = object(subject.values["gift-track"]);
    return typeof giftTrack.summary === "string" &&
      giftTrack.summary.trim() !== ""
      ? giftTrack.summary
      : null;
  }
  if (subject.recordType === "mechanics/fish") {
    return `Where to catch ${name}, how rare it is, and how many Bones it sells for.`;
  }
  if (subject.recordType === "mechanics/resource") {
    return `Where to obtain ${name}, what consumes it, and which permanent upgrade should receive it first.`;
  }
  if (subject.recordType === "world-progression/testament-bounty") {
    return `The exact combat, loadout, Arcana, and story requirements for unlocking ${name}.`;
  }
  if (subject.recordType === "world-progression/prophecy") {
    const objectives = object(subject.values.objectives);
    const rules = stringRules(objectives.rules);
    const references = array(objectives.references);
    const items = array(objectives.items);
    const requirementCount = references.length + items.length;
    if (requirementCount > 0) {
      const exactRule = rules[0];
      const allBoons =
        items.length === 0 &&
        references.every(
          (entry) => object(entry).recordType === "mechanics/boon",
        );
      const minimum = exactRule?.match(/\bat least\s+(\d+)\b/iu)?.[1];
      if (minimum !== undefined) {
        return `Record at least ${minimum} of ${String(requirementCount)} required ${allBoons ? "Boons" : "entries"} across any number of nights.`;
      }
      return `Record all ${String(requirementCount)} required ${allBoons ? "Boons" : "entries"} across any number of nights.`;
    }
    return rules[0] ?? null;
  }
  return null;
}

function nestedValue(value: unknown, path: string): unknown {
  let current: unknown = value;
  for (const part of path
    .replace(/\[(\d+)\]/gu, ".$1")
    .split(".")
    .filter(Boolean)) {
    if (typeof current !== "object" || current === null) return undefined;
    current = (current as Readonly<Record<string, unknown>>)[part];
  }
  return current;
}

function nestedLuaValue(value: unknown, path: string): unknown {
  let current: unknown = value;
  const parts = path
    .replace(/([^.])\[(\d+)\]/gu, "$1.[$2]")
    .split(".")
    .filter(Boolean);
  for (const part of parts) {
    const arrayIndex = /^(?:\[(\d+)\]|(\d+))$/u.exec(part);
    if (arrayIndex !== null) {
      if (!Array.isArray(current)) return undefined;
      current = current[Number(arrayIndex[1] ?? arrayIndex[2]) - 1];
      continue;
    }
    if (typeof current !== "object" || current === null) return undefined;
    current = (current as Readonly<Record<string, unknown>>)[part];
  }
  return current;
}

function formattedInlineValue(
  value: unknown,
  format: string | undefined,
): string | null {
  if (typeof value === "object" && value !== null) {
    const input = object(value);
    value = input.BaseValue ?? input.Value;
  }
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (format === "P" && typeof value === "number")
    return `${String(value * 100)}%`;
  if (format === "F" && typeof value === "number")
    return `${String(Math.abs(value) <= 2 ? value * 100 : value)}%`;
  return String(value);
}

function sampleDisplayValue(
  value: unknown,
  format: string | undefined,
  resolved: boolean,
): string | null {
  if (typeof value === "object" && value !== null) {
    const input = object(value);
    value = input.BaseValue ?? input.Value;
  }
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value !== "number" || resolved) return String(value);
  if (format === "NegativePercentDelta")
    return String(Math.round((1 - value) * 100));
  if (format === "PercentDelta") return String(Math.round((value - 1) * 100));
  if (
    /(?:Percent|LuckModifiedPercent|TimesOneHundredPercent)$/u.test(
      format ?? "",
    ) &&
    Math.abs(value) <= 2
  ) {
    return String(Math.round(value * 1000) / 10);
  }
  return String(value);
}

function displayAsPercent(format: string | undefined): boolean {
  return /Percent/u.test(format ?? "");
}

function publicDescription(
  description: string,
  effectsValue: unknown,
  mechanicsValue: unknown,
): string {
  const samples = array(effectsValue);
  const preferred =
    samples.find((entry) => {
      const sample = object(entry);
      return (
        sample.rarity === "Common" &&
        sample.level === 1 &&
        object(sample.result).status === "ok"
      );
    }) ?? samples.find((entry) => object(object(entry).result).status === "ok");
  const mechanics = object(mechanicsValue);
  const formats = new Map(
    array(mechanics.ExtractValues).flatMap((entry) => {
      const extract = object(entry);
      const id = string(extract.ExtractAs, "");
      return id === ""
        ? []
        : [
            [
              id,
              typeof extract.Format === "string" ? extract.Format : undefined,
            ] as const,
          ];
    }),
  );
  const values = new Map<string, string>();
  for (const entry of array(object(object(preferred).result).values)) {
    const value = object(entry);
    const id = string(value.id, "");
    const resolution = object(value.resolution);
    const resolved = resolution.value;
    const source = object(value.source).value;
    const display = sampleDisplayValue(
      resolved ?? source,
      formats.get(id),
      resolved !== undefined,
    );
    if (id !== "" && display !== null) values.set(id, display);
  }
  for (const entry of array(mechanics.ExtractValues)) {
    const extract = object(entry);
    const id = string(extract.ExtractAs, "");
    const path = string(extract.Key, "");
    if (id === "" || path === "" || values.has(id)) continue;
    const display = sampleDisplayValue(
      nestedLuaValue(mechanics, path),
      formats.get(id),
      false,
    );
    if (display !== null) values.set(id, display);
  }
  const orderedIds = array(mechanics.ExtractValues)
    .map((entry) => string(object(entry).ExtractAs, ""))
    .filter((id) => id !== "");
  const resolved = description
    .replace(
      /\{\$TooltipData\.StatDisplay(\d+)\}/gu,
      (token, index: string) => {
        const id = orderedIds[Number(index) - 1] ?? "";
        const value = values.get(id);
        return value === undefined
          ? token
          : `${value}${displayAsPercent(formats.get(id)) ? "%" : ""}`;
      },
    )
    .replace(
      /\{\$TooltipData\.ExtractData\.([^}:]+)(?::([^}]+))?\}/gu,
      (token, id: string, format: string | undefined) => {
        const value = values.get(id);
        return value === undefined
          ? token
          : `${value}${format === "F" || format === "P" ? "%" : ""}`;
      },
    )
    .replace(
      /\{\$TooltipData\.([A-Za-z0-9_]+)(?::([^}]+))?\}/gu,
      (token, id: string, format: string | undefined) => {
        const value =
          values.get(id) ??
          formattedInlineValue(nestedLuaValue(mechanics, id), undefined);
        return value === null || value === undefined
          ? token
          : `${value}${format === "F" || format === "P" ? "%" : ""}`;
      },
    )
    .replace(
      /\{\$TraitData\.([^.}]+)\.([^}:]+)(?::([^}]+))?\}/gu,
      (token, _id: string, path: string, format: string | undefined) => {
        return (
          formattedInlineValue(nestedLuaValue(mechanics, path), format) ?? token
        );
      },
    )
    .replace(
      /\{\$[A-Za-z0-9_]+Data(?:Enemies)?\.[^.}]+\.([^}:]+)(?::([^}]+))?\}/gu,
      (token, path: string, format: string | undefined) => {
        return (
          formattedInlineValue(nestedLuaValue(mechanics, path), format) ?? token
        );
      },
    );
  return publicSentence(resolved);
}

function keepsakeDescription(
  id: string,
  description: string,
  rankEffects: unknown,
  mechanics: unknown,
): string {
  const override = (
    {
      BossPreDamageKeepsake:
        "The next Guardian starts with 5% less Life. You take 10% less damage from Guardians.",
      BossMetaUpgradeKeepsake:
        "After the next Guardian, activate two random inactive Arcana Cards at rank I, II, or III according to this Keepsake's rank.",
      DamagedDamageBoostKeepsake:
        "After taking 250 total damage this night, your Omega moves deal 20%, 30%, or 40% more damage according to this Keepsake's rank.",
      DeathVengeanceKeepsake:
        "Deal 20% more damage to the last foe that vanquished you.",
      EscalatingKeepsake:
        "After each encounter, you deal and take 0.5%, 0.8%, or 1% more damage for the rest of the night according to this Keepsake's rank.",
      FountainRarityKeepsake:
        "Fountains restore 20% more Life. The next Fountain upgrades one random Common boon to Rare.",
      HadesAndPersephoneKeepsake:
        "While the Fates' Whim is active, gain one random Hades blessing and add one level to most of your boons.",
      LowHealthCritKeepsake:
        "For the next region, gain a 20% Critical chance, but your maximum Life is limited to 30.",
      SkipEncounterKeepsake:
        "One encounter in one, two, or three regions may contain no foes this night, according to this Keepsake's rank.",
    } as Readonly<Record<string, string>>
  )[id];
  return override ?? publicDescription(description, rankEffects, mechanics);
}

function oathDescription(id: string): string {
  const descriptions: Readonly<Record<string, string>> = {
    BanUnpickedBoonsShrineUpgrade:
      "After you choose a boon, two blessings you did not choose cannot appear again that night.",
    BiomeSpeedShrineUpgrade:
      "Each region must be cleared within 9, 7, or 5 minutes according to the selected rank.",
    BoonManaReserveShrineUpgrade:
      "Choosing a boon Primes 3 or 6 Magick for every rarity above Common according to the selected rank.",
    BoonSkipShrineUpgrade:
      "The first Olympian boon in each region becomes an Onion instead.",
    BossDifficultyShrineUpgrade:
      "Guardians in the first one, two, three, or four regions gain stronger variants according to the selected rank.",
    EnemyCountShrineUpgrade:
      "Most encounters contain 20%, 40%, or 60% more foes according to the selected rank.",
    EnemyDamageShrineUpgrade:
      "All foes deal 20%, 60%, or 100% more damage according to the selected rank.",
    EnemyEliteShrineUpgrade:
      "Most Armored foes gain one or two random perks according to the selected rank.",
    EnemyHealthShrineUpgrade:
      "All foes have 10%, 20%, or 30% more Life according to the selected rank.",
    EnemyRespawnShrineUpgrade:
      "Most slain foes have a 25% or 50% chance to return as Revenants according to the selected rank.",
    EnemyShieldShrineUpgrade:
      "All foes gain one or two Shields according to the selected rank.",
    EnemySpeedShrineUpgrade:
      "All foes move and attack 20% or 40% faster according to the selected rank.",
    HealingReductionShrineUpgrade:
      "Life-restoring effects are reduced to 75%, 50%, or 0% effectiveness according to the selected rank.",
    LimitGraspShrineUpgrade:
      "Only 60%, 40%, 20%, or 0% of your Grasp is available according to the selected rank.",
    MinibossCountShrineUpgrade:
      "Every miniboss encounter contains at least one additional miniboss.",
    NextBiomeEnemyShrineUpgrade:
      "Most foes have a 10% or 25% chance to come from the next region according to the selected rank.",
    ShopPricesShrineUpgrade:
      "All Gold prices are 40% or 80% higher according to the selected rank.",
  };
  const description = descriptions[id];
  if (description === undefined)
    throw new Error(`Oath condition ${id} has no authored public description.`);
  return description;
}

function oathRankEffect(id: string, rankValue: unknown): string {
  const changeValue = object(rankValue).ChangeValue;
  if (typeof changeValue !== "number")
    throw new Error(`Oath condition ${id} has a rank without ChangeValue.`);

  const percentage = (value: number): string => String(Math.round(value * 100));
  const increase = (value: number): string => percentage(value - 1);
  const count = String(changeValue);
  const counted = (singular: string, plural = `${singular}s`): string =>
    `${count} ${changeValue === 1 ? singular : plural}`;
  const effects: Readonly<Record<string, () => string>> = {
    BanUnpickedBoonsShrineUpgrade: () =>
      `${counted("blessing")} you leave behind cannot appear again that night.`,
    BiomeSpeedShrineUpgrade: () =>
      `Each region has a ${String(changeValue / 60)}-minute limit.`,
    BoonManaReserveShrineUpgrade: () =>
      `Each boon Primes ${count} Magick for every rarity above Common.`,
    BoonSkipShrineUpgrade: () =>
      `${changeValue === 1 ? "The first Olympian boon" : `The first ${count} Olympian boons`} in each region ${changeValue === 1 ? "becomes" : "become"} an Onion.`,
    BossDifficultyShrineUpgrade: () =>
      `Guardians in the ${changeValue === 1 ? "first region" : `first ${count} regions`} gain stronger variants.`,
    EnemyCountShrineUpgrade: () =>
      `Most encounters contain ${increase(changeValue)}% more foes.`,
    EnemyDamageShrineUpgrade: () =>
      `All foes deal ${increase(changeValue)}% more damage.`,
    EnemyEliteShrineUpgrade: () =>
      `Most Armored foes gain ${counted("random perk", "random perks")}.`,
    EnemyHealthShrineUpgrade: () =>
      `All foes have ${increase(changeValue)}% more Life.`,
    EnemyRespawnShrineUpgrade: () =>
      `Most slain foes have a ${percentage(changeValue)}% chance to return as Revenants.`,
    EnemyShieldShrineUpgrade: () => `All foes gain ${counted("Shield")}.`,
    EnemySpeedShrineUpgrade: () =>
      `All foes move and attack ${increase(changeValue)}% faster.`,
    HealingReductionShrineUpgrade: () =>
      `Life-restoring effects retain ${percentage(changeValue)}% effectiveness.`,
    LimitGraspShrineUpgrade: () => `${count}% of your Grasp is available.`,
    MinibossCountShrineUpgrade: () =>
      `Every miniboss encounter contains at least ${counted("additional miniboss", "additional minibosses")}.`,
    NextBiomeEnemyShrineUpgrade: () =>
      `Most foes have a ${percentage(changeValue)}% chance to come from the next region.`,
    ShopPricesShrineUpgrade: () =>
      `All Gold prices are ${increase(changeValue)}% higher.`,
  };
  const effect = effects[id];
  if (effect === undefined)
    throw new Error(
      `Oath condition ${id} has no public rank effect formatter.`,
    );
  return effect();
}

function incantationDescription(
  id: string,
  description: string,
  effects: Readonly<Record<string, unknown>>,
): string {
  const overrides = (
    {
      WorldUpgradeBossDifficultyT2:
        "Unlock the second rank of the Vow of Rivals, adding stronger Guardian variants.",
      WorldUpgradeBossDifficultyT3:
        "Unlock the third rank of the Vow of Rivals, adding stronger Guardian variants.",
      WorldUpgradeBossDifficultyT4:
        "Unlock the final rank of the Vow of Rivals, adding stronger Guardian variants.",
      WorldUpgradeBreakableValue1:
        "Add Golden Urns to chambers. Break them to collect Gold.",
      WorldUpgradeFountainUpgrade1:
        "Increase Fountain healing from 20% to 30% of maximum Life.",
      WorldUpgradeFountainUpgrade2:
        "Increase Fountain healing from 30% to 40% of maximum Life.",
      WorldUpgradeHarvestUpgrade:
        "Gain a 35% chance to find 1 additional Seed whenever you harvest a garden plot.",
      WorldUpgradeMetaCardPointsCommonRunProgress:
        "Ash rewards also grant 5 maximum Life for the current night.",
      WorldUpgradeMetaCurrencyRunProgress:
        "Bones rewards also grant 5 maximum Magick for the current night.",
      WorldUpgradeMetaUpgradeSaveLayout:
        "Let the Altar of Ashes save up to six Arcana layouts.",
      WorldUpgradePauseChronosFight:
        "Allow pausing during Chronos encounters affected by the Vow of Rivals.",
      WorldUpgradePinning:
        "Let recipes be pinned so their required resources stay visible while you play.",
      WorldUpgradePinningBoons:
        "Allow boon requirements to be tracked from the Book of Shadows.",
      WorldUpgradeSellShop:
        "Let the Wretched Broker buy fish caught with the Fishing Rod.",
      WorldUpgradeEphyraZoomOut:
        "Use bat cages throughout the City of Ephyra to survey the district and locate its pylons.",
      WorldUpgradeTimeSlowChronosFight:
        "Allow time-slowing effects, including Phase Shift, to affect Chronos.",
      WorldUpgradeUnusedWeaponBonus:
        "Give one random Nocturnal Arm Grave Thirst each night. It yields Bones after each cleared chamber.",
    } as Readonly<Record<string, string>>
  )[id];
  if (overrides !== undefined) return overrides;
  const resolved = description.replace(
    /\{\$WorldUpgradeData\.([^.}]+)\.([^}:]+)(?::([^}]+))?\}/gu,
    (token, recordId: string, path: string, format: string | undefined) => {
      if (recordId !== id) return token;
      return formattedInlineValue(nestedValue(effects, path), format) ?? token;
    },
  );
  return publicSentence(resolved);
}

function incantationEffect(
  id: string,
  description: string,
  automaticUnlock: boolean,
  effectsValue: unknown,
  resourceNames: ReadonlyMap<string, string>,
): JsonValue {
  const effects = object(effectsValue);
  const result = object(effects.OnActivateFinishedFunctionArgs);
  const resourceId = string(result.ResourceName, "");
  const resourceAmount =
    typeof result.ResourceAmount === "number"
      ? result.ResourceAmount
      : resourceId === ""
        ? null
        : 1;
  return json({
    description: incantationDescription(id, description, effects),
    automaticUnlock,
    repeatable: effects.Repeatable === true,
    brewDurationInEncounters:
      typeof effects.CookTime === "number" ? effects.CookTime : null,
    output:
      resourceId === ""
        ? null
        : {
            resource: resourceNames.has(resourceId)
              ? reference("mechanics/resource", resourceId)
              : { kind: "resource", id: resourceId },
            amount: resourceAmount,
          },
    gardenPlotsAdded:
      typeof effects.NumPlots === "number" ? effects.NumPlots : null,
    harvestBonusSeedChancePercent:
      typeof effects.SeedChancePercent === "number"
        ? effects.SeedChancePercent
        : null,
  });
}

function encounterAidDescription(
  id: string,
  description: string,
  effects: Readonly<Record<string, unknown>>,
): string {
  const override = (
    {
      CastDamageCostume:
        "Don an Outfit with 20 Armor that makes your Cast deal 100% more damage.",
      CirceEnlargeTrait:
        "Grow in size, increase maximum Life by 15%, and deal 15% more damage with your Nocturnal Arm.",
      CirceShrinkTrait:
        "Shrink in size, move 10% faster, and gain a 10% Dodge chance.",
      DeathDefianceRetaliateCurse:
        "Whenever a foe makes you use Death Defiance, it loses 15% of its Life.",
      DiminishingHealthAndManaBoon:
        "Increase maximum Life and maximum Magick by 60%. The bonus falls by 5 percentage points after each chamber.",
      EchoLastReward:
        "Create another copy of the most recent chamber reward you claimed.",
      EchoRepeatKeepsakeBoon:
        "After switching Keepsakes, retain the basic effect of the previous Keepsake as well.",
      EscalatingCostume:
        "Don an Outfit with 5 Armor. Its damage bonus rises by 3 percentage points after each encounter.",
      ExPolymorphBoon:
        "Your Omega moves have a 15% chance to inflict Polymorph on a susceptible foe, with a 10-second cooldown.",
      HadesChronosDebuffBoon:
        "Chronos summons 50% fewer reinforcements during your confrontation.",
      HadesPreDamageBoon:
        "Chronos loses 20% of his Life three seconds after your confrontation begins.",
      HealAmplifyTrait:
        "Restore 50% of your maximum Life now. Life-restoring effects are 25% stronger this night.",
      HealingOnDeathCurse:
        "After a foe is slain, it has a 20% chance to drop an item that restores 10 Life, once per chamber.",
      HighHealthCritBoon:
        "Damage against foes with at least 80% Life or 80% Armor may be Critical.",
      ManaCostume:
        "Don an Outfit with 40 Armor that restores 5 Magick every second.",
      MoneyOnDeathCurse:
        "After a foe is slain, it has a 10% chance to drop 20 Gold, up to twice per chamber.",
      NarcissusA: "Receive 1 Pom of Power, 2 Moly, and 3 Nightshade.",
      NarcissusB: "Receive a major healing pickup and 10 Ashes.",
      NarcissusC: "Receive 6 Silver and 100 Gold.",
      NarcissusD:
        "Gain 30 maximum Magick for the current night and receive 20 Psyche.",
      NarcissusE:
        "Gain 25 maximum Life for the current night and receive 50 Bones.",
      NarcissusF: "Receive 2 Fate Fabric and 2 rerolls.",
      NarcissusG: "Receive 1 Star Dust and 2 Elemental Essence.",
      NarcissusI: "Receive a mystery reward and 1 Mystery Seed.",
      NewStatusDamage:
        "Inflicting a new status effect deals 50 damage. This can trigger once per second.",
      RandomBaseDamageBoon:
        "Each Attack hit randomly deals exactly 5, 55, or 555 damage.",
      SlowProjectileCurse: "Foes' ranged shots travel 40% slower.",
      SpellCostume:
        "Don an Outfit with 55 Armor that reduces the Magick needed to charge your Hex by 30%.",
      SupplyDropBoon:
        "After every 7 cleared encounters, restore 10 Life and receive 2 random Pom upgrades.",
    } as Readonly<Record<string, string>>
  )[id];
  return (
    override ?? publicDescription(description, effects.samples, effects.trait)
  );
}

function statusDescription(
  id: string,
  description: string,
  data: Readonly<Record<string, unknown>>,
): string {
  const override = (
    {
      ChaosOmegaDamageBlessing:
        "After the curse ends, your Omega moves deal 30% more damage for each Aether you have.",
      ElementalUnifiedBoon:
        "While you have at least 8 of any one base element, you deal 25% more damage.",
      MoonBeamVulnerability:
        "Afflicted foes take 50% more damage from Omega moves for 8 seconds.",
      SafeZone:
        "After activation, a Warding Circle repels foes and their attacks for 5 seconds.",
      Charm:
        "Afflicted foes turn against your other foes and deal more damage to them.",
      Frenzy:
        "For 8 seconds, your actions are faster and each foe struck restores 1 Life.",
    } as Readonly<Record<string, string>>
  )[id];
  if (override !== undefined) return override;
  if (id === "DamageOverTime") {
    const duration = nestedValue(data, "DataProperties.Duration");
    if (typeof duration === "number")
      return `Hangover deals damage continuously for ${String(duration)} seconds.`;
  }
  return publicDescription(description, data.samples, data.trait ?? data);
}

function hammerDescription(
  id: string,
  description: string,
  effects: unknown,
  mechanics: unknown,
): string {
  const override = (
    {
      AxeSturdyTrait:
        "Your Attacks deal 10 additional base damage, and you take 20% less damage while using them.",
      AxeRallyFirstStrikeTrait:
        "Your Attack hits twice, but the five-strike sequence becomes only the first slam.",
      DaggerBackstabTrait:
        "Your Attack deals 150% more damage when it strikes a foe from behind.",
      DaggerSpecialFanTrait:
        "Your Special deals 20% more damage, and your Omega Special fires 3 additional shots.",
      DaggerSpecialLineTrait:
        "Your Omega Special fires every shot straight ahead, and your Specials have 30% more range.",
      DaggerSpecialJumpTrait:
        "Your Special deals 15% more damage, and each hit bounces toward up to 2 more foes.",
      LobGrowthTrait:
        "Your Attack gains 50% more damage and blast size over 0.7 seconds before it explodes.",
      LobGunSpecialBounceTrait:
        "Your Special flies faster and deals 15% more damage for each foe struck.",
      LobStraightShotTrait:
        "After you Dash or use Special, your Attacks fire faster and deal 15 additional base damage.",
      LobSturdySpecialTrait:
        "Your Specials deal 30 additional base damage, and you take 30% less damage while using them.",
      StaffTripleShotTrait:
        "Your Specials fire 2 projectiles, but have 40% less range.",
      SuitAttackRangeTrait:
        "Your Attack deals 30% more damage and reaches farther ahead.",
      SuitSpecialAutoTrait:
        "Whenever your Attack strikes a foe, your Special has a 25% chance to fire automatically.",
      SuitSpecialDiscountTrait:
        "Your Omega Special locks on faster and uses 20% less Magick.",
      TorchAutofireSprintTrait:
        "While you Sprint, your Attacks and Specials deal 5 additional base damage.",
      TorchSpecialLineTrait:
        "Your Special deals 100 additional damage to Armor.",
    } as Readonly<Record<string, string>>
  )[id];
  return override ?? publicDescription(description, effects, mechanics);
}

function sanitizedJson(value: unknown): JsonValue | undefined {
  if (forbiddenValue(value)) return undefined;
  if (typeof value === "string") return publicText(value);
  if (
    value === null ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  )
    return value;
  if (Array.isArray(value))
    return value
      .map(sanitizedJson)
      .filter((entry): entry is JsonValue => entry !== undefined);
  if (typeof value !== "object") return undefined;
  const output: Record<string, JsonValue> = {};
  for (const [entryKey, entry] of Object.entries(value).sort(
    ([left], [right]) => compareStrings(left, right),
  )) {
    if (
      entry !== undefined &&
      !/^(?:evidence|runtimePath|runtimePaths|localizationPath|sourceText|reportSources|path|GameStateRequirements|MaxedRequirement|PathFalse|PathTrue)$/iu.test(
        entryKey,
      ) &&
      !/(?:Icon|Animation|Granny|Vfx|Sfx|Sound|Cue|Voice|TextLine|Portrait|Texture|Model|Image|Video|Audio)/iu.test(
        entryKey,
      )
    ) {
      if (Array.isArray(entry) && entry.some(forbiddenValue)) continue;
      const sanitized = sanitizedJson(entry);
      if (sanitized !== undefined) output[entryKey] = sanitized;
    }
  }
  return output;
}

function json(value: unknown): JsonValue {
  return sanitizedJson(value) ?? null;
}

function hasContent(value: JsonValue): boolean {
  if (value === null) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
}

function pick(value: unknown, keys: readonly string[]): JsonObject {
  const input = object(value);
  return Object.fromEntries(
    keys
      .filter((entry) => input[entry] !== undefined)
      .map((entry) => [entry, json(input[entry])]),
  ) as JsonObject;
}

function rawPick(
  value: unknown,
  keys: readonly string[],
): Readonly<Record<string, unknown>> {
  const input = object(value);
  return Object.fromEntries(
    keys.flatMap((entry) =>
      input[entry] === undefined ? [] : [[entry, input[entry]] as const],
    ),
  );
}

function costs(value: unknown): JsonValue {
  return array(value).map((entry) => {
    const input = object(entry);
    const resourceId = string(input.resourceId, "");
    return json({
      ...Object.fromEntries(
        Object.entries(input).filter(
          ([field]) => field !== "resourceId" && field !== "evidence",
        ),
      ),
      ...(resourceId === ""
        ? {}
        : { resource: reference("mechanics/resource", resourceId) }),
    });
  });
}

function identifiersIn(value: unknown): readonly string[] {
  const identifiers = new Set<string>();
  const visit = (entry: unknown): void => {
    if (typeof entry === "string") {
      identifiers.add(entry);
      return;
    }
    if (Array.isArray(entry)) {
      entry.forEach(visit);
      return;
    }
    if (typeof entry === "object" && entry !== null)
      Object.values(entry).forEach(visit);
  };
  visit(value);
  return [...identifiers].sort(compareStrings);
}

function prerequisiteChoiceGroups(
  value: unknown,
  boonIds: ReadonlySet<string>,
): readonly (readonly EditorialReference[])[] {
  const requirements = object(value);
  const groupedChoices = array(requirements.OneFromEachSet)
    .map((group) =>
      array(group)
        .filter((id): id is string => typeof id === "string" && boonIds.has(id))
        .map((id) => reference("mechanics/boon", id)),
    )
    .filter((group) => group.length > 0);
  if (groupedChoices.length > 0) return groupedChoices;

  const alternatives = array(requirements.OneOf)
    .filter((id): id is string => typeof id === "string" && boonIds.has(id))
    .map((id) => reference("mechanics/boon", id));
  return alternatives.length > 0 ? [alternatives] : [];
}

function publicLocator(value: string, dataset: CombinedDataset): JsonValue {
  for (const [prefix, recordType] of [
    ["gathering-tool:", "mechanics/gathering-tool"],
    ["fishing:", "mechanics/fish"],
    ["fish-sale:", "mechanics/fish"],
    ["cultivation:", "mechanics/cultivation"],
    ["market:", "mechanics/market-offer"],
  ] as const) {
    if (value.startsWith(prefix))
      return json(reference(recordType, value.slice(prefix.length)));
  }
  const separator = value.indexOf(".");
  const source = separator < 0 ? "record" : value.slice(0, separator);
  const id = separator < 0 ? value : value.slice(separator + 1);
  const targets: readonly [
    string,
    readonly { readonly id: string }[],
    string,
  ][] = [
    [
      "QuestData",
      dataset.domains.guide.prophecies,
      "world-progression/prophecy",
    ],
    [
      "EncounterData",
      dataset.domains.guide.encounters,
      "world-progression/encounter",
    ],
    ["EnemyData", dataset.domains.guide.enemies, "world-progression/enemy"],
    ["TraitData", dataset.domains.boons.boons, "mechanics/boon"],
  ];
  const target = targets.find(
    ([prefix, records]) =>
      prefix === source && records.some((record) => record.id === id),
  );
  if (target !== undefined) return json(reference(target[2], id));
  const kind =
    (
      {
        ConsumableData: "drop",
        RoomData: "room",
        WeaponData: "weapon-state",
      } as Readonly<Record<string, string>>
    )[source] ??
    source
      .replace(/Data$/u, "")
      .replace(/([a-z])([A-Z])/gu, "$1-$2")
      .toLocaleLowerCase("en-US");
  return { kind, id };
}

function uniqueJson(values: readonly unknown[]): readonly JsonValue[] {
  const seen = new Set<string>();
  return values.map(json).filter((value) => {
    const key = JSON.stringify(value);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function resourceAcquisitionLocations(
  entries: readonly string[],
  dataset: CombinedDataset,
): readonly JsonValue[] {
  const rooms = new Map(
    dataset.domains.guide.rooms.map((room) => [room.id, room]),
  );
  const marketOffers = new Map(
    dataset.domains.guide.marketOffers.map((offer) => [offer.id, offer]),
  );
  const runRewardIds = new Set(
    dataset.domains.guide.runRewards.map((reward) => reward.id),
  );
  const output: unknown[] = [];
  for (const entry of entries) {
    const separator = entry.indexOf(".");
    const source = separator < 0 ? "" : entry.slice(0, separator);
    const id = separator < 0 ? entry : entry.slice(separator + 1);
    if (source === "RoomData" || source === "HubRoomData") {
      const regionId =
        rooms.get(id)?.regionId ??
        (source === "HubRoomData" ? "Home" : id.split("_")[0]);
      if (
        regionId !== undefined &&
        dataset.domains.guide.regions.some((region) => region.id === regionId)
      ) {
        output.push(reference("world-progression/region", regionId));
      }
      continue;
    }
    if (source === "ConsumableData") {
      const rewardId = id.endsWith("Drop") && runRewardIds.has(id) ? id : null;
      if (rewardId !== null)
        output.push(reference("mechanics/run-reward", rewardId));
      continue;
    }
    if (entry.startsWith("market:")) {
      const offerId = entry.slice("market:".length);
      const offer = marketOffers.get(offerId);
      if (
        offer?.costs.some((cost) => cost.resourceId.startsWith("Fish")) === true
      )
        continue;
    }
    output.push(publicLocator(entry, dataset));
  }
  return uniqueJson(output);
}

function conditionNameLookup(
  dataset: CombinedDataset,
): ReadonlyMap<string, string> {
  const names = new Map<string, string>();
  const remember = (id: string, name: string | null | undefined): void => {
    if (name !== null && name !== undefined && name.trim() !== "")
      names.set(id, publicText(name));
  };
  dataset.domains.boons.gods.forEach((record) =>
    remember(record.id, record.name),
  );
  dataset.domains.boons.boons.forEach((record) =>
    remember(record.id, record.name),
  );
  dataset.domains.arcana.cards.forEach((record) =>
    remember(record.id, record.name),
  );
  dataset.domains.weapons.weapons.forEach((record) =>
    remember(record.id, record.name),
  );
  dataset.domains.weapons.aspects.forEach((record) =>
    remember(record.id, record.name),
  );
  dataset.domains.weapons.hammers.forEach((record) =>
    remember(record.id, record.name),
  );
  dataset.domains.loadouts.keepsakes.forEach((record) =>
    remember(record.id, record.displayName),
  );
  dataset.domains.loadouts.familiars.forEach((record) =>
    remember(record.id, record.displayName),
  );
  dataset.domains.loadouts.hexes.forEach((record) => {
    remember(record.id, record.displayName);
    remember(record.traitId, record.displayName);
    record.talents.forEach((talent) => remember(talent.id, talent.displayName));
  });
  dataset.domains.loadouts.incantations.forEach((record) =>
    remember(record.id, record.displayName),
  );
  for (const records of [
    dataset.domains.guide.rooms,
    dataset.domains.guide.encounters,
    dataset.domains.guide.enemies,
    dataset.domains.guide.rewards,
    dataset.domains.guide.consumables,
    dataset.domains.guide.resources,
    dataset.domains.guide.statusElements,
    dataset.domains.guide.oathConditions,
    dataset.domains.guide.bounties,
    dataset.domains.guide.relationships,
    dataset.domains.guide.prophecies,
    dataset.domains.guide.narrative,
    dataset.domains.guide.outros,
    dataset.domains.guide.achievements,
    dataset.domains.guide.namedRequirements,
  ]) {
    records.forEach((record) => remember(record.id, record.displayName));
  }
  dataset.domains.guide.regions.forEach((record) =>
    remember(record.id, record.displayName),
  );
  dataset.domains.guide.encounterFriends.forEach((record) =>
    remember(record.id, record.displayName),
  );
  dataset.domains.guide.encounterAids.forEach((record) =>
    remember(record.id, record.displayName),
  );
  dataset.domains.guide.gatheringTools.forEach((record) =>
    remember(record.id, record.displayName),
  );
  dataset.domains.guide.resources.forEach((record) =>
    remember(record.id, record.displayName),
  );
  return names;
}

function prophecyCompletionRequirements(value: unknown): readonly unknown[] {
  const input = object(value);
  const requirements: unknown[] = [input.CompleteGameStateRequirements];
  for (const setup of array(input.SetupEvents)) {
    const arguments_ = object(object(setup).Args);
    if (arguments_.CompleteGameStateRequirements !== undefined) {
      requirements.push(arguments_.CompleteGameStateRequirements);
    }
  }
  return requirements.filter((requirement) => requirement !== undefined);
}

function runRewardDescription(
  reward: CombinedDataset["domains"]["guide"]["runRewards"][number],
  dataset: CombinedDataset,
): string {
  const amount = reward.amount === null ? "" : String(reward.amount);
  switch (reward.effectKind) {
    case "boon-choice":
      return "Choose one offered Olympian boon for the current night.";
    case "two-god-boon-choice":
      return "Choose one boon from two rival Olympians after resolving their dispute.";
    case "hermes-boon-choice":
      return "Choose one offered boon from Hermes for the current night.";
    case "maximum-health":
      return `Gain ${amount} maximum Life for the current night.`;
    case "maximum-magick":
      return `Gain ${amount} maximum Magick for the current night.`;
    case "gold":
      return `Gain ${amount} Gold for the current night.`;
    case "hex-choice":
      return "Choose one offered Hex from Selene for the current night.";
    case "boon-level":
      return "Raise one eligible boon by one level for the current night.";
    case "path-upgrades":
      return `Gain at least ${amount} upgrades for the Path of Stars of your current Hex.`;
    case "hammer-choice":
      return "Choose one Daedalus enchantment for your current Nocturnal Arm.";
    case "resource": {
      const resource = dataset.domains.guide.resources.find(
        (entry) => entry.id === reward.resourceId,
      )?.displayName;
      if (resource === undefined)
        throw new Error(`Run reward ${reward.id} has no public resource name.`);
      return publicText(
        reward.description ?? `Gain ${amount} ${resource} permanently.`,
      );
    }
  }
}

function sourceSubjects(
  dataset: CombinedDataset,
  editorial: EditorialDataset,
): readonly Subject[] {
  const subjects: Subject[] = [];
  const conditionNames = conditionNameLookup(dataset);
  const regionNames = new Map(
    dataset.domains.guide.regions.map(
      (region) => [region.id, region.displayName] as const,
    ),
  );
  const add = (
    recordType: string,
    id: string,
    officialName: string | null | undefined,
    values: Readonly<Record<string, unknown>>,
    publicNameOverride?: string | null,
  ): void => {
    const override = PUBLIC_NAME_OVERRIDES[key(recordType, id)];
    const explicitName =
      override ??
      (officialName === null || officialName === undefined
        ? ""
        : publicText(officialName));
    subjects.push({
      recordType,
      id,
      officialName: explicitName || id,
      publicName:
        publicNameOverride === undefined
          ? explicitName || null
          : publicNameOverride,
      values,
    });
  };
  for (const card of dataset.domains.arcana.cards) {
    add("mechanics/arcana-card", card.id, card.name, {
      name: card.name,
      description:
        ARCANA_DESCRIPTION_OVERRIDES[card.id] ??
        publicDescription(card.description, card.rankEffects, card.mechanics),
      "grasp-cost": card.graspCost,
      "rank-costs-effects": {
        ranks: card.ranks.map((rank) => ({
          ...rank,
          upgradeFromPreviousCosts: costs(rank.upgradeFromPreviousCosts),
        })),
        rankEffects: card.rankEffects,
        unlockCosts: costs(card.unlockCosts),
      },
      "unlock-requirements": publicRequirements(
        {
          unlock: card.unlock,
          autoActivationRequirements: card.autoActivationRequirements,
        },
        conditionNames,
      ),
    });
  }
  add("mechanics/grasp-progression", "Grasp", "Grasp", {
    "name-description": {
      displayName: dataset.domains.arcana.grasp.displayName,
      description:
        "Increase your Grasp capacity so you can activate Arcana Cards with a higher combined Grasp cost.",
    },
    "starting-capacity": pick(dataset.domains.arcana.grasp, [
      "startingCapacity",
      "initialValue",
    ]),
    "upgrade-series": dataset.domains.arcana.grasp.levels.map((level) => ({
      ...level,
      costs: costs(level.costs),
    })),
  });
  const godAppearances = new Map(
    dataset.domains.guide.godAppearances.map((appearance) => [
      appearance.godId,
      appearance,
    ]),
  );
  const openingGods = new Map(
    dataset.domains.guide.openingStates.map((opening) => [
      opening.godId,
      opening,
    ]),
  );
  for (const god of dataset.domains.boons.gods) {
    const appearance = godAppearances.get(god.name);
    const opening = openingGods.get(god.name);
    const availability =
      appearance !== undefined
        ? {
            kind: appearance.appearanceKind,
            rules: readableGodAppearance(appearance),
            firstGuaranteeRooms: appearance.forcedRoomIds.map((id) => ({
              kind: "room",
              id,
            })),
          }
        : opening !== undefined
          ? {
              kind: "first-night-guarantee",
              rules: [
                `${god.name} is guaranteed in the first combat room of the first night, with a Common-rarity choice from the fixed opening boon pool.`,
              ],
              firstGuaranteeRooms: [{ kind: "room", id: opening.roomId }],
            }
          : {
              kind: "standard-pool",
              rules: [
                `${god.name} can appear through the normal Olympian Boon pool without a special progression unlock.`,
              ],
              firstGuaranteeRooms: [],
            };
    add("mechanics/god", god.id, god.name, {
      name: god.name,
      boons: god.boonIds.map((id) => reference("mechanics/boon", id)),
      availability,
    });
  }
  const boonAffinity = new Map<
    string,
    { aspect: EditorialReference; rating: string }[]
  >();
  for (const guide of editorial.aspectGuides) {
    for (const ranking of guide.boonRankings.filter(
      (entry) => entry.rating === "S" || entry.rating === "A",
    )) {
      const entries = boonAffinity.get(ranking.reference.id) ?? [];
      entries.push({ aspect: guide.aspectReference, rating: ranking.rating });
      boonAffinity.set(ranking.reference.id, entries);
    }
  }
  const boonIds = new Set(dataset.domains.boons.boons.map((boon) => boon.id));
  for (const boon of dataset.domains.boons.boons) {
    const prerequisiteBoons = identifiersIn(boon.prerequisites)
      .filter((id) => boonIds.has(id))
      .map((id) => reference("mechanics/boon", id));
    add("mechanics/boon", boon.id, boon.name, {
      name: boon.name,
      description: boonDescription(
        boon.id,
        boon.description,
        boon.levelScaling,
        boon.effects,
      ),
      god: boon.godIds.map((id) => reference("mechanics/god", id)),
      kind: boon.kind,
      effects: boon.effects,
      "rarity-scaling": boon.rarityBehavior,
      elements: boon.elements,
      "level-scaling": boon.levelScaling,
      prerequisites: {
        ...publicRequirements(boon.prerequisites, conditionNames),
        boons: prerequisiteBoons,
        choiceGroups: prerequisiteChoiceGroups(boon.prerequisites, boonIds),
      },
      "weapon-affinity": (boonAffinity.get(boon.id) ?? []).sort((left, right) =>
        compareStrings(left.aspect.id, right.aspect.id),
      ),
    });
  }
  for (const weapon of dataset.domains.weapons.weapons) {
    add("mechanics/weapon", weapon.id, weapon.name, {
      "name-description": {
        name: weapon.name,
        description: publicText(weapon.description),
      },
      aspects: dataset.domains.weapons.aspects
        .filter((aspect) => aspect.weaponId === weapon.id)
        .map((aspect) => reference("mechanics/weapon-aspect", aspect.id)),
      "unlock-costs": costs(weapon.unlockCosts),
      "unlock-requirements": publicRequirements(
        weapon.unlockRequirements,
        conditionNames,
      ),
    });
  }
  for (const aspect of dataset.domains.weapons.aspects) {
    add("mechanics/weapon-aspect", aspect.id, aspect.name, {
      name: aspect.name,
      description:
        ASPECT_DESCRIPTION_OVERRIDES[aspect.id] ??
        publicDescription(
          aspect.description,
          aspect.rankEffects,
          aspect.mechanics,
        ),
      weapon: reference("mechanics/weapon", aspect.weaponId),
      "rank-costs": aspect.ranks.map((rank) => ({
        ...rank,
        costs: costs(rank.costs),
      })),
      "rank-effects": aspect.rankEffects,
      "unlock-requirements": publicRequirements(
        rawPick(aspect.mechanics, [
          "GameStateRequirements",
          "UnlockGameStateRequirements",
          "Requirements",
        ]),
        conditionNames,
      ),
      "attack-pattern": pick(aspect.mechanics, [
        "AddOutgoingCritModifiers",
        "AddOutgoingDamageModifiers",
        "AddOutgoingLifestealModifiers",
        "CastFlatFuseModifier",
        "Charge",
        "DaggerAdditionalTargetData",
        "ExpandedProperties",
        "LinkedSpell",
        "ManaCostModifiers",
        "ManaSpendCostModifiers",
        "NumHits",
        "PerfectCritChance",
        "PreEquipWeapons",
        "PropertyChanges",
        "RequiredWeapon",
        "ScaledStageEffects",
        "SkipAutoLobMagnetism",
        "SprintStrikeDamageMultiplier",
        "UnlimitedAmmo",
        "WeaponDataOverride",
        "WeaponSpeedMultiplier",
      ]),
    });
  }
  for (const hammer of dataset.domains.weapons.hammers) {
    add("mechanics/hammer-upgrade", hammer.id, hammer.name, {
      name: hammer.name,
      description: hammerDescription(
        hammer.id,
        hammer.description,
        hammer.effects,
        hammer.mechanics,
      ),
      effects: hammer.effects,
      compatibility: {
        weapon: reference("mechanics/weapon", hammer.weaponId),
        allowedAspects: hammer.compatibility.allowedAspectIds.map((id) =>
          reference("mechanics/weapon-aspect", id),
        ),
        excludedAspects: hammer.compatibility.excludedAspectIds.map((id) =>
          reference("mechanics/weapon-aspect", id),
        ),
        requiredAspects: hammer.compatibility.requiredAspectIds.map((id) =>
          reference("mechanics/weapon-aspect", id),
        ),
        incompatibleHammers: hammer.compatibility.incompatibleHammerIds.map(
          (id) => reference("mechanics/hammer-upgrade", id),
        ),
      },
    });
  }
  const keepsakeEditorial = new Map(
    editorial.keepsakePriorities.map((entry) => [entry.id, entry]),
  );
  for (const keepsake of dataset.domains.loadouts.keepsakes) {
    const guidance = keepsakeEditorial.get(keepsake.id);
    add("mechanics/keepsake", keepsake.id, keepsake.displayName, {
      name: keepsake.displayName,
      description: keepsakeDescription(
        keepsake.id,
        keepsake.description,
        keepsake.rankEffects,
        keepsake.mechanics,
      ),
      acquisition: {
        relationship:
          keepsake.relationshipId === null
            ? null
            : reference(
                "world-progression/relationship",
                keepsake.relationshipId,
              ),
        requirements: publicRequirements(
          keepsake.acquisitionRequirements,
          conditionNames,
        ),
      },
      "rank-effects": {
        naturalRanks: keepsake.naturalRanks,
        rankEffects: keepsake.rankEffects,
        chamberThresholds: keepsake.chamberThresholds,
      },
      "leveling-priority":
        guidance === undefined
          ? null
          : {
              priority: guidance.priority,
              lifecycle: guidance.lifecycle,
              recommendation: guidance.recommendation,
              reason: guidance.reason,
              limitation: guidance.limitation,
              switchWhenInactive: guidance.switchWhenInactive,
              fallback: guidance.fallback,
            },
    });
  }
  for (const familiar of dataset.domains.loadouts.familiars) {
    const recruitmentRules =
      familiar.id === "RavenFamiliar"
        ? [
            "Find Raki in the Erebus fountain room twice. The first meeting records the bond interaction.",
            "Return on a later visit with at least 1 Witch's Delight and offer it to recruit Raki.",
          ]
        : null;
    add("mechanics/familiar", familiar.id, familiar.displayName, {
      name: familiar.displayName,
      "unlock-requirements":
        recruitmentRules === null
          ? publicRequirements(familiar.unlockRequirements, conditionNames)
          : { rules: recruitmentRules },
      "abilities-upgrades": {
        description: publicText(familiar.description),
        upgrades: familiar.upgrades.map((upgrade) => ({
          name: upgrade.displayName,
          ranks: upgrade.ranks.map((rank) => ({
            rank: rank.rank,
            description: publicDescription(
              upgrade.description,
              upgrade.rankEffects.filter(
                (effect) => effect.level === rank.rank,
              ),
              upgrade.mechanics,
            ),
            costs: costs(rank.costs),
          })),
        })),
      },
    });
  }
  for (const hex of dataset.domains.loadouts.hexes) {
    add("mechanics/hex", hex.id, hex.displayName, {
      name: hex.displayName,
      "base-effect": {
        description: publicDescription(
          hex.description,
          hex.baseEffects,
          hex.mechanics,
        ),
        effects: hex.baseEffects,
        availabilityRequirements: publicRequirements(
          hex.availabilityRequirements,
          conditionNames,
        ),
      },
      "path-upgrades": hex.talents.map((talent) => ({
        name: talent.displayName,
        category: talent.category,
        description:
          talent.id === "RolloverUsesTalent"
            ? "Using a Fountain restores 3 uses of your Hex, even when uses remain."
            : publicDescription(
                talent.description,
                talent.effects,
                talent.mechanics,
              ),
      })),
    });
  }
  const resourceNames = new Map(
    dataset.domains.guide.resources.flatMap((resource) =>
      resource.displayName === null
        ? []
        : [[resource.id, resource.displayName] as const],
    ),
  );
  for (const incantation of dataset.domains.loadouts.incantations) {
    const requirements = publicRequirements(
      incantation.unlockRequirements,
      conditionNames,
    );
    const unlockRules = stringRules(requirements.rules);
    const revealCategory =
      dataset.domains.loadouts.incantationRevealPolicy.categories.find(
        (category) => category.orderedIncantationIds.includes(incantation.id),
      );
    const hasDelayedReveal =
      revealCategory?.oneRevealPassPerRun === true &&
      incantation.effects.AlwaysRevealImmediately !== true &&
      !incantation.automaticUnlock;
    add("mechanics/incantation", incantation.id, incantation.displayName, {
      name: incantation.displayName,
      availability: hasDelayedReveal
        ? {
            rules: [
              `The Cauldron reveals at most ${dataset.domains.loadouts.incantationRevealPolicy.maxNewRevealsPerRun} new Incantations from this category each night.`,
              "Earlier eligible Incantations in the fixed Cauldron order can delay this one. They do not need to be completed.",
            ],
          }
        : null,
      "unlock-requirements": {
        ...requirements,
        rules:
          unlockRules.length > 0
            ? unlockRules
            : ["Available with the first Cauldron recipes."],
      },
      costs: costs(incantation.costs),
      effects: incantationEffect(
        incantation.id,
        incantation.description,
        incantation.automaticUnlock,
        incantation.effects,
        resourceNames,
      ),
    });
  }
  for (const tool of dataset.domains.guide.gatheringTools) {
    const unlockRules = readableStaticConditions(
      tool.unlockConditions,
      conditionNames,
    );
    const description =
      tool.elementYield === null
        ? publicText(tool.description)
        : `${keywordLabel(tool.description.match(/\{\$Keywords\.([^}]+)\}/u)?.[1] ?? "ToolPlural")} have a ${String(tool.elementYield.chance * 100)}% chance to yield +1 ${conditionNames.get(tool.elementYield.elementId) ?? tool.elementYield.elementId}, once per night.`;
    add("mechanics/gathering-tool", tool.id, tool.displayName, {
      "name-description": { name: tool.displayName, description },
      "level-costs": {
        level: tool.level,
        baseTool: tool.baseToolId,
        costs: costs(tool.costs),
      },
      "unlock-requirements": {
        rules:
          unlockRules.length > 0
            ? unlockRules
            : [
                "Available after Night's Craftwork opens the gathering-tool shop.",
              ],
      },
      "gathering-effect":
        tool.elementYield === null
          ? null
          : {
              element: reference(
                "mechanics/status-element",
                tool.elementYield.elementId,
              ),
              chance: tool.elementYield.chance,
            },
    });
  }
  for (const fish of dataset.domains.guide.fish) {
    const fishName = resourceNames.get(fish.resourceId);
    if (fishName === undefined) continue;
    add("mechanics/fish", fish.id, fishName, {
      "catch-location": {
        region: reference("world-progression/region", fish.regionId),
        rarity: fish.rarity,
        rules: fish.catchRules.map((rule) => ({
          weight: rule.weight,
          requirements: readableStaticConditions(
            rule.conditions,
            conditionNames,
          ),
        })),
      },
      sale: {
        amount: fish.sellValue,
        currency: reference("mechanics/resource", fish.sellCurrencyId),
      },
    });
  }
  for (const reward of dataset.domains.guide.runRewards) {
    const availabilityRules = readableStaticConditions(
      reward.availability,
      conditionNames,
    );
    add("mechanics/run-reward", reward.id, publicText(reward.displayName), {
      "name-description": {
        name: publicText(reward.displayName),
        description: runRewardDescription(reward, dataset),
      },
      effect: {
        kind: reward.effectKind,
        amount: reward.amount,
        resource:
          reward.resourceId === null
            ? null
            : reference("mechanics/resource", reward.resourceId),
        duration: [
          "maximum-health",
          "maximum-magick",
          "gold",
          "boon-level",
          "path-upgrades",
          "hammer-choice",
          "boon-choice",
          "hermes-boon-choice",
          "two-god-boon-choice",
          "hex-choice",
        ].includes(reward.effectKind)
          ? "current-night"
          : "permanent",
      },
      availability:
        availabilityRules.length === 0 ? null : { rules: availabilityRules },
      selection: reward.selectionSources,
    });
  }
  for (const cultivation of dataset.domains.guide.cultivation) {
    const seedName = resourceNames.get(cultivation.seedResourceId);
    if (seedName === undefined) continue;
    add("mechanics/cultivation", cultivation.id, `${seedName} cultivation`, {
      "seed-output": {
        seed: reference("mechanics/resource", cultivation.seedResourceId),
        output: reference("mechanics/resource", cultivation.outputResourceId),
        amount: cultivation.outputAmount,
        bonusSeed:
          cultivation.bonusSeedResourceId === null
            ? null
            : reference("mechanics/resource", cultivation.bonusSeedResourceId),
      },
      growth: {
        growTimeMin: cultivation.growTimeMin,
        growTimeMax: cultivation.growTimeMax,
        weight: cultivation.weight,
        rules: readableStaticConditions(cultivation.conditions, conditionNames),
        gardenPlotCount: dataset.domains.guide.gardenPlotCount,
      },
    });
  }
  for (const offer of dataset.domains.guide.marketOffers) {
    const outputName = resourceNames.get(offer.outputResourceId);
    if (outputName === undefined) continue;
    const category = PUBLIC_MARKET_CATEGORIES[offer.categoryId];
    if (category === undefined)
      throw new Error(`Market offer ${offer.id} has no public category label.`);
    const availabilityRules = readableStaticConditions(
      offer.availability,
      conditionNames,
    );
    add("mechanics/market-offer", offer.id, `${outputName} exchange`, {
      exchange: {
        receive: {
          resource: reference("mechanics/resource", offer.outputResourceId),
          amount: offer.outputAmount,
        },
        costs: costs(offer.costs),
      },
      availability: {
        category,
        refreshOncePerRun: offer.refreshOncePerRun,
        rules:
          availabilityRules.length > 0
            ? availabilityRules
            : [
                "Available in the standard Wretched Broker exchange list once the Broker is summoned.",
              ],
      },
    });
  }
  for (const opening of dataset.domains.guide.openingStates) {
    add("world-progression/opening-state", opening.id, "First night opening", {
      "room-encounter": {
        room: { kind: "room", id: opening.roomId },
        encounter: reference(
          "world-progression/encounter",
          opening.encounterId,
        ),
      },
      "forced-boon-choice": {
        reward: opening.rewardKind,
        god: reference("mechanics/god", `${opening.godId}Upgrade`),
        boons: opening.boonIds.map((id) => reference("mechanics/boon", id)),
        rarity: opening.forcedCommonRarity ? "Common" : "normal rarity rules",
      },
    });
  }
  const buildActions = new Set([
    "attack",
    "special",
    "cast",
    "omega",
    "sprint",
  ]);
  const actionSlotsForAid = (
    aid: (typeof dataset.domains.guide.encounterAids)[number],
  ): readonly string[] =>
    [...aid.buildTags.filter((tag) => buildActions.has(tag))].filter(
      (tag, index, values) => values.indexOf(tag) === index,
    );
  const relevantAspectsForAid = (
    aid: (typeof dataset.domains.guide.encounterAids)[number],
  ): readonly EditorialReference[] => {
    const actionSlots = new Set(actionSlotsForAid(aid));
    if (actionSlots.size === 0) return [];
    return editorial.aspectGuides
      .filter((guide) =>
        guide.boonPriorities.some(
          (priority) =>
            priority.role === "core" && actionSlots.has(priority.slot),
        ),
      )
      .map((guide) => guide.aspectReference)
      .sort((left, right) => compareStrings(left.id, right.id));
  };
  const encounterAidEffects = new Map(
    dataset.domains.guide.encounterAidEffects.map((effect) => [
      effect.id,
      effect,
    ]),
  );
  for (const aid of dataset.domains.guide.encounterAids) {
    const actionTags = actionSlotsForAid(aid);
    const availabilityRules = readableStaticConditions(
      aid.availability,
      conditionNames,
    );
    const providerName =
      conditionNames.get(aid.providerId) ??
      missingPublicToken("encounter-friend", aid.providerId);
    const relevantAspects = relevantAspectsForAid(aid);
    const effectData = object(encounterAidEffects.get(aid.id)?.data);
    add("mechanics/encounter-aid", aid.id, aid.displayName, {
      "name-description": {
        name: publicText(aid.displayName),
        description: encounterAidDescription(
          aid.id,
          aid.description,
          effectData,
        ),
        processedEffects: pick(effectData, ["samples"]),
      },
      provider: reference("world-progression/encounter-friend", aid.providerId),
      availability: {
        rules:
          availabilityRules.length > 0
            ? availabilityRules
            : [`Always eligible when ${providerName} offers a choice.`],
      },
      "build-affinity": {
        scope: actionTags.length > 0 ? "action-linked" : "general-run-option",
        actionTags,
        tags: aid.buildTags,
        relevantAspects,
        interpretation:
          actionTags.length > 0
            ? "These aspect guides use at least one affected action as part of their core combat loop. This is a mechanical relationship, not an automatic pick priority."
            : "This aid changes survivability, resources, progression, or another run-wide system rather than a specific aspect action.",
      },
    });
  }
  for (const friend of dataset.domains.guide.encounterFriends) {
    add("world-progression/encounter-friend", friend.id, friend.displayName, {
      name: friend.displayName,
      appearance: {
        locations: friend.appearances.map((appearance) => ({
          region: reference("world-progression/region", appearance.regionId),
          encounter: reference(
            "world-progression/encounter",
            appearance.encounterId,
          ),
          rules: readableStaticConditions(
            appearance.appearanceConditions,
            conditionNames,
          ),
        })),
        maxAppearancesPerBiome: friend.maxAppearancesPerBiome,
        rules: readableFriendAppearance(friend),
      },
      aid: friend.aidIds.map((id) => reference("mechanics/encounter-aid", id)),
    });
  }
  for (const curse of dataset.domains.guide.strifeCurses) {
    add("world-progression/strife-curse", curse.id, curse.displayName, {
      "name-description": {
        name: publicText(curse.displayName),
        description: `Enemies deal ${String(curse.baseEnemyDamagePercent)}% more damage when Eris applies the curse. The increase rises by ${String(curse.perEncounterEnemyDamagePercent)} percentage points after each encounter, up to ${String(curse.maximumEnemyDamagePercent)}%, and lasts until the night ends.`,
      },
      effect: {
        initialEnemyDamageIncreasePercent: curse.baseEnemyDamagePercent,
        additionalEnemyDamagePerEncounterPercent:
          curse.perEncounterEnemyDamagePercent,
        maximumEncounterAdditions: curse.maximumEncounterAdditions,
        maximumEnemyDamageIncreasePercent: curse.maximumEnemyDamagePercent,
        duration: "Until the current night ends.",
      },
      appearance: {
        rules: [
          ...curse.stages.map((stage) => {
            const region = regionNames.get(stage.regionId);
            const resource = resourceNames.get(stage.compensation.resourceId);
            if (region === undefined || resource === undefined) {
              throw new Error(
                `Blessing of Strife stage has no public region or resource name: ${stage.regionId}/${stage.compensation.resourceId}`,
              );
            }
            return `Eris waits in the opening chamber of ${region} while the save has no more than ${String(stage.maximumCompletedNights)} completed nights. Accepting the curse also grants ${String(stage.compensation.amount)} ${resource}.`;
          }),
          `Eris does not apply the curse when Melinoe has no Death Defiance and is at or below ${String(curse.criticalHealthSuppression.maximumHealthFraction * 100)}% Life.`,
        ],
      },
    });
  }
  for (const penalty of dataset.domains.guide.surfacePenalties) {
    add("world-progression/surface-penalty", penalty.id, "Chthonic Fate", {
      effect: {
        startingSelfDamage: penalty.startingDamage,
        intervalSeconds: penalty.intervalSeconds,
        additionalDamagePerTick: penalty.damageIncreasePerTick,
      },
      activation: {
        encounter: reference(
          "world-progression/encounter",
          penalty.activationEncounterId,
        ),
        rule: "Applied during the first Surface combat until its cure has been completed.",
      },
      removal: {
        incantation: reference(
          "mechanics/incantation",
          penalty.cureIncantationId,
        ),
        rule: "Complete Unraveling a Fateful Bond to survive on the Surface without escalating self-damage.",
      },
    });
  }
  for (const status of dataset.domains.guide.statusElements) {
    const name = status.displayName;
    if (name === null) continue;
    const statusData = object(status.data);
    const behavior = {
      description: statusDescription(
        status.id,
        status.description ?? `${name} status effect.`,
        statusData,
      ),
      mechanics: pick(status.data, [
        "Duration",
        "Multiplier",
        "Name",
        "Stacks",
        "Threshold",
      ]),
    };
    add("mechanics/status-element", status.id, name, { name, behavior });
    add("mechanics/combat-mechanic", status.id, name, { name, behavior });
  }
  const resourceEditorial = new Map(
    editorial.resourceAdvice.map((entry) => [entry.id, entry]),
  );
  const crossDomainResourceUses = new Map<string, EditorialReference[]>();
  const addResourceUse = (
    resourceId: string,
    target: EditorialReference,
  ): void => {
    const values = crossDomainResourceUses.get(resourceId) ?? [];
    if (
      !values.some(
        (value) =>
          value.recordType === target.recordType && value.id === target.id,
      )
    )
      values.push(target);
    crossDomainResourceUses.set(resourceId, values);
  };
  for (const incantation of dataset.domains.loadouts.incantations) {
    incantation.costs.forEach((cost) =>
      addResourceUse(
        cost.resourceId,
        reference("mechanics/incantation", incantation.id),
      ),
    );
  }
  for (const aspect of dataset.domains.weapons.aspects) {
    aspect.ranks
      .flatMap((rank) => rank.costs)
      .forEach((cost) =>
        addResourceUse(
          cost.resourceId,
          reference("mechanics/weapon-aspect", aspect.id),
        ),
      );
  }
  for (const card of dataset.domains.arcana.cards) {
    card.unlockCosts.forEach((cost) =>
      addResourceUse(
        cost.resourceId,
        reference("mechanics/arcana-card", card.id),
      ),
    );
    card.ranks
      .flatMap((rank) => rank.upgradeFromPreviousCosts)
      .forEach((cost) =>
        addResourceUse(
          cost.resourceId,
          reference("mechanics/arcana-card", card.id),
        ),
      );
  }
  for (const level of dataset.domains.arcana.grasp.levels) {
    level.costs.forEach((cost) =>
      addResourceUse(
        cost.resourceId,
        reference("mechanics/grasp-progression", "Grasp"),
      ),
    );
  }
  for (const weapon of dataset.domains.weapons.weapons) {
    weapon.unlockCosts.forEach((cost) =>
      addResourceUse(cost.resourceId, reference("mechanics/weapon", weapon.id)),
    );
  }
  for (const familiar of dataset.domains.loadouts.familiars) {
    familiar.upgrades
      .flatMap((upgrade) => upgrade.ranks)
      .flatMap((rank) => rank.costs)
      .forEach((cost) =>
        addResourceUse(
          cost.resourceId,
          reference("mechanics/familiar", familiar.id),
        ),
      );
  }
  for (const resource of dataset.domains.guide.resources) {
    const guidance = resourceEditorial.get(resource.id);
    add("mechanics/resource", resource.id, resource.displayName, {
      name: resource.displayName,
      "acquisition-locations": resourceAcquisitionLocations(
        resource.acquisitionReferences,
        dataset,
      ),
      uses: uniqueJson([
        ...resource.useReferences.map((entry) => publicLocator(entry, dataset)),
        ...(crossDomainResourceUses.get(resource.id) ?? []),
        ...(guidance?.recommendedUseReferences ?? []),
      ]),
      "reservation-advice":
        guidance === undefined
          ? null
          : {
              policy: guidance.policy,
              priority: guidance.priority,
              earliestRecommendedStage: guidance.earliestRecommendedStage,
              recommendedUses: guidance.recommendedUseReferences,
              recommendation: guidance.recommendation,
              reason: guidance.reason,
              limitation: guidance.limitation,
              fallback: guidance.fallback,
            },
    });
  }
  const routeRegions = new Map<
    string,
    readonly (typeof dataset.domains.guide.regions)[number][]
  >();
  for (const routeId of ["underworld", "surface"] as const) {
    routeRegions.set(
      routeId,
      dataset.domains.guide.regions
        .filter((region) => region.routeId === routeId)
        .toSorted(
          (left, right) => (left.routeOrder ?? 0) - (right.routeOrder ?? 0),
        ),
    );
  }
  for (const region of dataset.domains.guide.regions) {
    const encounterIds = dataset.domains.guide.encounters
      .filter((entry) => entry.regionIds.includes(region.id))
      .map((entry) => entry.id);
    const route =
      region.routeId === null ? [] : (routeRegions.get(region.routeId) ?? []);
    const routeIndex = route.findIndex((entry) => entry.id === region.id);
    const previousRegion = routeIndex > 0 ? route[routeIndex - 1] : undefined;
    const unlockRequirements =
      region.id === "F"
        ? {
            kind: "starting-region",
            rules: [
              "Erebus is the first region of every new Underworld night.",
            ],
          }
        : region.id === "N"
          ? {
              kind: "incantation",
              incantation: reference(
                "mechanics/incantation",
                "WorldUpgradeAltRunDoor",
              ),
              rules: [
                "Complete Permeation of Witching-Wards to open the warded Surface route.",
              ],
            }
          : previousRegion === undefined
            ? null
            : {
                kind: "route-progression",
                previousRegion: reference(
                  "world-progression/region",
                  previousRegion.id,
                ),
                rules: [
                  `Defeat the Guardian of ${previousRegion.displayName} to continue to ${region.displayName}.`,
                ],
              };
    add("world-progression/region", region.id, region.displayName, {
      name: region.displayName,
      route:
        region.routeId === null
          ? null
          : { id: region.routeId, order: region.routeOrder },
      encounters: encounterIds.map((id) =>
        reference("world-progression/encounter", id),
      ),
      "unlock-requirements": unlockRequirements,
    });
  }
  const enemyGroups = new Map<
    string,
    CombinedDataset["domains"]["guide"]["enemies"][number][]
  >();
  const encounterFriendNames = new Set(
    dataset.domains.guide.encounterFriends.flatMap((friend) =>
      friend.displayName === null ? [] : [publicText(friend.displayName)],
    ),
  );
  for (const enemy of dataset.domains.guide.enemies) {
    if (
      enemy.displayName === null ||
      enemy.classifications.length === 0 ||
      enemy.regionIds.length === 0
    )
      continue;
    const publicName = publicText(enemy.displayName);
    if (publicName === "" || encounterFriendNames.has(publicName)) continue;
    const group = enemyGroups.get(publicName) ?? [];
    group.push(enemy);
    enemyGroups.set(publicName, group);
  }
  const publicEnemyIdBySourceId = new Map<string, string>();
  for (const group of enemyGroups.values()) {
    const canonical = [...group]
      .filter((enemy) => {
        const data = object(enemy.data);
        return (
          typeof data.MaxHealth === "number" ||
          array(data.WeaponOptions).length > 0
        );
      })
      .sort(
        (left, right) =>
          enemyPriority(right) - enemyPriority(left) ||
          compareStrings(left.id, right.id),
      )[0];
    if (canonical === undefined) continue;
    for (const enemy of group) {
      publicEnemyIdBySourceId.set(enemy.id, canonical.id);
    }
  }
  const publicEnemyIds = new Set(publicEnemyIdBySourceId.values());
  for (const encounter of dataset.domains.guide.encounters) {
    const enemyIds = [
      ...new Set(
        encounter.enemyIds.flatMap((id) => {
          const publicId = publicEnemyIdBySourceId.get(id);
          return publicId === undefined ? [] : [publicId];
        }),
      ),
    ];
    add("world-progression/encounter", encounter.id, encounter.displayName, {
      name: encounter.displayName,
      region: encounter.regionIds.map((id) =>
        reference("world-progression/region", id),
      ),
      enemies: enemyIds.map((id) => reference("world-progression/enemy", id)),
      rewards: encounter.rewardIds,
      classification: encounter.classification,
    });
  }
  for (const enemy of dataset.domains.guide.enemies) {
    const data = object(enemy.data);
    const publicName = publicEnemyIds.has(enemy.id)
      ? (PUBLIC_NAME_OVERRIDES[key("world-progression/enemy", enemy.id)] ??
        publicText(enemy.displayName ?? ""))
      : null;
    const combatEncounters = dataset.domains.guide.encounters.filter(
      (encounter) =>
        encounter.enemyIds.some(
          (id) => publicEnemyIdBySourceId.get(id) === enemy.id,
        ) && encounter.classification !== "noncombat",
    );
    const namedGuardianEncounters = enemy.classifications.includes("guardian")
      ? combatEncounters.filter(
          (encounter) =>
            encounter.classification === "guardian" &&
            encounter.displayName !== null &&
            publicName !== null &&
            publicText(encounter.displayName).includes(publicName),
        )
      : [];
    const publicRegionIds = [
      ...new Set(
        (namedGuardianEncounters.length > 0
          ? namedGuardianEncounters
          : combatEncounters
        ).flatMap((encounter) => encounter.regionIds),
      ),
    ].sort(compareStrings);
    const attackPatterns = [
      ...new Set(
        array(data.WeaponOptions).flatMap((value) =>
          typeof value === "string" ? [enemyAttackLabel(enemy.id, value)] : [],
        ),
      ),
    ].sort(compareStrings);
    add(
      "world-progression/enemy",
      enemy.id,
      enemy.displayName,
      {
        name: publicName,
        stats: {
          "maximum-life": data.MaxHealth,
          "health-buffer": data.HealthBuffer,
          "maximum-hit-shields": data.MaxHitShields,
          speed: data.Speed,
        },
        "attacks-behavior": {
          "attack-patterns": attackPatterns,
          "aggression-range": data.AIAggroRange,
          "can-be-frozen": data.CanBeFrozen,
          "can-be-charmed":
            typeof data.BlockCharm === "boolean" ? !data.BlockCharm : undefined,
          "can-be-polymorphed":
            typeof data.BlockPolymorph === "boolean"
              ? !data.BlockPolymorph
              : undefined,
          "can-be-raised-from-the-dead":
            typeof data.BlockRaiseDead === "boolean"
              ? !data.BlockRaiseDead
              : undefined,
        },
        classification: {
          classifications: enemy.classifications,
          regions: publicRegionIds.map((id) =>
            reference("world-progression/region", id),
          ),
        },
      },
      publicName,
    );
  }
  for (const oath of dataset.domains.guide.oathConditions) {
    const oathData = object(oath.data);
    const ranks = array(oathData.Ranks).flatMap((value, index) => {
      const rank = object(value);
      return typeof rank.Points === "number"
        ? [
            {
              rank: index + 1,
              fear: rank.Points,
              effect: oathRankEffect(oath.id, value),
            },
          ]
        : [];
    });
    add("world-progression/oath-condition", oath.id, oath.displayName, {
      name: oath.displayName,
      description: oathDescription(oath.id),
      "rank-effects": { ranks },
      "unlock-requirements": publicRequirements(
        rawPick(oath.data, [
          "GameStateRequirements",
          "UnlockGameStateRequirements",
        ]),
        conditionNames,
      ),
    });
  }
  for (const bounty of dataset.domains.guide.bounties) {
    add("world-progression/testament-bounty", bounty.id, bounty.displayName, {
      "target-route": pick(bounty.data, ["Encounters", "Biome", "Route"]),
      requirements: publicRequirements(
        rawPick(bounty.data, [
          "CompleteGameStateRequirements",
          "UnlockGameStateRequirements",
        ]),
        conditionNames,
      ),
      rewards: pick(bounty.data, [
        "LootOptions",
        "RewardResourceAmount",
        "RewardResourceName",
      ]),
    });
  }
  for (const relationship of dataset.domains.guide.relationships) {
    const relationshipData = object(relationship.data);
    const maximumGifts =
      typeof relationshipData.Maximum === "number"
        ? relationshipData.Maximum
        : null;
    const lockedAfterGift =
      typeof relationshipData.Locked === "number"
        ? relationshipData.Locked
        : null;
    const firstGift = object(relationshipData["1"]).Gift;
    const firstGiftRequirements = publicRequirements(
      object(relationshipData["1"]).GameStateRequirements,
      conditionNames,
    );
    const finalBondRequirements = publicRequirements(
      relationshipData.MaxedRequirement,
      conditionNames,
    );
    const progressParts = [
      maximumGifts === null
        ? null
        : `${relationship.displayName} accepts up to ${String(maximumGifts)} gifts.`,
      lockedAfterGift === null
        ? null
        : `After gift ${String(lockedAfterGift)}, keep meeting ${relationship.displayName} and exhaust new dialogue until the next gift can be accepted.`,
    ].filter((part): part is string => part !== null);
    add(
      "world-progression/relationship",
      relationship.id,
      relationship.displayName,
      {
        character: relationship.displayName,
        ...(relationship.description === null
          ? {}
          : {
              "name-description": {
                name: relationship.displayName,
                description: publicText(relationship.description),
              },
            }),
        "gift-track": {
          maximumHearts: maximumGifts,
          eventLockAfterHearts: lockedAfterGift,
          firstGiftRequirements,
          bondForgedRequirements: finalBondRequirements,
          summary: progressParts.join(" "),
        },
        rewards:
          typeof firstGift === "string"
            ? reference("mechanics/keepsake", firstGift)
            : [],
      },
    );
  }
  for (const prophecy of dataset.domains.guide.prophecies) {
    const unlockRequirements = rawPick(prophecy.data, [
      "UnlockGameStateRequirements",
    ]);
    const completionRequirements = prophecyCompletionRequirements(
      prophecy.data,
    );
    const referenceByIdentifier = new Map<string, EditorialReference>();
    const rememberReference = (
      recordType: string,
      identifiers: readonly string[],
      id: string,
    ): void => {
      identifiers.forEach((identifier) =>
        referenceByIdentifier.set(identifier, reference(recordType, id)),
      );
    };
    dataset.domains.boons.boons.forEach((record) =>
      rememberReference("mechanics/boon", [record.id], record.id),
    );
    dataset.domains.weapons.aspects.forEach((record) =>
      rememberReference("mechanics/weapon-aspect", [record.id], record.id),
    );
    dataset.domains.weapons.hammers.forEach((record) =>
      rememberReference("mechanics/hammer-upgrade", [record.id], record.id),
    );
    dataset.domains.loadouts.keepsakes.forEach((record) =>
      rememberReference("mechanics/keepsake", [record.id], record.id),
    );
    dataset.domains.loadouts.familiars.forEach((record) =>
      rememberReference("mechanics/familiar", [record.id], record.id),
    );
    dataset.domains.loadouts.hexes.forEach((record) =>
      rememberReference(
        "mechanics/hex",
        [record.id, record.traitId],
        record.id,
      ),
    );
    dataset.domains.guide.encounterAids.forEach((record) =>
      rememberReference("mechanics/encounter-aid", [record.id], record.id),
    );
    const talentByIdentifier = new Map(
      dataset.domains.loadouts.hexes.flatMap((hex) =>
        hex.talents.map(
          (talent) =>
            [
              talent.id,
              {
                name: talent.displayName,
                parent: reference("mechanics/hex", hex.id),
                fragment: publicSlug(talent.displayName),
              },
            ] as const,
        ),
      ),
    );
    const requirementReferences = (
      value: unknown,
    ): readonly EditorialReference[] =>
      identifiersIn(value)
        .flatMap((id) => {
          const resolved = referenceByIdentifier.get(id);
          return resolved === undefined ? [] : [resolved];
        })
        .filter(
          (resolved, index, values) =>
            values.findIndex(
              (candidate) =>
                candidate.recordType === resolved.recordType &&
                candidate.id === resolved.id,
            ) === index,
        );
    const requirementItems = (value: unknown): readonly JsonValue[] =>
      identifiersIn(value)
        .flatMap((id) => {
          const resolved = talentByIdentifier.get(id);
          return resolved === undefined ? [] : [json(resolved)];
        })
        .filter(
          (resolved, index, values) =>
            values.findIndex(
              (candidate) => object(candidate).name === object(resolved).name,
            ) === index,
        );
    const unlock = publicRequirements(unlockRequirements, conditionNames);
    const unlockRules = stringRules(unlock.rules);
    const objectives = publicRequirements(
      completionRequirements,
      conditionNames,
    );
    const unlockReferences = requirementReferences(unlockRequirements);
    const objectiveReferences = requirementReferences(completionRequirements);
    const unlockItems = requirementItems(unlockRequirements);
    const objectiveItems = requirementItems(completionRequirements);
    const objectiveRules = stringRules(objectives.rules);
    const officialObjective =
      prophecy.localizedFields?.CustomIncompleteString === undefined
        ? null
        : publicText(prophecy.localizedFields.CustomIncompleteString);
    const chamberCount = object(prophecy.data).NumChambersRequired;
    const prophecyData = object(prophecy.data);
    const rewardResourceId = string(prophecyData.RewardResourceName, "");
    const rewardAmount = prophecyData.RewardResourceAmount;
    add("world-progression/prophecy", prophecy.id, prophecy.displayName, {
      name: prophecy.displayName,
      "unlock-requirements": {
        ...unlock,
        ...(unlockReferences.length > 0
          ? { references: unlockReferences }
          : {}),
        ...(unlockItems.length > 0 ? { items: unlockItems } : {}),
        rules:
          unlockRules.length > 0
            ? unlockRules
            : ["Available when the Fated List is unlocked."],
      },
      objectives: {
        ...objectives,
        ...(objectiveReferences.length > 0
          ? { references: objectiveReferences }
          : {}),
        ...(objectiveItems.length > 0 ? { items: objectiveItems } : {}),
        rules: [
          ...(officialObjective === null || officialObjective === ""
            ? objectiveRules
            : [officialObjective]),
          ...(typeof chamberCount === "number"
            ? [`Complete ${chamberCount} chambers.`]
            : []),
        ],
      },
      rewards:
        rewardResourceId === "" || typeof rewardAmount !== "number"
          ? []
          : [
              {
                amount: rewardAmount,
                resource: reference("mechanics/resource", rewardResourceId),
              },
            ],
    });
  }
  for (const milestone of dataset.domains.guide.narrative) {
    add(
      "world-progression/narrative-milestone",
      milestone.id,
      milestone.displayName,
      {
        kind: milestone.classification ?? "narrative",
        requirements: publicRequirements(
          rawPick(milestone.data, [
            "CompleteGameStateRequirements",
            "GameStateRequirements",
            "UnlockGameStateRequirements",
          ]),
          conditionNames,
        ),
      },
    );
  }
  for (const achievement of dataset.domains.guide.achievements) {
    add(
      "world-progression/achievement",
      achievement.id,
      achievement.displayName,
      {
        "name-description": {
          name: achievement.displayName,
          description: achievement.description,
          hidden: achievement.hidden,
        },
        trigger: publicRequirements(
          rawPick(achievement.data, ["CompleteGameStateRequirements"]),
          conditionNames,
        ),
      },
    );
  }
  const officialNameFor = (item: EditorialReference): string | null =>
    subjects.find(
      (subject) =>
        subject.recordType === item.recordType && subject.id === item.id,
    )?.publicName ?? null;
  const rawEffectDescriptions = new Map<string, string>([
    ...dataset.domains.boons.boons.map(
      (boon) => [key("mechanics/boon", boon.id), boon.description] as const,
    ),
    ...dataset.domains.weapons.hammers.map(
      (hammer) =>
        [
          key("mechanics/hammer-upgrade", hammer.id),
          hammer.description,
        ] as const,
    ),
  ]);
  const publishEffectReason = <
    T extends {
      readonly reference: EditorialReference;
      readonly reason: string;
    },
  >(
    entry: T,
  ): T => {
    const referenceKey = key(entry.reference.recordType, entry.reference.id);
    if (entry.reason !== rawEffectDescriptions.get(referenceKey)) return entry;
    const subject = subjects.find(
      (candidate) => key(candidate.recordType, candidate.id) === referenceKey,
    );
    const summary = subject === undefined ? null : publicSummary(subject);
    if (summary === null)
      throw new Error(`Missing public effect description for ${referenceKey}.`);
    return { ...entry, reason: summary };
  };
  for (const stage of editorial.progressionStages) {
    add(stage.recordType, stage.id, stage.title, {
      milestone: {
        order: stage.order,
        title: stage.title,
        endpoint: stage.endpoint,
        spoilerLevel: stage.spoilerLevel,
        recommendation: stage.recommendation,
        reason: stage.reason,
        limitation: stage.limitation,
        fallback: stage.fallback,
      },
      "reader-knowledge": stage.readerKnowledge,
      "next-objective": stage.recommendation,
      "action-sequence": stage.actionSequence,
      "purchase-upgrade-priorities": stage.purchaseUpgradePriorities,
      "resource-policy": stage.resourcePolicy,
      loadout: stage.loadoutReferences,
      "ordered-priority-references": stage.priorityReferences,
      "boon-encounter-priorities": stage.boonEncounterPriorities,
      "parallel-objectives": stage.parallelObjectiveReferences,
      "route-late-game": stage.routeLateGame,
      "completion-checklist": {
        steps: stage.completionChecklist,
        references: stage.completionReferences,
      },
    });
  }
  for (const guide of editorial.weaponGuides) {
    add(guide.recordType, guide.id, officialNameFor(guide.weaponReference), {
      "subject-aspects": {
        weapon: guide.weaponReference,
        aspects: guide.aspectReferences,
      },
      "boon-rankings": guide.boonRankings.map(publishEffectReason),
      "context-ratings-guidance": {
        overallRating: guide.overallRating,
        overallReason: guide.overallReason,
        contextRatings: guide.contextRatings,
        recommendation: guide.recommendation,
        reason: guide.reason,
        limitation: guide.limitation,
        fallback: guide.fallback,
      },
    });
  }
  for (const guide of editorial.aspectGuides) {
    const encounterAidInteractionsFor = (variant: AspectBuildVariantRecord) =>
      dataset.domains.guide.encounterAids.flatMap((aid) => {
        const coreSlots = new Set(
          variant.boonPriorities
            .filter((priority) => priority.role === "core")
            .map((priority) => priority.slot),
        );
        const shared = actionSlotsForAid(aid).filter((tag) =>
          coreSlots.has(tag as (typeof variant.boonPriorities)[number]["slot"]),
        );
        if (shared.length === 0) return [];
        const aidEffects = object(encounterAidEffects.get(aid.id)?.data);
        const availabilityRules = readableStaticConditions(
          aid.availability,
          conditionNames,
        );
        const providerName =
          conditionNames.get(aid.providerId) ??
          missingPublicToken("encounter-friend", aid.providerId);
        return [
          {
            kind: "synergy" as const,
            references: [reference("mechanics/encounter-aid", aid.id)],
            reason: encounterAidDescription(
              aid.id,
              aid.description,
              aidEffects,
            ),
            condition:
              availabilityRules[0] ?? `${providerName} can offer this choice.`,
          },
        ];
      });
    const publishBuildVariant = (variant: AspectBuildVariantRecord) => ({
      goal: variant.goal,
      recommendation: variant.recommendation,
      reason: variant.reason,
      limitation: variant.limitation,
      fallback: variant.fallback,
      overallRating: variant.overallRating,
      overallReason: variant.overallReason,
      overallLimitation: variant.overallLimitation,
      strengths: variant.strengths,
      weaknesses: variant.weaknesses,
      playstyleCombatSequence: variant.playstyleCombatSequence,
      powerBreakpoints: variant.powerBreakpoints,
      arcanaLoadout: {
        cards: variant.arcanaLoadout,
        graspCost: variant.arcanaGraspCost,
        constraint: variant.arcanaConstraint,
      },
      keepsakeRoute: variant.keepsakeRoute,
      familiarHex: variant.familiarHex,
      boonPriorities: variant.boonPriorities.map((priority) => ({
        ...priority,
        preferred: priority.preferred.map(publishEffectReason),
        fallback: priority.fallback.map(publishEffectReason),
      })),
      boonRankings: variant.boonRankings.map(publishEffectReason),
      duoLegendaryTargets: variant.duoLegendaryTargets,
      hammerRankings: variant.hammerRankings.map(publishEffectReason),
      buildInteractions: [
        ...variant.buildInteractions,
        ...encounterAidInteractionsFor(variant),
      ],
      rewardPriorities: variant.rewardPriorities,
      rewardDecisionRules: variant.rewardDecisionRules,
      fallbacksConflicts: {
        conflicts: variant.conflicts,
        upgradeConflicts: variant.upgradeConflicts,
        fallback: variant.fallback,
      },
      bossRouteConsiderations: variant.bossRouteConsiderations,
      contextRatings: variant.contextRatings,
    });
    add(guide.recordType, guide.id, officialNameFor(guide.aspectReference), {
      "build-variants": {
        strongest: publishBuildVariant(guide.buildVariants.strongest),
        safest: publishBuildVariant(guide.buildVariants.safest),
      },
      "rank-evaluations": {
        aspect: guide.aspectReference,
        overallRating: guide.overallRating,
        overallReason: guide.overallReason,
        overallLimitation: guide.overallLimitation,
        ranks: guide.rankEvaluations,
      },
      "strengths-weaknesses": {
        strengths: guide.strengths,
        weaknesses: guide.weaknesses,
        beginnerDifficulty: guide.beginnerDifficulty,
      },
      "playstyle-combat-sequence": guide.playstyleCombatSequence,
      "arcana-loadout": {
        cards: guide.arcanaLoadout,
        graspCost: guide.arcanaGraspCost,
        constraint: guide.arcanaConstraint,
      },
      "keepsake-route": guide.keepsakeRoute,
      "familiar-hex": guide.familiarHex,
      "boon-priorities": guide.boonPriorities.map((priority) => ({
        ...priority,
        preferred: priority.preferred.map(publishEffectReason),
        fallback: priority.fallback.map(publishEffectReason),
      })),
      "boon-rankings": guide.boonRankings.map(publishEffectReason),
      "duo-legendary-targets": guide.duoLegendaryTargets,
      "hammer-rankings": guide.hammerRankings.map(publishEffectReason),
      "build-interactions": [
        ...guide.buildInteractions,
        ...encounterAidInteractionsFor(guide.buildVariants.strongest),
      ],
      "reward-priorities": guide.rewardPriorities,
      "reward-decision-rules": guide.rewardDecisionRules,
      "fallbacks-conflicts": {
        conflicts: guide.conflicts,
        upgradeConflicts: guide.upgradeConflicts,
        fallback: guide.fallback,
      },
      "boss-route-considerations": guide.bossRouteConsiderations,
      "context-ratings": guide.contextRatings,
    });
  }
  for (const rating of editorial.boonRatings) {
    add(
      rating.recordType,
      rating.id,
      officialNameFor(rating.subjectReference),
      {
        "subject-context": {
          subject: rating.subjectReference,
          context: rating.context,
          dimension: rating.evaluationDimension,
        },
        rating: rating.rating,
        "reason-prerequisites-limitation": {
          recommendation: rating.recommendation,
          reason: rating.reason,
          prerequisites: rating.prerequisiteReferences,
          limitation: rating.limitation,
          fallback: rating.fallback,
        },
      },
    );
  }
  for (const rating of [
    ...editorial.arcanaRatings,
    ...editorial.familiarRatings,
    ...editorial.hexRatings,
  ]) {
    add(
      rating.recordType,
      rating.id,
      officialNameFor(rating.subjectReference),
      {
        "subject-context": {
          subject: rating.subjectReference,
          context: rating.context,
          dimension: rating.evaluationDimension,
        },
        [rating.recordType === "editorial/arcana-rating"
          ? "rating-guidance"
          : "rating-choice-guidance"]: {
          rating: rating.rating,
          recommendation: rating.recommendation,
          reason: rating.reason,
          limitation: rating.limitation,
          fallback: rating.fallback,
          recommendedByAspectCount: rating.recommendedByAspectCount,
          aspectCount: rating.aspectCount,
        },
      },
    );
  }
  for (const page of editorial.pageDefinitions) {
    add("editorial/page-definition", page.id, page.title, {
      "title-kind-sources": {
        title: page.title,
        kind: page.pageKind,
        sourceRecordTypes: page.sourceRecordTypes,
      },
      "aliases-spoiler-level": {
        aliases: page.aliases,
        spoilerLevel: page.spoilerLevel,
      },
    });
  }
  return subjects;
}

function publicModelFor(
  subject: Subject,
  aliases: readonly string[],
  spoilerLevel: SpoilerLevel,
  subjects: readonly Subject[],
  dataset: CombinedDataset,
): PublicationRecordPublicModel | null {
  const definition = PUBLIC_TYPE_DEFINITIONS[subject.recordType];
  if (definition === undefined || subject.publicName === null) return null;

  if (subject.recordType === "mechanics/combat-mechanic") {
    return null;
  }
  if (subject.recordType === "mechanics/status-element") {
    const boonNames = new Set(
      dataset.domains.boons.boons.map((boon) => boon.name),
    );
    if (
      dataset.domains.boons.boons.some((boon) => boon.id === subject.id) ||
      boonNames.has(subject.publicName)
    )
      return null;
  }
  if (
    subject.recordType === "world-progression/encounter" &&
    PUBLIC_NAME_OVERRIDES[key(subject.recordType, subject.id)] === undefined
  ) {
    return null;
  }
  if (
    subject.recordType === "mechanics/resource" &&
    array(subject.values["acquisition-locations"]).length === 0 &&
    array(subject.values.uses).length === 0
  ) {
    return null;
  }
  if (
    subject.recordType === "world-progression/region" &&
    subject.values.route === null &&
    subject.values["unlock-requirements"] === null &&
    publicSummary(subject) === null
  ) {
    return null;
  }
  if (
    /^(?:default|n\/?r|none|unknown|null)$/iu.test(subject.publicName.trim()) ||
    /\b(?:Combat\s+[A-Z]\d*|MetaRank\d+)\b/u.test(subject.publicName)
  ) {
    return null;
  }

  if (subject.recordType === "world-progression/narrative-milestone") {
    const candidates = dataset.domains.guide.narrative.filter(
      (milestone) => milestone.displayName === subject.publicName,
    );
    const score = (
      milestone: (typeof dataset.domains.guide.narrative)[number],
    ): number =>
      (/^NPC_/u.test(milestone.id) ? -100 : 0) - milestone.id.length / 1000;
    const canonical = [...candidates].sort(
      (left, right) =>
        score(right) - score(left) || compareStrings(left.id, right.id),
    )[0];
    if (canonical?.id !== subject.id) return null;
  }

  const subjectKey = key(subject.recordType, subject.id);
  const slug =
    PUBLIC_SLUG_OVERRIDES[subjectKey] ?? publicSlug(subject.publicName);
  if (slug === "") return null;

  if (subject.recordType === "mechanics/run-reward") {
    const resource = object(object(subject.values.effect).resource);
    if (
      resource.recordType === "mechanics/resource" &&
      typeof resource.id === "string"
    ) {
      const resourceSubject = subjects.find(
        (entry) =>
          entry.recordType === "mechanics/resource" && entry.id === resource.id,
      );
      if (resourceSubject?.publicName === null || resourceSubject === undefined)
        return null;
      const resourceKey = key(resourceSubject.recordType, resourceSubject.id);
      const resourceSlug =
        PUBLIC_SLUG_OVERRIDES[resourceKey] ??
        publicSlug(resourceSubject.publicName);
      if (resourceSlug === "") return null;
      return {
        name: subject.publicName,
        slug,
        typeLabel: definition.label,
        summary: publicSummary(subject),
        href: `/knowledge/records/resources/${resourceSlug}/`,
        aliases: [...new Set(aliases)].sort(compareStrings),
        spoilerLevel,
        category: definition.collection,
        presentation: "embedded",
      };
    }
  }

  const linkedWeaponName = (): string | null => {
    const aspect = dataset.domains.weapons.aspects.find(
      (entry) => entry.id === subject.id,
    );
    if (aspect === undefined) return null;
    return (
      subjects.find(
        (entry) =>
          entry.recordType === "mechanics/weapon" &&
          entry.id === aspect.weaponId,
      )?.publicName ?? null
    );
  };
  const aspectSlug = (): string | null => {
    const weaponName = linkedWeaponName();
    return weaponName === null ? null : `${publicSlug(weaponName)}-${slug}`;
  };

  let href: string;
  switch (definition.route) {
    case "guide": {
      const anchor = PUBLIC_GUIDE_STAGE_ANCHORS[subject.id];
      if (anchor === undefined) return null;
      href = `/guide/#chapter-${anchor}`;
      break;
    }
    case "aspect-build": {
      const routeSlug = aspectSlug();
      if (routeSlug === null) return null;
      href = `/knowledge/builds/${routeSlug}/`;
      break;
    }
    case "weapon-build":
      href = `/knowledge/builds/#${slug}`;
      break;
    case "boon-tier":
      href = `/knowledge/tier-lists/boons/#${slug}`;
      break;
    case "arcana-tier":
      href = `/knowledge/tier-lists/arcana/#${slug}`;
      break;
    case "familiar-tier":
      href = `/knowledge/tier-lists/familiars/#${slug}`;
      break;
    case "hex-tier":
      href = `/knowledge/tier-lists/hexes/#${slug}`;
      break;
    case "collection":
      href = `/knowledge/${definition.collection}/`;
      break;
    case "detail": {
      const isEmptyResource =
        subject.recordType === "mechanics/resource" &&
        array(subject.values["acquisition-locations"]).length === 0 &&
        array(subject.values.uses).length === 0 &&
        publicSummary(subject) === null;
      href =
        (subject.recordType === "mechanics/resource" &&
          subject.id.startsWith("Fish")) ||
        isEmptyResource
          ? `/knowledge/${definition.collection}/`
          : `/knowledge/records/${definition.collection}/${slug}/`;
      break;
    }
  }

  return {
    name: subject.publicName,
    slug,
    typeLabel: definition.label,
    summary: publicSummary(subject),
    href,
    aliases: [...new Set(aliases)].sort(compareStrings),
    spoilerLevel,
    category: definition.collection,
    presentation:
      definition.route === "detail"
        ? "detail"
        : definition.route === "collection"
          ? "collection"
          : definition.route === "guide"
            ? "guide"
            : "embedded",
  };
}

function publicationDispositionFor(
  subject: Subject,
  publicModel: PublicationRecordPublicModel | null,
): PublicationDisposition {
  if (publicModel !== null) {
    return {
      status: "published",
      category: publicModel.category,
      presentation: publicModel.presentation,
    };
  }
  if (PUBLIC_TYPE_DEFINITIONS[subject.recordType] === undefined) {
    return { status: "excluded", reason: "unsupported-record-type" };
  }
  if (subject.publicName === null) {
    return { status: "excluded", reason: "missing-public-name" };
  }
  return { status: "excluded", reason: "no-reader-facing-view" };
}

function allowedByRecordType(
  allowlist: PublicationAllowlist,
): ReadonlyMap<string, ReadonlyMap<string, PublicationField>> {
  const output = new Map<string, Map<string, PublicationField>>();
  for (const field of allowlist.allowedFields) {
    const separator = field.id.lastIndexOf("/");
    const recordType = field.id.slice(0, separator);
    const fieldId = field.id.slice(separator + 1);
    const fields =
      output.get(recordType) ?? new Map<string, PublicationField>();
    fields.set(fieldId, field);
    output.set(recordType, fields);
  }
  return output;
}

function highestSpoiler(
  fields: ReadonlyMap<string, PublicationField> | undefined,
): SpoilerLevel {
  return [...(fields?.values() ?? [])].reduce<SpoilerLevel>(
    (highest, field) =>
      spoilerOrder[field.spoilerLevel] > spoilerOrder[highest]
        ? field.spoilerLevel
        : highest,
    "none",
  );
}

function makeRecord(
  subject: Subject,
  allowed: ReadonlyMap<string, PublicationField> | undefined,
  publicModel: PublicationRecordPublicModel | null,
): PublicationRecord {
  const fields: PublicationRecordField[] = [];
  for (const [fieldId, value] of Object.entries(subject.values)) {
    const policy = allowed?.get(fieldId);
    if (policy !== undefined) fields.push({ ...policy, value: json(value) });
  }
  return {
    key: key(subject.recordType, subject.id),
    recordType: subject.recordType,
    id: subject.id,
    fields: fields.sort((left, right) => compareStrings(left.id, right.id)),
    public: publicModel,
    publication: publicationDispositionFor(subject, publicModel),
  };
}

function normalizeSearchTerm(value: string): string {
  return value.trim().toLocaleLowerCase("en-US").replace(/\s+/gu, " ");
}

function explicitReference(value: unknown): EditorialReference | null {
  const input = object(value);
  return typeof input.recordType === "string" && typeof input.id === "string"
    ? { recordType: input.recordType, id: input.id }
    : null;
}

function referencesIn(
  value: unknown,
  candidates: ReadonlyMap<string, readonly PublicationRecord[]>,
  inferStringIds: boolean,
): readonly EditorialReference[] {
  const output = new Map<string, EditorialReference>();
  const visit = (entry: unknown): void => {
    const explicit = explicitReference(entry);
    if (explicit !== null) {
      output.set(key(explicit.recordType, explicit.id), explicit);
      return;
    }
    if (typeof entry === "string" && inferStringIds) {
      const matches = (candidates.get(entry) ?? []).filter(
        (record) =>
          !record.recordType.startsWith("editorial/") &&
          record.recordType !== "foundation/record-metadata",
      );
      if (matches.length === 1)
        output.set(
          matches[0]!.key,
          reference(matches[0]!.recordType, matches[0]!.id),
        );
      return;
    }
    if (Array.isArray(entry)) {
      entry.forEach(visit);
      return;
    }
    if (typeof entry === "object" && entry !== null)
      Object.values(entry).forEach(visit);
  };
  visit(value);
  return [...output.values()].sort((left, right) =>
    compareStrings(
      key(left.recordType, left.id),
      key(right.recordType, right.id),
    ),
  );
}

function relationshipIndexes(records: readonly PublicationRecord[]): {
  readonly relationships: PublicationDataset["relationships"];
  readonly conditions: readonly PublicationCondition[];
  readonly unresolved: readonly string[];
} {
  const recordKeys = new Set(records.map((record) => record.key));
  const candidates = new Map<string, PublicationRecord[]>();
  for (const record of records) {
    const values = candidates.get(record.id) ?? [];
    values.push(record);
    candidates.set(record.id, values);
  }
  const edges = new Map<
    string,
    { sourceKey: string; targetKey: string; fields: Set<string> }
  >();
  const conditions = new Map<
    string,
    {
      expression: JsonValue;
      dependentRecordKeys: Set<string>;
      fields: Set<string>;
    }
  >();
  const unresolved = new Set<string>();
  const addEdge = (
    sourceKey: string,
    targetKey: string,
    fieldId: string,
  ): void => {
    const edgeKey = `${sourceKey}\u0000${targetKey}`;
    const edge = edges.get(edgeKey) ?? {
      sourceKey,
      targetKey,
      fields: new Set<string>(),
    };
    edge.fields.add(fieldId);
    edges.set(edgeKey, edge);
  };
  for (const record of records) {
    if (record.recordType === "foundation/record-metadata") continue;
    for (const field of record.fields) {
      const inferStringIds =
        !/(?:^|[-/])(?:name|character|description|reason|recommendation|limitation|fallback|aliases|title)(?:-|$)/u.test(
          field.id,
        );
      for (const target of referencesIn(
        field.value,
        candidates,
        inferStringIds,
      )) {
        const targetKey = key(target.recordType, target.id);
        if (!recordKeys.has(targetKey))
          unresolved.add(`${record.key}/${field.id}->${targetKey}`);
        else if (targetKey !== record.key)
          addEdge(record.key, targetKey, field.id);
      }
      if (
        /(?:^|-)requirements$|prerequisites$/u.test(field.id) &&
        hasContent(field.value)
      ) {
        const expression = json(field.value);
        const conditionKey = `condition:sha256:${sha256(jsonBytes(expression))}`;
        const condition = conditions.get(conditionKey) ?? {
          expression,
          dependentRecordKeys: new Set<string>(),
          fields: new Set<string>(),
        };
        condition.dependentRecordKeys.add(record.key);
        condition.fields.add(field.id);
        conditions.set(conditionKey, condition);
        addEdge(record.key, conditionKey, field.id);
      }
    }
  }
  const forward: PublicationRelationship[] = [...edges.values()]
    .map((edge) => ({
      sourceKey: edge.sourceKey,
      targetKey: edge.targetKey,
      fields: [...edge.fields].sort(compareStrings),
    }))
    .sort(
      (left, right) =>
        compareStrings(left.sourceKey, right.sourceKey) ||
        compareStrings(left.targetKey, right.targetKey),
    );
  const reverse = forward
    .map((edge) => ({
      sourceKey: edge.targetKey,
      targetKey: edge.sourceKey,
      fields: edge.fields,
    }))
    .sort(
      (left, right) =>
        compareStrings(left.sourceKey, right.sourceKey) ||
        compareStrings(left.targetKey, right.targetKey),
    );
  return {
    relationships: { forward, reverse },
    conditions: [...conditions.entries()]
      .map(([conditionKey, condition]) => ({
        key: conditionKey,
        expression: condition.expression,
        dependentRecordKeys: [...condition.dependentRecordKeys].sort(
          compareStrings,
        ),
        fields: [...condition.fields].sort(compareStrings),
      }))
      .sort((left, right) => compareStrings(left.key, right.key)),
    unresolved: [...unresolved].sort(compareStrings),
  };
}

export function compilePublicationDataset(
  combined: CombinedDataset,
  editorial: EditorialDataset,
  allowlist: PublicationAllowlist,
  identity: PublicationSourceIdentity,
): PublicationCompileResult {
  if (
    editorial.source.datasetAcquisitionId !== identity.datasetAcquisitionId ||
    editorial.source.datasetSha256 !== identity.datasetSha256 ||
    editorial.source.dataReadyAcquisitionId !== identity.dataReadyAcquisitionId
  ) {
    throw new Error(
      "Publication inputs do not share one certified dataset and data-ready identity.",
    );
  }
  const allowed = allowedByRecordType(allowlist);
  const baseSubjects = sourceSubjects(combined, editorial);
  const aliases = new Map(
    editorial.searchAliases.map((entry) => [
      key(entry.subjectReference.recordType, entry.subjectReference.id),
      entry.aliases,
    ]),
  );
  for (const [subjectKey, overrideAliases] of Object.entries(
    PUBLIC_SEARCH_ALIAS_OVERRIDES,
  )) {
    aliases.set(
      subjectKey,
      [
        ...new Set([...(aliases.get(subjectKey) ?? []), ...overrideAliases]),
      ].sort(compareStrings),
    );
  }
  const publicModels = new Map(
    baseSubjects.map((subject) => {
      const subjectKey = key(subject.recordType, subject.id);
      return [
        subjectKey,
        publicModelFor(
          subject,
          aliases.get(subjectKey) ?? [],
          highestSpoiler(allowed.get(subject.recordType)),
          baseSubjects,
          combined,
        ),
      ] as const;
    }),
  );
  const baseRecords = baseSubjects.map((subject) =>
    makeRecord(
      subject,
      allowed.get(subject.recordType),
      publicModels.get(key(subject.recordType, subject.id)) ?? null,
    ),
  );
  const metadataSubjects = baseSubjects.map((subject): Subject => ({
    recordType: "foundation/record-metadata",
    id: key(subject.recordType, subject.id),
    officialName: subject.officialName,
    publicName: null,
    values: {
      "official-name": subject.officialName,
      "search-aliases": aliases.get(key(subject.recordType, subject.id)) ?? [],
      "spoiler-level": highestSpoiler(allowed.get(subject.recordType)),
    },
  }));
  const records = [
    ...baseRecords,
    ...metadataSubjects.map((subject) =>
      makeRecord(subject, allowed.get(subject.recordType), null),
    ),
  ].sort((left, right) => compareStrings(left.key, right.key));
  const pageRecords = new Map(
    editorial.pageDefinitions.map((page) => [page.id, page]),
  );
  const pages: PublicationPage[] = editorial.pageDefinitions
    .map((page) => ({
      id: page.id,
      pageKind: page.pageKind,
      title: page.title,
      aliases: [...page.aliases].sort(compareStrings),
      spoilerLevel: page.spoilerLevel,
      recordKeys: records
        .filter(
          (record) =>
            record.public !== null &&
            page.sourceRecordTypes.includes(record.recordType),
        )
        .map((record) => record.key)
        .sort(compareStrings),
    }))
    .sort((left, right) => compareStrings(left.id, right.id));
  const search: PublicationSearchEntry[] = [];
  for (const subject of baseSubjects) {
    const subjectKey = key(subject.recordType, subject.id);
    const publicModel = publicModels.get(subjectKey);
    if (publicModel === null || publicModel === undefined) continue;
    const terms = new Set([publicModel.name, ...publicModel.aliases]);
    if (subject.recordType === "editorial/page-definition") {
      const page = pageRecords.get(subject.id);
      page?.aliases.forEach((alias) => terms.add(alias));
    }
    for (const term of terms) {
      const normalizedTerm = normalizeSearchTerm(term);
      if (normalizedTerm !== "")
        search.push({ term, normalizedTerm, recordKey: subjectKey });
    }
  }
  const sortedSearch = search
    .filter(
      (entry, index, values) =>
        values.findIndex(
          (candidate) =>
            candidate.recordKey === entry.recordKey &&
            candidate.normalizedTerm === entry.normalizedTerm,
        ) === index,
    )
    .sort(
      (left, right) =>
        compareStrings(left.normalizedTerm, right.normalizedTerm) ||
        compareStrings(left.recordKey, right.recordKey),
    );
  const indexed = relationshipIndexes(records);
  const dataset: PublicationDataset = {
    schema: "neodes2-publication-3",
    source: {
      ...identity,
      steamBuildId: combined.source.steamBuildId,
      executableVersion: combined.source.executableVersion,
      packageVersion: combined.source.packageVersion,
    },
    records,
    pages,
    search: sortedSearch,
    relationships: indexed.relationships,
    conditions: indexed.conditions,
  };
  const report = createPublicationReport(dataset, allowlist);
  return {
    dataset,
    report:
      indexed.unresolved.length === 0
        ? report
        : {
            ...report,
            unresolvedReferences: [
              ...new Set([
                ...report.unresolvedReferences,
                ...indexed.unresolved,
              ]),
            ].sort(compareStrings),
            complete: false,
          },
  };
}
