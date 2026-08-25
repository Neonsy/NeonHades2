import type { JsonValue } from "../boons/index.js";
import type {
  StaticCondition,
  StaticEncounterFriend,
  StaticGodAppearance,
} from "../guide/index.js";

const emptyNames: ReadonlyMap<string, string> = new Map();

function missingPublicIdentifier(kind: string, value: string): never {
  throw new Error(`Missing public ${kind} label for ${value}.`);
}

const regionNames: Readonly<Record<string, string>> = {
  F: "Erebus",
  G: "Oceanus",
  H: "the Fields of Mourning",
  I: "Tartarus",
  N: "the City of Ephyra",
  O: "the Rift of Thessaly",
  P: "Mount Olympus",
  Q: "the Summit",
};

const guardianNames: Readonly<Record<string, string>> = {
  F: "Headmistress Hecate",
  G: "Scylla and the Sirens",
  H: "the Infernal Beast",
  I: "Chronos",
  N: "Polyphemus",
  O: "Eris",
  P: "Prometheus",
  Q: "Typhon",
};

const weaponNames: Readonly<Record<string, string>> = {
  Staff: "Witch's Staff",
  Dagger: "Sister Blades",
  Torch: "Umbral Flames",
  Axe: "Moonstone Axe",
  Lob: "Argent Skull",
  Suit: "Black Coat",
};

const aspectNames: Readonly<Record<string, string>> = {
  AxeArmCastAspect: "Aspect of Charon",
  AxePerfectCriticalAspect: "Aspect of Thanatos",
  AxeRallyAspect: "Aspect of Nergal",
  AxeRecoveryAspect: "Aspect of Melinoë",
  BaseStaffAspect: "Aspect of Melinoë",
  BaseSuitAspect: "Aspect of Melinoë",
  DaggerBackstabAspect: "Aspect of Melinoë",
  DaggerBlockAspect: "Aspect of Artemis",
  DaggerHomingThrowAspect: "Aspect of Pan",
  DaggerTripleAspect: "Aspect of the Morrigan",
  LobAmmoBoostAspect: "Aspect of Melinoë",
  LobCloseAttackAspect: "Aspect of Medea",
  LobGunAspect: "Aspect of Hel",
  LobImpulseAspect: "Aspect of Persephone",
  StaffClearCastAspect: "Aspect of Circe",
  StaffRaiseDeadAspect: "Aspect of Anubis",
  StaffSelfHitAspect: "Aspect of Momus",
  SuitComboAspect: "Aspect of Shiva",
  SuitHexAspect: "Aspect of Selene",
  SuitMarkCritAspect: "Aspect of Nyx",
  TorchAutofireAspect: "Aspect of Supay",
  TorchDetonateAspect: "Aspect of Moros",
  TorchSpecialDurationAspect: "Aspect of Melinoë",
  TorchSprintRecallAspect: "Aspect of Eos",
};

const stateSubjects: Readonly<Record<string, string>> = {
  AchievementsUnlocked: "unlocked achievements",
  Enabled: "active",
  Unlocked: "unlocked",
  TextLinesRecord: "required conversations",
  SpeechRecord: "required voice lines",
  TraitsTaken: "boons recorded across nights",
  TraitsSold: "boons sold at a Pool of Purging",
  WeaponsUnlocked: "unlocked weapons",
  FamiliarUpgrades: "Familiar upgrades",
  FamiliarsUnlocked: "recruited Familiars",
  EncountersCompletedCache: "completed encounters",
  EncountersOccurredCache: "encounters seen",
  FishCaught: "different fish caught",
  FishingSuccesses: "successful catches",
  ExorcismSuccesses: "successful shade compulsions",
  ShovelSuccesses: "successful seed digs",
  PickaxeSuccesses: "successful mineral harvests",
  GiftPresentation: "gifts given",
  LifetimeResourcesGained: "resources gathered in total",
  LifetimeResourcesSpent: "resources spent in total",
  LastAwardTrait: "most recently awarded boon",
  LootTypeHistory: "reward types already offered this night",
  NemesisBetWinnings: "wagers won against Nemesis",
  ReachedTrueEnding: "completion of the true ending",
  ReachedEpilogue: "completion of the epilogue",
  ClearedUnderworldRunsCache: "Underworld clears",
  PackagedBountyClears: "completed Chaos Trials",
  MaxMetaUpgradeCostCache: "Grasp capacity",
  MetaUpgradeMaxLevelCountCache: "Arcana Cards upgraded to their maximum rank",
  MetaUpgradeUnlockedCountCache: "revealed Arcana Cards",
  CompletedDreamRunsCache: "completed Chaos Trials",
  HighestShrinePointClearDreamCache: "highest Fear cleared in a Chaos Trial",
  HighestShrinePointClearUnderworldCache:
    "highest Fear cleared on the Underworld route",
  HighestShrinePointClearSurfaceCache:
    "highest Fear cleared on the Surface route",
  CodexEntriesUnlockedCache: "unlocked Book of Shadows entries",
  RandomBountyHighestClearStreak: "consecutive All-Random Chaos Trial clears",
  StoreItemPinsPurchased: "pinned shop items purchased",
  FrogPetRunCount: "nights completed with Frinos",
  ClearedRunsCache: "route clears",
  ClearedWithWeapons: "weapons used to clear a route",
  ClearedWithAspects: "aspects used to clear a route",
  ClearedWithFamiliars: "Familiars used to clear a route",
  ClearedWithMetaUpgrades: "Arcana Cards active during a route clear",
  DreamRunClearedWithWeapons: "weapons used to clear Chaos Trials",
  EnemyEliteAttributeKills: "armored enemy traits defeated",
  QuestsCompleted: "completed Fated List prophecies",
  StoryResetCount: "completed story resets",
  CompletedRunsCache: "completed nights",
  ClearedSurfaceRunsCache: "Surface clears",
  BiomeDepthCache: "regions reached",
  SpentShrinePointsCache: "Fear",
  ShrineBountiesCompleted: "completed Testaments",
  SpellSummons: "Hex activations",
  MetaUpgradeCostCache: "total Grasp used by active Arcana Cards",
  MetaUpgradeLimitLevel: "Grasp capacity",
  RoomsEntered: "rooms entered",
  RoomCountCache: "rooms completed",
  UseRecord: "required rewards obtained",
  UnlockedMusicPlayerSongs: "songs unlocked in the Music Maker",
  WorldUpgrades: "completed incantations",
  WorldUpgradesAdded: "completed incantations",
};

const namedRequirementNames: Readonly<Record<string, string>> = {
  AcquiredMixerForMedeaQuest: "Tears gathered after Medea requests them",
  Blink: "Shifter",
  ExtraDamage: "Bruiser",
  Fog: "Spiller",
  Frenzy: "Swifter",
  HeavyArmor: "Thicker",
  Hex: "Morpher",
  Homing: "Seeker",
  ManaDrain: "Drainer",
  Massive: "Bigger",
  Metallic: "Clanger",
  Miasma: "Downer",
  Molten: "Burner",
  Orbit: "Spinner",
  Radial: "Slicer",
  Rifts: "Scraper",
  Rooting: "Burrower",
  SpreadHitShields: "Shielder",
  StasisDeath: "Stopper",
  Unflinching: "Tougher",
  Vacuuming: "Sucker",
  AlchemyUnlocked: "Alchemy at the cauldron unlocked",
  Cosmetic_ErisTrashcan: "Basket, Rubbish",
  CosmeticsShopUnlocked: "Crossroads renovation menu unlocked",
  CirceEnlargeTrait: "Word of Greater Girth",
  CirceShrinkTrait: "Word of Smaller Stature",
  CashedOut: "reward claimed",
  DeathDefianceDamageBoonEligible:
    "a Death Defiance spent this night or the Eternity Arcana Card active",
  ErisUnlocked: "Eris available for encounters",
  FamiliarCostume_FrogChthonic: "Daemonic Familiar appearance",
  FamiliarCostume_FrogCute: "Cherubic Familiar appearance",
  FamiliarCostume_FrogHell: "Draconic Familiar appearance",
  FamiliarCostume_FrogMoon: "Moon-Touched Familiar appearance",
  FamiliarCostume_FrogNightmare: "Nightmarish Familiar appearance",
  FamiliarCostume_FrogDefault: "default Familiar appearance",
  FamiliarCostume_RavenDefault: "default Familiar appearance",
  FamiliarCostume_RavenChthonic: "Chthonic Familiar appearance",
  FamiliarCostume_RavenCute: "Vernal Familiar appearance",
  FamiliarCostume_RavenHell: "Phoenix Familiar appearance",
  FamiliarCostume_RavenMoon: "Moon-Touched Familiar appearance",
  FamiliarCostume_RavenNightmare: "Nightmarish Familiar appearance",
  FamiliarCostume_CatDefault: "default Familiar appearance",
  FamiliarCostume_CatChthonic: "Chthonic Familiar appearance",
  FamiliarCostume_CatHell: "Daemonic Familiar appearance",
  FamiliarCostume_CatMoon: "Magickal Familiar appearance",
  FamiliarCostume_CatNightmare: "Nightmarish Familiar appearance",
  FamiliarCostume_CatChaos: "Chaotic Familiar appearance",
  FamiliarCostume_HoundDefault: "default Familiar appearance",
  FamiliarCostume_HoundChaos: "Chaotic Familiar appearance",
  FamiliarCostume_HoundCute: "Grecian Familiar appearance",
  FamiliarCostume_HoundHell: "Daemonic Familiar appearance",
  FamiliarCostume_HoundMoon: "Huntress Familiar appearance",
  FamiliarCostume_HoundNightmare: "Nightmarish Familiar appearance",
  FamiliarCostume_PolecatDefault: "default Familiar appearance",
  FamiliarCostume_PolecatChthonic: "Hypnotic Familiar appearance",
  FamiliarCostume_PolecatCute: "Olympic Familiar appearance",
  FamiliarCostume_PolecatHell: "Infernal Familiar appearance",
  FamiliarCostume_PolecatMoon: "Moon-Touched Familiar appearance",
  FamiliarCostume_PolecatNightmare: "Nightmarish Familiar appearance",
  ExtendedShopTrait: "Archaic Seal",
  FirstHitHealTrait: "Breath of Eros",
  HealthFountain: "restorative fountain",
  HostilePolymorph: "polymorphed by Hecate",
  Melee: "Attack",
  Secondary: "Special",
  Ranged: "Cast",
  Rush: "Sprint",
  Mana: "Gain",
  PackageBountyRandomUnderworld_Difficulty1: "Chaos Below",
  PackageBountyRandomUnderworld_Difficulty2: "Great Chaos Below",
  PackageBountyRandomSurface_Difficulty1: "Chaos Above",
  PackageBountyRandomSurface_Difficulty2: "Great Chaos Above",
  HasAllMetaCardsUnlocked: "every Arcana Card revealed",
  HasAllMetaCardsMaxed: "every Arcana Card upgraded to its maximum rank",
  HasAllCatUpgrades: "every Toula upgrade",
  HasAllFrogUpgrades: "every Frinos upgrade",
  HasAllHoundUpgrades: "every Hecuba upgrade",
  HasAllPolecatUpgrades: "every Gale upgrade",
  HasAllRavenUpgrades: "every Raki upgrade",
  SafeZoneDefense: "Ward Circle defense encounter",
  UsedTimeSlowAgainstChronos: "time-slowing used against Chronos",
  TemporaryDoorHealTrait: "HydraLite",
  TemporaryDiscountTrait: "Ferry Voucher",
  TemporaryEmptySlotDamageTrait: "Danaid Dagger",
  TemporaryForcedSecretDoorTrait: "Spark of Ixion",
  TemporaryBoonRarityTrait: "Yarn of Ariadne",
  TemporaryHealExpirationTrait: "Charity Bottle",
  TemporaryImprovedSecondaryTrait: "Chimaera Jerky",
  TemporaryImprovedCastTrait: "Braid of Atlas",
  TemporaryImprovedExTrait: "Witch's Mark",
  TemporaryImprovedDefenseTrait: "Python Scales",
  TemporaryMoveSpeedTrait: "Ignited Ichor",
};

const npcNames: Readonly<Record<string, string>> = {
  Aphrodite: "Aphrodite",
  Arachne: "Arachne",
  Ares: "Ares",
  Artemis: "Artemis",
  Athena: "Athena",
  Chaos: "Chaos",
  Charon: "Charon",
  Circe: "Circe",
  Demeter: "Demeter",
  Dionysus: "Dionysus",
  Dora: "Dora",
  Echo: "Echo",
  Eris: "Eris",
  Hades: "Hades",
  Hecate: "Hecate",
  Hephaestus: "Hephaestus",
  Hera: "Hera",
  Heracles: "Heracles",
  Hermes: "Hermes",
  Hestia: "Hestia",
  Hypnos: "Hypnos",
  Icarus: "Icarus",
  Medea: "Medea",
  Moros: "Moros",
  Narcissus: "Narcissus",
  Nemesis: "Nemesis",
  Nyx: "Nyx",
  Odysseus: "Odysseus",
  Persephone: "Persephone",
  Poseidon: "Poseidon",
  Selene: "Selene",
  Skelly: "Schelemeus",
  Thanatos: "Thanatos",
  Zagreus: "Zagreus",
  Zeus: "Zeus",
};

function naturalList(values: readonly string[]): string {
  if (values.length <= 1) return values[0] ?? "";
  if (values.length === 2) return `${values[0]} or ${values[1]}`;
  return `${values.slice(0, -1).join(", ")}, or ${values.at(-1)}`;
}

function collectionValues(value: unknown): readonly unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value !== "object" || value === null) return [];
  return Object.entries(value as Readonly<Record<string, unknown>>)
    .filter(([key]) => /^\d+$/u.test(key))
    .sort(([left], [right]) => Number(left) - Number(right))
    .map(([, entry]) => entry);
}

function hasMeaningfulValue(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (Array.isArray(value)) return value.some(hasMeaningfulValue);
  if (typeof value !== "object") return true;
  return Object.values(value as Readonly<Record<string, unknown>>).some(
    hasMeaningfulValue,
  );
}

function comparisonText(
  comparison: string,
  value: JsonValue | undefined,
): string {
  if (value === undefined) return "";
  const operator =
    (
      {
        ">=": "at least",
        ">": "more than",
        "<=": "at most",
        "<": "fewer than",
        "=": "exactly",
        "==": "exactly",
        "!=": "anything except",
      } as Readonly<Record<string, string>>
    )[comparison] ?? comparison;
  return `${operator} ${value === 1 ? "one" : String(value)}`;
}

function alternativeClause(rule: string): string {
  return rule
    .replace(/\.$/u, "")
    .replace(/^Requires you to /u, "")
    .replace(/^Requires /u, "")
    .replace(/^Must /u, "");
}

function ordinalEvent(value: string): string {
  return value
    .replace(/_FollowUp$/u, " follow-up")
    .replace(/[A-Z]?\d+(?:_[A-Z0-9]+)?(?=\s|$)/gu, "")
    .replace(/\s+/gu, " ")
    .trim();
}

function readableIdentifier(
  id: string,
  names: ReadonlyMap<string, string>,
): string {
  const official = names.get(id);
  if (official !== undefined && official.trim() !== "") return official;
  if (namedRequirementNames[id] !== undefined)
    return namedRequirementNames[id] as string;
  if (stateSubjects[id] !== undefined) return stateSubjects[id] as string;
  if (regionNames[id] !== undefined) return regionNames[id] as string;
  const npc = /^NPC_([A-Za-z]+)_\d+$/u.exec(id)?.[1];
  if (npc !== undefined && npcNames[npc] !== undefined)
    return npcNames[npc] as string;
  const testament =
    /^BountyShrine(Staff|Dagger|Torch|Axe|Lob|Suit)([FGHINOPQ])Boss$/u.exec(id);
  if (testament !== null) {
    return `${weaponNames[testament[1] as string] ?? testament[1]} Testament against ${guardianNames[testament[2] as string] ?? testament[2]}`;
  }
  const baseAspectRank =
    /^Base(Staff|Dagger|Torch|Axe|Lob|Suit)Aspect([2-5])$/u.exec(id);
  if (baseAspectRank !== null) {
    return `${weaponNames[baseAspectRank[1] as string] ?? missingPublicIdentifier("weapon", baseAspectRank[1] as string)} Aspect of Melinoë rank ${baseAspectRank[2]}`;
  }
  const aspectRank = /^(.+Aspect)([2-5])$/u.exec(id);
  if (
    aspectRank !== null &&
    aspectNames[aspectRank[1] as string] !== undefined
  ) {
    return `${aspectNames[aspectRank[1] as string]} rank ${aspectRank[2]}`;
  }
  const opening = /^([FGHINOPQ])_Intro$/u.exec(id)?.[1];
  if (opening !== undefined)
    return `${regionNames[opening] ?? opening} entrance`;
  const room = /^([FGHINOPQ])_(PreBoss|Boss|PostBoss|Story)(\d+)$/u.exec(id);
  if (room !== null) {
    const region = regionNames[room[1] as string] ?? (room[1] as string);
    const kind =
      (
        {
          PreBoss: "room before the guardian",
          Boss: "guardian-chamber layout",
          PostBoss: "room after the guardian",
          Story: "story-room layout",
        } as Readonly<Record<string, string>>
      )[room[2] as string] ?? "room layout";
    return `${region} ${kind} ${room[3] as string}`;
  }
  const introductoryEncounter =
    /^(Artemis|Athena|Icarus|Nemesis)CombatIntro$/u.exec(id)?.[1];
  if (introductoryEncounter !== undefined)
    return `${introductoryEncounter}'s introductory encounter`;
  const friendEncounter =
    /^(Heracles|Icarus|Nemesis)Combat([FGHINOPQ])(\d*)$/u.exec(id);
  if (friendEncounter !== null) {
    const variant =
      friendEncounter[3] === "" ? "" : `, variant ${friendEncounter[3]}`;
    return `${friendEncounter[1]} encounter in ${regionNames[friendEncounter[2] as string] ?? friendEncounter[2]}${variant}`;
  }
  const familiarUpgrade =
    /^(Frog|Cat|Raven|Hound|Polecat)(HealthBonus|LastStandHeal|CritChanceBonus|ManaBonus|DodgeBonus|Uses|Damage|Attack)(\d*)$/u.exec(
      id,
    );
  if (familiarUpgrade !== null) {
    const familiar =
      (
        {
          Frog: "Frinos",
          Cat: "Toula",
          Raven: "Raki",
          Hound: "Hecuba",
          Polecat: "Gale",
        } as Readonly<Record<string, string>>
      )[familiarUpgrade[1] as string] ?? familiarUpgrade[1];
    const ability =
      (
        {
          HealthBonus: "Health bonus",
          LastStandHeal: "Death Defiance heal",
          CritChanceBonus: "critical-chance bonus",
          ManaBonus: "Magick bonus",
          DodgeBonus: "dodge bonus",
          Uses: "gathering ability",
          Damage: "combat ability",
          Attack: "combat ability",
        } as Readonly<Record<string, string>>
      )[familiarUpgrade[2] as string] ??
      missingPublicIdentifier("Familiar upgrade", familiarUpgrade[2] as string);
    const rank = familiarUpgrade[3] === "" ? "" : ` rank ${familiarUpgrade[3]}`;
    return `${familiar} ${ability}${rank}`;
  }
  const fountain = /^HealthFountain([FGHINOPQ])$/u.exec(id)?.[1];
  if (fountain !== undefined)
    return `restorative fountain in ${regionNames[fountain] ?? fountain}`;
  if (id === "DeadSeaIntro") return "the opening Rift of Thessaly encounter";
  const boss =
    /^Boss(Chronos|Eris|Hecate|Scylla|Polyphemus|InfestedCerberus|Prometheus|TyphonHead)\d+$/u.exec(
      id,
    )?.[1];
  if (boss !== undefined) {
    return (
      (
        {
          Chronos: "the Chronos encounter",
          Eris: "the Eris encounter",
          Hecate: "the Headmistress Hecate encounter",
          Scylla: "the Scylla and the Sirens encounter",
          Polyphemus: "the Polyphemus encounter",
          InfestedCerberus: "the Cerberus encounter",
          Prometheus: "the Prometheus encounter",
          TyphonHead: "the Typhon encounter",
        } as Readonly<Record<string, string>>
      )[boss] ?? missingPublicIdentifier("Guardian", boss)
    );
  }
  return missingPublicIdentifier("record", id);
}

function speechText(id: string): string {
  const known = (
    {
      "/VO/MelinoeField_0619":
        "hear Melinoe note that destroying an Ephyra Pylon weakened the barrier",
      "/VO/MelinoeField_0414":
        "hear Melinoe note that Ephyra's barrier has weakened",
      "/VO/Chronos_0563_B":
        "attempt to pause during the Chronos fight and hear his response",
    } as Readonly<Record<string, string>>
  )[id];
  return known ?? missingPublicIdentifier("spoken event", id);
}

function eventText(id: string, names: ReadonlyMap<string, string>): string {
  const official = names.get(id);
  if (official !== undefined && official !== id && /[\s'’-]/u.test(official))
    return official;
  const normalized = ordinalEvent(id).replace(/^NeoChronos/u, "Chronos");
  const firstMeeting = /^([A-Za-z]+)FirstMeeting/u.exec(normalized)?.[1];
  if (firstMeeting !== undefined) return `meet ${firstMeeting} once`;
  const firstPickUp = /^([A-Za-z]+)FirstPickUp/u.exec(normalized)?.[1];
  if (firstPickUp !== undefined)
    return firstPickUp === "Selene"
      ? "accept Selene's first Hex"
      : `accept ${firstPickUp}'s first boon`;
  const firstReward = /^([A-Za-z]+)GrantsReward/u.exec(normalized)?.[1];
  if (firstReward !== undefined) return `receive ${firstReward}'s first reward`;
  const quest = /^([A-Z][a-z]+).*QuestComplete/u.exec(normalized)?.[1];
  if (quest !== undefined) return `complete ${quest}'s related quest`;
  const known = (
    {
      AresFirstPickUp: "accept Ares's first boon",
      ZeusFirstPickUp: "accept Zeus's first boon",
      MorosGrantsSurfacePenaltyCure01:
        "receive the incantation Unraveling a Fateful Bond from Moros",
      ChronosBossOutro01: "reach the aftermath of defeating Chronos",
      TrueEndingFinale01: "complete the true-ending finale",
      ArachneAboutCurseQuest01:
        "complete Arachne's conversation about her curse",
      ArachneWithHecateInHub01: "see Arachne visit Hecate at the Crossroads",
      HecateWithArachne01_FollowUp:
        "complete Hecate and Arachne's follow-up conversation",
      ArachneCurseQuestComplete: "complete Arachne's curse quest",
      HecateBossAboutArachne01: "complete Hecate's conversation about Arachne",
      ChronosNightmare01: "experience the Chronos nightmare",
      FatesEpilogue01: "complete the Fates epilogue",
      RescueFatesComplete: "rescue the Fates",
      MorosPostTrueEnding02: "speak with Moros after the true ending",
      ChaosAboutChronosNightmare01:
        "complete Chaos's conversation about the Chronos nightmare",
      ChaosAboutChronosNightmare01_B:
        "complete Chaos's conversation about the Chronos nightmare",
      ChaosGrantsBountyBoard01: "receive the Pitch-Black Stone from Chaos",
      HecateBossGrantsCodex01: "receive the Book of Shadows from Hecate",
      HecateBossGrantsCardUpgradeSystem01:
        "receive the recipe for Consecration of Ashes from Hecate",
      HecateBossGrantsFamiliarSystem01:
        "receive the recipe for Faith of Familiar Spirits from Hecate",
      HecateBossGrantsWeaponUpgradeSystem01:
        "receive the recipe for Aspects of Night and Darkness from Hecate",
      HecateGrantsWeaponUpgradeSystem01:
        "receive the recipe for Aspects of Night and Darkness from Hecate",
      HecateAboutStormStop01: "discuss how to weaken Typhon with Hecate",
      HecateHideAndSeek01: "complete Hecate's first hide-and-seek lesson",
      PoseidonDevotionIntro01: "experience Poseidon's first Family Dispute",
      HadesMeeting02: "complete Hades's second meeting",
      HadesWithPersephone01: "meet Hades and Persephone together",
      DionysusPostTrueEnding01: "speak with Dionysus after the true ending",
      ChronosBossWonAgainstHim01: "complete Chronos's post-defeat conversation",
      HadesWithPersephoneGift01:
        "reach Hades and Persephone's required gift conversation",
      HadesWithPersephoneGift06: "forge a bond with Hades and Persephone",
      HecateHideAndSeek03: "complete Hecate's hide-and-seek conversation",
      HecateBossOutro01: "complete Hecate's post-fight conversation",
      HecateBossOutroAltFight01:
        "complete Hecate's post-fight conversation after her alternate Guardian fight",
      HecateBossOutroNoArcana01:
        "defeat Hecate without any active Arcana Cards and complete her follow-up conversation",
      HecateBossFirstAppearance:
        "complete Hecate's first Guardian introduction",
      HecateBossFirstAppearanceAlt:
        "complete Hecate's alternate first Guardian introduction",
      NemesisGetFreeItemIntro01:
        "receive an item from Nemesis for the first time",
      NemesisPostCombatAboutTartarus02:
        "speak with Nemesis after combat about Tartarus",
      ChronosBossAboutAltFight01:
        "speak with Chronos about his alternate Guardian fight",
      TyphonHeadAltFight01:
        "speak with Typhon about his alternate Guardian fight",
      ZagreusBossGrantsKeepsakeOutro01:
        "receive the Calling Card from Zagreus after his Guardian encounter",
      ZagreusBossGrantsBondForged01:
        "forge a bond with Zagreus after his Guardian encounter",
      HypnosFinalDreamMeeting01: "complete Hypnos's final dream meeting",
      OdysseusLooseEndsQuest01: "begin Odysseus's Loose Ends quest",
      OdysseusLooseEndsQuest02: "complete Odysseus's Loose Ends quest",
    } as Readonly<Record<string, string>>
  )[id];
  if (known !== undefined) return known;
  const postTrueEnding = /^([A-Z][a-z]+)PostTrueEnding/u.exec(normalized)?.[1];
  if (postTrueEnding !== undefined)
    return `speak with ${postTrueEnding} after the true ending`;
  const embeddedPostTrueEnding = /^([A-Z][a-z]+).*PostTrueEnding/u.exec(
    normalized,
  )?.[1];
  if (embeddedPostTrueEnding !== undefined)
    return `speak with ${embeddedPostTrueEnding} after the true ending`;
  const meeting = /^([A-Z][a-z]+)Meeting(\d+)/u.exec(id);
  if (meeting !== null)
    return `complete ${meeting[1]}'s meeting ${String(Number(meeting[2]))}`;
  const pastMeeting = /^([A-Z][a-z]+)PastMeeting(\d+)/u.exec(id);
  if (pastMeeting !== null)
    return `complete ${pastMeeting[1]}'s past meeting ${String(Number(pastMeeting[2]))}`;
  const about = /^([A-Z][a-z]+)(?:Boss|PostCombat|Field)?About(.+)$/u.exec(
    normalized,
  );
  if (about !== null) {
    const topic =
      (
        {
          AltFight: "an alternate Guardian fight",
          AltFightQuest: "the alternate Guardian quest",
          Arachne: "Arachne",
          BecomingCloser: "growing closer",
          ConcoctionQuest: "the concoction quest",
          FishingQuest: "the fishing quest",
          Dora: "Dora",
          EpilogueProgress: "the epilogue",
          Fates: "the Fates",
          Hermes: "Hermes",
          Memories: "their memories",
          HealthQuest: "Schelemeus's health",
          KeepsakeQuest: "their keepsake quest",
          Narcissus: "Narcissus",
          Nectar: "Nectar",
          Nobody: "the name Nobody",
          NobodyKeepsake: "Odysseus's keepsake",
          Olympus: "Mount Olympus",
          OdysseusQuest: "Odysseus's quest",
          Poppies: "Poppies",
          Prometheus: "Prometheus",
          Return: "returning home",
          ScyllaQuest: "Scylla's quest",
          Tartarus: "Tartarus",
          Waters: "the waters of Oceanus",
        } as Readonly<Record<string, string>>
      )[about[2] as string] ??
      missingPublicIdentifier("story topic", about[2] as string);
    return `speak with ${about[1]} about ${topic}`;
  }
  const gift = /^([A-Z][a-z]+)Gift/u.exec(normalized);
  if (gift !== null)
    return `advance ${gift[1]}'s relationship to the required conversation`;
  const together = /^([A-Z][a-z]+)With([A-Z][a-z]+)(?:InHub)?$/u.exec(
    normalized,
  );
  if (together !== null)
    return `see ${together[1]} and ${together[2]} together${normalized.endsWith("InHub") ? " at the Crossroads" : ""}`;
  const socialEvent = /^([A-Z][a-z]+)(BathHouse|Fishing|Taverna)/u.exec(
    normalized,
  );
  if (socialEvent !== null) {
    const event =
      (
        {
          BathHouse: "bath",
          Fishing: "fishing",
          Taverna: "taverna",
        } as Readonly<Record<string, string>>
      )[socialEvent[2] as string] ??
      missingPublicIdentifier("social event", socialEvent[2] as string);
    return `complete ${socialEvent[1]}'s ${event} event`;
  }
  const grants = /^([A-Z][a-z]+)Grants(.+)$/u.exec(normalized);
  if (grants !== null)
    return `complete ${grants[1]}'s required reward conversation`;
  return missingPublicIdentifier("story event", id);
}

function pathSubject(
  path: readonly string[],
  names: ReadonlyMap<string, string>,
): string | null {
  const joined = path.join(".");
  const known = (
    {
      "CodexStatus.Enabled": "the Book of Shadows to be available",
      "GameState.RoomsEntered.Q_Boss01":
        "entries into Typhon's chamber on Mount Olympus",
      "GameState.RoomsEntered.H_Boss01":
        "entries into the guardian chamber in the Fields of Mourning",
      "GameState.WorldUpgradesAdded.WorldUpgradeSurfacePenaltyCure":
        "completion of Unraveling a Fateful Bond",
      "PrevRun.WorldUpgradesAdded.WorldUpgradeSurfacePenaltyCure":
        "completion of Unraveling a Fateful Bond before the previous night",
      "CurrentRun.Hero.EligiblePrevRunTraits":
        "eligible boons from the previous night",
      "CurrentRun.Hero.LastStands": "remaining Death Defiance uses",
      "CurrentRun.Hero.TraitDictionary": "boons in the current loadout",
      "CurrentRun.Hero.Weapons": "equipped weapon",
      "CurrentRun.Hero.UpgradableHammerCount":
        "acquired Daedalus Hammer upgrades that can be improved",
      "CurrentRun.Hero.Health": "current Health",
      "CurrentRun.CurrentRoom.Name": "current room",
      "CurrentRun.EncounterDepth": "completed encounters this night",
      "CurrentRun.BiomeEncounterDepth":
        "completed encounters in the current region",
      "CurrentRun.EnteredBiomes": "regions entered this night",
      "CurrentRun.BiomeDepthCache": "regions reached this night",
      "CurrentRun.BiomeUseRecord.TalentDrop":
        "a Path of Stars reward in the current region",
      "MapState.FamiliarUnit": "a Familiar accompanying Melinoe",
      "GameState.LifetimeResourcesSpent.MetaFabric": "Fate Fabric spent",
      "GameState.PlayedTrueEnding": "completion of the true ending",
      "GameState.MetaUpgradeCostCache":
        "total Grasp used by active Arcana Cards",
      "GameState.MetaUpgradeLimitLevel": "Grasp capacity",
      "GameState.SpentShrinePointsCache": "Fear",
      "PrevRun.SpecialInteractRecord.Shrine":
        "use of the Oath of the Unseen during the previous night",
      "CurrentRun.Hero.IsDead": "the previous night to have ended",
      "GameState.RoomsEntered.I_Intro": "Tartarus reached",
      "GameState.RoomsEntered.P_Intro": "Mount Olympus reached",
      "GameState.RoomsEntered.Q_Intro": "the Summit reached",
      "GameState.ScreensViewed.BountyBoard": "access to the Pitch-Black Stone",
      "GameState.ScreensViewed.GhostAdmin": "access to the Cauldron",
      "GameState.ScreensViewed.MailboxScreen":
        "access to the Crossroads delivery box",
      "GameState.ScreensViewed.MetaUpgradeCardUpgradeLayout":
        "access to the Arcana upgrade view",
      "GameState.ScreensViewed.WeaponShop": "access to the Silver Pool",
      "GameState.ScreensViewed.MarketScreen": "access to the Wretched Broker",
      "GameState.ScreensViewed.SellTraits": "access to the Pool of Purging",
      "GameState.GiftResourceRecord.GiftPoints": "Nectar gifts given",
      "GameState.ProjectileRecord.ShadeMercSpiritball":
        "attacks fired by recruited Shades",
      "GameState.SpecialInteractRecord.FrogFamiliar": "Frinos interactions",
      "GameState.SpeechRecord./VO/MelinoeField_3553":
        "Tartarus reached with the Aspect of Anubis",
      "GameState.SpeechRecord./VO/MelinoeField_3554":
        "Tartarus reached with the Aspect of the Morrigan",
      "GameState.SpeechRecord./VO/MelinoeField_3555":
        "Tartarus reached with the Aspect of Supay",
      "GameState.SpeechRecord./VO/MelinoeField_3556":
        "Tartarus reached with the Aspect of Nergal",
      "GameState.SpeechRecord./VO/MelinoeField_3557":
        "Tartarus reached with the Aspect of Hel",
      "GameState.SpeechRecord./VO/MelinoeField_3558":
        "Tartarus reached with the Aspect of Shiva",
      "GameState.ClearedFullRunWithKeepsakes.RandomBlessingKeepsake":
        "a full route cleared while carrying the Transcendent Embryo",
      "CurrentRun.Hero.MutePermanent": "Echo's permanent silence effect",
      "CurrentRun.ActiveBounty": "an active Chaos Trial this night",
      "PrevRun.Cleared": "a route clear on the previous night",
      "CurrentRun.PlayedTrueEnding":
        "the true-ending sequence during the current night",
      "PrevRun.WorldUpgradesAdded.WorldUpgradeQuestLog":
        "the Fated List incantation",
      "WorldUpgradesAdded.WorldUpgradeQuestLog": "the Fated List incantation",
    } as Readonly<Record<string, string>>
  )[joined];
  if (known !== undefined) return known;
  const namedRequirement = path.at(-1);
  if (
    namedRequirement !== undefined &&
    namedRequirementNames[namedRequirement] !== undefined
  ) {
    return namedRequirementNames[namedRequirement] as string;
  }
  const textLineIndex = path.indexOf("TextLinesRecord");
  if (textLineIndex >= 0 && path[textLineIndex + 1] !== undefined)
    return eventText(path[textLineIndex + 1] as string, names);
  const speechIndex = path.indexOf("SpeechRecord");
  if (speechIndex >= 0 && path[speechIndex + 1] !== undefined)
    return speechText(path[speechIndex + 1] as string);
  const useIndex = path.indexOf("UseRecord");
  if (useIndex >= 0 && path[useIndex + 1] !== undefined) {
    const id = path[useIndex + 1] as string;
    return `${readableIdentifier(id, names)} obtained at least once`;
  }
  const metaUpgradeIndex = path.indexOf("MetaUpgradeState");
  if (
    metaUpgradeIndex >= 0 &&
    path[metaUpgradeIndex + 1] !== undefined &&
    path.at(-1) === "Unlocked"
  ) {
    return `${readableIdentifier(path[metaUpgradeIndex + 1] as string, names)} revealed`;
  }
  if (
    metaUpgradeIndex >= 0 &&
    path[metaUpgradeIndex + 1] !== undefined &&
    path.at(-1) === "Enabled"
  ) {
    return `${readableIdentifier(path[metaUpgradeIndex + 1] as string, names)} active`;
  }
  const state = path.at(-1);
  if (state !== undefined && stateSubjects[state] !== undefined)
    return stateSubjects[state] as string;
  const collection = path.at(-2);
  const id = path.at(-1);
  if (collection !== undefined && id !== undefined && path.length >= 2) {
    const label = readableIdentifier(id, names);
    const collectionSubject = (
      {
        WorldUpgrades: `completion of ${label}`,
        WorldUpgradesAdded: `completion of ${label}`,
        QuestsCompleted: `completion of ${label}`,
        QuestsViewed: `${label} revealed in the Fated List`,
        WeaponsUnlocked: `${label} unlocked`,
        TraitsTaken: `${label} taken at least once`,
        FamiliarsUnlocked: `${label} recruited`,
        FamiliarUpgrades: `${label} upgrades`,
        EnemyKills: `defeats of ${label}`,
        RoomsEntered: `entries into ${label}`,
        RoomCountCache: `visits to ${label}`,
        BiomeVisits: `visits to ${regionNames[id] ?? label}`,
        EncountersCompletedCache: `completion of ${label}`,
        EncountersOccurredCache: `${label} encountered`,
        LifetimeResourcesGained: `${label} gathered in total`,
        LifetimeResourcesSpent: `${label} spent in total`,
        QuestStatus: `reward status for ${label}`,
        MetaUpgradeState: `${label} revealed`,
        PackagedBountyClears: `${label} completed`,
        ScreensViewed: `${label} opened`,
        GiftResourceRecord: `${label} gifts given`,
        GiftPresentation: `${label} obtained`,
        ProjectileRecord: `${label} projectiles fired`,
        SpecialInteractRecord: `${label} interactions`,
        ShrineBountiesCompleted: `${label} completed`,
        SlottedTraits: `${label} Boon slot filled`,
        ClearedWithWeapons: `route clears recorded with ${label}`,
        ClearedWithAspects: `route clears recorded with ${label}`,
        ClearedWithFamiliars: `route clears recorded with ${label}`,
        ClearedWithMetaUpgrades: `route clears recorded with ${label}`,
      } as Readonly<Record<string, string>>
    )[collection];
    if (collectionSubject !== undefined) return collectionSubject;
  }
  return null;
}

function readablePathRule(
  path: readonly string[],
  comparison: string,
  value: JsonValue | undefined,
  qualifiers: Readonly<Record<string, JsonValue>>,
  names: ReadonlyMap<string, string>,
): string | null {
  if (path[0] === "Function") {
    const functionName = path[1];
    if (functionName === "RequiredHealthFraction") {
      return `Requires Melinoe's current health to be ${comparisonText(comparison, value)} of maximum health.`;
    }
    if (functionName === "RequiredMinRoomsSinceRoom") {
      const room = qualifiers.RoomName ?? qualifiers.Name;
      const count = qualifiers.MinRooms;
      if (typeof room === "string" && typeof count === "number") {
        return `Requires at least ${String(count)} rooms since ${readableIdentifier(room, names)}.`;
      }
    }
    if (functionName === "RequiredMinRoomsSinceEvent") {
      const event = qualifiers.Event;
      const count = qualifiers.Count;
      if (typeof event === "string" && typeof count === "number") {
        const eventName =
          event === "Devotion"
            ? "Family Dispute"
            : readableIdentifier(event, names);
        return `Requires at least ${String(count)} rooms since the previous ${eventName}.`;
      }
    }
    if (
      functionName === "RequiredMinExits" &&
      typeof qualifiers.Count === "number"
    ) {
      return `Requires at least ${String(qualifiers.Count)} exit choices in the current room.`;
    }
    if (functionName === "RequiredAlive") {
      const units = collectionValues(qualifiers.Units).map((unit) =>
        readableIdentifier(String(unit), names),
      );
      if (units.length > 0 && typeof qualifiers.Alive === "boolean") {
        return `Requires ${naturalList(units)} to be ${qualifiers.Alive ? "alive" : "absent or defeated"}.`;
      }
    }
    if (
      functionName === "RequiredNotInStore" &&
      typeof qualifiers.Name === "string"
    ) {
      return `Requires ${readableIdentifier(qualifiers.Name, names)} not to be another option in the current shop.`;
    }
    if (functionName === "HasAnyCirceRemovableShrineUpgrade") {
      return "Requires at least one active Vow rank that Circe is allowed to remove.";
    }
    if (functionName === "HasAllWorldUpgradesRequiringResource") {
      return "Requires every nonrepeatable incantation that uses the offered resource to be complete.";
    }
    throw new Error(
      `Cannot translate static requirement function ${String(functionName)}.`,
    );
  }
  const joined = path.join(".");
  const subject = pathSubject(path, names);
  if (subject === null) return null;
  const useRecordId = path.includes("UseRecord") ? path.at(-1) : undefined;
  if (comparison === "true") {
    if (useRecordId === "HealthFountain")
      return "Use a restorative fountain at least once.";
    if (useRecordId === "BlindBoxLoot")
      return "Choose a Mystery Boon at least once.";
    if (useRecordId?.startsWith("NPC_") === true)
      return `Encounter ${readableIdentifier(useRecordId, names)} at least once.`;
    if (path.includes("EncountersCompletedCache"))
      return `Complete ${readableIdentifier(path.at(-1) ?? "the required encounter", names)} at least once.`;
    if (path.includes("EncountersOccurredCache"))
      return `Encounter ${readableIdentifier(path.at(-1) ?? "the required encounter", names)} at least once.`;
    if (path.includes("RoomCountCache") || path.includes("RoomsEntered"))
      return `Reach ${readableIdentifier(path.at(-1) ?? "the required location", names)} at least once.`;
    return path.includes("TextLinesRecord")
      ? `Requires you to ${subject}.`
      : `Requires ${subject}.`;
  }
  if (comparison === "false") {
    if (joined === "CurrentRun.BiomeUseRecord.TalentDrop") {
      return "Requires no Path of Stars reward already taken in the current region.";
    }
    if (path[0] === "CurrentRun" && path.includes("WorldUpgradesAdded")) {
      return `Available from the next night after ${subject}.`;
    }
    if (joined === "PrevRun.SpecialInteractRecord.Shrine") {
      return "Requires the Oath of the Unseen not to have been used during the previous night.";
    }
    if (joined === "PrevRun.Cleared") {
      return "Requires the previous night not to have ended in a route clear.";
    }
    if (joined === "CurrentRun.ActiveBounty") {
      return "Requires no Chaos Trial to be active this night.";
    }
    if (joined === "CurrentRun.PlayedTrueEnding") {
      return "Requires the current night not to be the true-ending sequence.";
    }
    if (joined === "CurrentRun.Hero.MutePermanent") {
      return "Requires Echo's permanent silence effect not to be active.";
    }
    if (useRecordId === "BlindBoxLoot")
      return "Requires no Mystery Boon to have been chosen yet.";
    if (useRecordId?.startsWith("NPC_") === true)
      return `Requires no previous encounter with ${readableIdentifier(useRecordId, names)}.`;
    if (path.includes("EncountersCompletedCache"))
      return `Requires ${readableIdentifier(path.at(-1) ?? "the required encounter", names)} not to have been completed yet.`;
    if (path.includes("EncountersOccurredCache"))
      return `Requires ${readableIdentifier(path.at(-1) ?? "the required encounter", names)} not to have occurred yet.`;
    if (path[0] === "CurrentRun" && path.includes("TextLinesRecord")) {
      return `Requires you to have ${subject
        .replace(/^complete /u, "completed ")
        .replace(/^accept /u, "accepted ")
        .replace(/^meet /u, "met ")} before the current night.`;
    }
    if (joined === "GameState.PlayedTrueEnding") {
      return "Available only before completing the true ending.";
    }
    return path.includes("TextLinesRecord")
      ? `Must occur before you ${subject}.`
      : `Requires no record of ${subject}.`;
  }
  const countOf = collectionValues(qualifiers.CountOf);
  if (countOf.length > 0) {
    const amount = comparisonText(comparison, value);
    if (path.includes("LootTypeHistory")) {
      return `Take boons from ${amount === "" ? "the listed gods" : amount} of these gods this night: ${countOf.map((entry) => readableIdentifier(String(entry), names)).join(", ")}.`;
    }
    if (path.includes("WeaponsUnlocked")) {
      return `Unlock ${amount === "" ? "the listed weapons" : amount} of these weapons: ${countOf.map((entry) => readableIdentifier(String(entry), names)).join(", ")}.`;
    }
    if (path.includes("TextLinesRecord")) {
      return `Complete ${amount === "" ? "the required" : amount} of these story events: ${countOf.map((entry) => eventText(String(entry), names)).join(", ")}.`;
    }
    if (
      path.some(
        (entry) => entry === "WorldUpgrades" || entry === "WorldUpgradesAdded",
      )
    ) {
      return `Complete ${amount === "" ? "the listed" : amount} of these incantations: ${countOf.map((entry) => readableIdentifier(String(entry), names)).join(", ")}.`;
    }
    return `Requires ${amount === "" ? "the listed entries" : amount} from ${subject}: ${countOf.map((entry) => readableIdentifier(String(entry), names)).join(", ")}.`;
  }
  for (const [field, wording] of [
    ["HasAll", "Requires all of"],
    ["HasAny", "Requires one of"],
    ["HasNone", "Requires none of"],
    ["IsAny", "Must be one of"],
    ["IsNone", "Must not be one of"],
  ] as const) {
    const entries = collectionValues(qualifiers[field]);
    if (entries.length > 0) {
      const labels = [
        ...new Set(
          entries.map((entry) =>
            path.includes("TextLinesRecord")
              ? eventText(String(entry), names)
              : path.includes("SpeechRecord")
                ? speechText(String(entry))
                : readableIdentifier(String(entry), names),
          ),
        ),
      ];
      if (joined === "GameState.LastAwardTrait" && field === "IsNone") {
        return `The previous Keepsake cannot be ${naturalList(labels)}.`;
      }
      if (path.includes("TextLinesRecord")) {
        return `${wording} these story events: ${labels.join(", ")}.`;
      }
      if (path.includes("TraitsTaken")) {
        return `${wording} these boons across any number of nights: ${labels.join(", ")}.`;
      }
      if (path.includes("WeaponsUnlocked")) {
        if (path[0] === "CurrentRun") {
          return field === "HasNone"
            ? `None of these weapons may have been unlocked during the current night: ${labels.join(", ")}.`
            : `${wording} these weapons to have been unlocked during the current night: ${labels.join(", ")}.`;
        }
        return field === "HasAll"
          ? `Unlock all of these weapons: ${labels.join(", ")}.`
          : `${wording} these unlocked weapons: ${labels.join(", ")}.`;
      }
      if (path.includes("TraitDictionary")) {
        return field === "HasNone"
          ? `Requires none of these boons in the current loadout: ${labels.join(", ")}.`
          : `Requires ${field === "HasAll" ? "all" : "one"} of these boons in the current loadout: ${labels.join(", ")}.`;
      }
      if (path.includes("EncountersOccurredCache")) {
        if (field === "HasNone" || field === "IsNone") {
          return `${path[0] === "CurrentRun" ? "Do not encounter" : "Requires no encounter with"} any of these events${path[0] === "CurrentRun" ? " during the current night" : ""}: ${labels.join(", ")}.`;
        }
        return `Encounter ${field === "HasAll" ? "all" : "at least one"} of these events: ${labels.join(", ")}.`;
      }
      if (path.includes("ShrineBountiesCompleted")) {
        return `Complete ${field === "HasAll" ? "all" : "at least one"} of these Testaments first: ${labels.join(", ")}.`;
      }
      if (path.includes("Hero") && path.includes("Weapons")) {
        return field === "HasNone"
          ? `Do not equip any of these weapons: ${labels.join(", ")}.`
          : `Equip ${field === "HasAll" ? "all of" : "one of"} these weapons: ${labels.join(", ")}.`;
      }
      if (
        path.some(
          (entry) =>
            entry === "WorldUpgrades" || entry === "WorldUpgradesAdded",
        )
      ) {
        return field === "HasNone"
          ? `Complete none of these incantations: ${labels.join(", ")}.`
          : `Complete ${field === "HasAll" ? "all" : "one"} of these incantations: ${labels.join(", ")}.`;
      }
      if (path.includes("RoomCountCache")) {
        return field === "HasAll"
          ? `Visit all of these locations at least once: ${labels.join(", ")}.`
          : `${wording} these visited locations: ${labels.join(", ")}.`;
      }
      if (path.includes("RoomsEntered")) {
        return `Enter ${field === "HasAll" ? "all" : "at least one"} of these locations: ${labels.join(", ")}.`;
      }
      if (path.includes("EncountersCompletedCache")) {
        return `Complete ${field === "HasAll" ? "all" : "at least one"} of these encounters: ${labels.join(", ")}.`;
      }
      if (path.includes("FamiliarsUnlocked")) {
        return `Recruit ${field === "HasAll" ? "all" : "at least one"} of these Familiars: ${labels.join(", ")}.`;
      }
      if (path.includes("FamiliarUpgrades")) {
        return `Unlock ${field === "HasAll" ? "all" : "at least one"} of these Familiar upgrades: ${labels.join(", ")}.`;
      }
      if (path.includes("LifetimeResourcesGained")) {
        return `Gather ${field === "HasAll" ? "all" : "at least one"} of these resources: ${labels.join(", ")}.`;
      }
      if (path.includes("UseRecord")) {
        return `Obtain or use ${field === "HasAll" ? "all" : "at least one"} of these rewards: ${labels.join(", ")}.`;
      }
      if (path.includes("CompletedDreamRuns")) {
        return `Complete ${field === "HasAll" ? "all" : "at least one"} of these Chaos Trials: ${labels.join(", ")}.`;
      }
      if (path.includes("SpellSummons")) {
        return `Summon ${field === "HasAll" ? "each" : "at least one"} of these allies with a Hex: ${labels.join(", ")}.`;
      }
      if (path.includes("SpeechRecord")) {
        return `${wording} these observations: ${labels.join(", ")}.`;
      }
      if (path.includes("QuestStatus") && labels.includes("Cashed Out")) {
        const prophecy = readableIdentifier(
          path.at(-1) ?? "the prerequisite prophecy",
          names,
        );
        return field === "IsNone"
          ? `Claim the reward for ${prophecy} before this condition changes.`
          : `Claim the reward for ${prophecy}.`;
      }
      if (path.includes("QuestsCompleted")) {
        return `${wording} these Fated List prophecies to be complete: ${labels.join(", ")}.`;
      }
      if (path.includes("ClearedWithWeapons")) {
        return `${wording} these weapons to have cleared the ${path.at(-1) === "Q" ? "Surface" : "required"} route: ${labels.join(", ")}.`;
      }
      if (path.includes("DreamRunClearedWithWeapons")) {
        return `${wording} these weapons to have cleared a Chaos Trial: ${labels.join(", ")}.`;
      }
      if (path.includes("ClearedWithAspects")) {
        return `${wording} these aspects to have cleared a route: ${labels.join(", ")}.`;
      }
      if (path.includes("ClearedWithFamiliars")) {
        return `${wording} these Familiars to have accompanied a route clear: ${labels.join(", ")}.`;
      }
      if (path.includes("ClearedWithMetaUpgrades")) {
        return `${wording} these Arcana Cards to have been active during an Underworld clear: ${labels.join(", ")}.`;
      }
      if (path.includes("EnemyEliteAttributeKills")) {
        return `${wording} these armored enemy traits to have been defeated: ${labels.join(", ")}.`;
      }
      return `${wording} ${labels.join(", ")} for ${subject}.`;
    }
  }
  const amount = comparisonText(comparison, value);
  if (useRecordId === "HealthFountain")
    return "Use a restorative fountain at least once.";
  if (useRecordId === "BlindBoxLoot")
    return "Choose a Mystery Boon at least once.";
  if (useRecordId?.startsWith("NPC_") === true && typeof value === "number") {
    return `Encounter ${readableIdentifier(useRecordId, names)} at least ${String(value)} times.`;
  }
  if (path.includes("EncountersCompletedCache") && amount !== "") {
    return `Complete ${readableIdentifier(path.at(-1) ?? "the required encounter", names)} ${amount === "at least one" ? "at least once" : amount + " times"}.`;
  }
  if (path.includes("EncountersOccurredCache") && amount !== "") {
    return `Encounter ${readableIdentifier(path.at(-1) ?? "the required encounter", names)} ${amount === "at least one" ? "at least once" : amount + " times"}.`;
  }
  if (
    joined === "CurrentRun.EnteredBiomes" &&
    comparison === ">" &&
    value === 1
  ) {
    return "Enter more than one region this night.";
  }
  if (
    joined === "CurrentRun.BiomeEncounterDepth" &&
    comparison === ">=" &&
    value === 1
  ) {
    return "Complete at least one encounter in the current region.";
  }
  if (typeof qualifiers.SumPrevRuns === "number") {
    if (
      path.includes("WorldUpgradesAdded") &&
      ((comparison === "<=" && value === 0) ||
        (comparison === "<" && value === 1))
    ) {
      return `${subject} must not have occurred during the previous ${String(qualifiers.SumPrevRuns)} nights.`;
    }
    return amount === ""
      ? `Requires ${subject} across the previous ${String(qualifiers.SumPrevRuns)} nights.`
      : `Requires ${amount} ${subject} across the previous ${String(qualifiers.SumPrevRuns)} nights.`;
  }
  if (path.includes("EnemyKills") && amount !== "") {
    const enemy = readableIdentifier(
      path.at(-1) ?? "the required enemy",
      names,
    );
    return value === 1
      ? `Defeat ${enemy} once.`
      : `Defeat ${enemy} ${amount} times.`;
  }
  if (path.includes("LifetimeResourcesGained") && value === 1) {
    const resource = readableIdentifier(
      path.at(-1) ?? "the required resource",
      names,
    );
    return comparison === "<"
      ? `Requires no ${resource} to have been gathered yet.`
      : `Gather ${resource} at least once.`;
  }
  if (
    joined === "GameState.FishingSuccesses" &&
    comparison === ">=" &&
    value === 1
  ) {
    return "Catch at least one fish.";
  }
  if (
    joined === "GameState.FamiliarsUnlocked" &&
    comparison === ">=" &&
    value === 1
  ) {
    return "Recruit at least one Familiar.";
  }
  if (
    joined === "GameState.CompletedRunsCache" &&
    comparison === ">=" &&
    value === 1
  ) {
    return "Complete at least one night.";
  }
  if (
    joined === "GameState.ClearedUnderworldRunsCache" &&
    comparison === ">=" &&
    value === 1
  ) {
    return "Clear the Underworld route at least once.";
  }
  if (
    joined === "GameState.CompletedDreamRunsCache" &&
    comparison === ">=" &&
    value === 1
  ) {
    return "Complete at least one Chaos Trial.";
  }
  if (
    joined === "GameState.StoryResetCount" &&
    comparison === ">=" &&
    value === 1
  ) {
    return "Use Returning to a Real Possibility at the Fountain of the Dead at least once.";
  }
  if (
    path.includes("EncountersOccurredCache") &&
    comparison === ">=" &&
    value === 1
  ) {
    return `Encounter ${readableIdentifier(path.at(-1) ?? "the required event", names)} at least once.`;
  }
  if (
    joined === "CurrentRun.Hero.Health" &&
    comparison === ">=" &&
    typeof value === "number"
  ) {
    return `Have at least ${String(value)} Health.`;
  }
  if (path.includes("BiomeVisits") && comparison === ">" && value === 1) {
    return `Visit ${regionNames[path.at(-1) ?? ""] ?? readableIdentifier(path.at(-1) ?? "the required region", names)} more than once this night.`;
  }
  if (
    joined === "GameState.HighestShrinePointClearUnderworldCache" &&
    comparison === ">=" &&
    typeof value === "number"
  ) {
    return `Clear the Underworld route with at least ${String(value)} Fear.`;
  }
  if (
    joined === "GameState.HighestShrinePointClearSurfaceCache" &&
    comparison === ">=" &&
    typeof value === "number"
  ) {
    return `Clear the Surface route with at least ${String(value)} Fear.`;
  }
  if (
    joined === "GameState.HighestShrinePointClearDreamCache" &&
    comparison === ">=" &&
    typeof value === "number"
  ) {
    return `Clear a Chaos Trial with at least ${String(value)} Fear.`;
  }
  if (
    joined === "GameState.MetaUpgradeCostCache" &&
    comparison === ">" &&
    value === 0
  ) {
    return "Activate at least one Arcana Card.";
  }
  if (joined === "GameState.SpentShrinePointsCache" && amount !== "") {
    return `Use ${amount} Fear.`;
  }
  if (joined === "GameState.MetaUpgradeLimitLevel" && amount !== "") {
    return `Reach ${amount} Grasp capacity.`;
  }
  if (
    joined === "CurrentRun.Hero.UpgradableHammerCount" &&
    comparison === ">=" &&
    value === 1
  ) {
    return "Requires at least one acquired Daedalus Hammer upgrade that can be improved.";
  }
  return amount === ""
    ? `Requires ${subject}.`
    : `Requires ${amount} ${subject}.`;
}

function namedRequirementRule(
  id: string,
  negative: boolean,
  names: ReadonlyMap<string, string>,
): string {
  const explicit = (
    {
      StandardPackageBountyActive: {
        positive: "Requires a standard Chaos Trial to be active this night.",
        negative: "Requires no standard Chaos Trial to be active this night.",
      },
      HecateMissing: {
        positive:
          "Requires Hecate to be absent from the Crossroads during the post-Chronos story interval.",
        negative: "Requires Hecate to be present at the Crossroads.",
      },
      SurfaceBountyLockedByTyphonKill: {
        positive:
          "Requires Surface Chaos Trials to be temporarily locked after defeating Typhon and before completing the true ending.",
        negative:
          "Requires Surface Chaos Trials not to be under the temporary post-Typhon lock.",
      },
    } as Readonly<
      Record<string, Readonly<{ positive: string; negative: string }>>
    >
  )[id];
  if (explicit !== undefined)
    return negative ? explicit.negative : explicit.positive;
  const packageBiome = /^PackageBountyBiome([FGHINOPQ])$/u.exec(id)?.[1];
  if (packageBiome !== undefined) {
    const guardian =
      guardianNames[packageBiome] ??
      `the guardian of ${regionNames[packageBiome] ?? packageBiome}`;
    return negative
      ? `Requires ${guardian} not to have been defeated yet.`
      : `Defeat ${guardian} at least once.`;
  }
  const description = (
    {
      MissingLastStand: "at least one missing Death Defiance use",
      RerollAvailable: "an available reroll",
      StackUpgradeLegal: "a boon that can gain a level",
      HermesUpgradeRequirements:
        "Hermes to have granted his first boon, with no Hermes reward already offered or taken in the current region and no more than one Hermes reward taken this night",
      SpellDropRequirements:
        "Selene's Hexes to be unlocked after meeting Artemis and accepting Selene's first Hex, with no Hex already offered or taken this night and no temporary post-Typhon Surface lock",
      GiftDropLootRequirements:
        "Nectar chamber rewards to be unlocked after at least one completed night and 50 lifetime Bones",
      HammerLootRequirements:
        "Daedalus Hammers unlocked after meeting any four of Poseidon, Demeter, Hestia, Aphrodite, Zeus, or Hephaestus, with no Hammer already taken this night",
      LateHammerLootRequirements:
        "a second Daedalus Hammer after entering the third region this night and taking exactly one earlier Hammer",
      TalentLegal:
        "the Path of Stars unlocked after four Hex pickups, with a Hex active this night and at least one Path upgrade remaining",
      BlindBoxLootRequirements: "the mystery reward system to be available",
      FatesQuestUnlocked:
        "the Fated List unlocked after meeting Moros, receiving his first reward, and completing at least two nights after his first visit",
      ShrineUnlocked:
        "the Oath of the Unseen unlocked after reaching Chronos, completing a route, and either defeating Chronos or advancing past the first story cycle",
      SeleneDuosUnlocked:
        "Selene's Duo blessings unlocked by accepting boons from Hera and Ares and using every standard Hex at least once",
      PackageBountyRandom:
        "All-Random Chaos Trials unlocked after the true ending, 15 Grasp, ten clears of each route, and completion of the weapon, keepsake, Familiar, and Arcana collections",
      TrueFatesQuestUnlocked:
        "the true-ending Fates prophecy unlocked by reaching the true ending and speaking with Moros afterward",
      TrueFatesQuestCanBeCompleted:
        "the true-ending Fates prophecy ready to complete after the required Prometheus, Hecate, Moros, and Chaos follow-up conversations",
      NoRecentFieldNPCEncounter:
        "no recent encounter with another friend in the current region",
      NoRecentNemesisEncounter: "no recent encounter with Nemesis",
    } as Readonly<Record<string, string>>
  )[id];
  const readable = description ?? readableIdentifier(id, names);
  return negative
    ? `Requires ${readable} to be absent.`
    : `Requires ${readable}.`;
}

export function readableStaticConditions(
  conditions: readonly StaticCondition[],
  names: ReadonlyMap<string, string> = emptyNames,
): readonly string[] {
  const rules = conditions.flatMap((condition): readonly string[] => {
    if (
      condition.path[0] === "NamedRequirements" ||
      condition.path[0] === "NamedRequirementsFalse"
    ) {
      const negative = condition.path[0] === "NamedRequirementsFalse";
      return Array.isArray(condition.value)
        ? condition.value.flatMap((entry) => {
            return [namedRequirementRule(String(entry), negative, names)];
          })
        : [];
    }
    const rule = readablePathRule(
      condition.path,
      condition.comparison,
      condition.value,
      condition.qualifiers,
      names,
    );
    if (rule === null)
      throw new Error(
        `Cannot translate static requirement path ${condition.path.join(".")}.`,
      );
    return [rule];
  });
  return [...new Set(rules)];
}

export function readableGodAppearance(
  appearance: StaticGodAppearance,
): readonly string[] {
  if (appearance.godId === "Apollo") {
    return [
      "Apollo is guaranteed after the first combat room of the first night. The first choice is Common rarity and contains Nova Strike, Lucid Gain, and Blinding Rush.",
    ];
  }
  if (appearance.godId === "Zeus") {
    const completedNights = appearance.initialConditions.find(
      (condition) => condition.path.at(-1) === "CompletedRunsCache",
    )?.value;
    const rainLookback = appearance.initialConditions.find(
      (condition) => condition.qualifiers.SumPrevRuns !== undefined,
    )?.qualifiers.SumPrevRuns;
    return [
      `Before his first boon, Zeus is forced through the rainy Erebus state after at least ${String(completedNights ?? 3)} completed nights, provided the previous ${String(rainLookback ?? 4)} nights had no biome-state change. The next eligible Erebus opening guarantees Zeus. After accepting his first boon, he joins the normal Olympian pool.`,
    ];
  }
  if (appearance.godId === "Demeter") {
    return [
      "After accepting Apollo's first boon, Demeter is guaranteed at the start of a later Underworld night until you accept her first boon. Her first-appearance reward has priority over Poseidon's while both remain unseen.",
    ];
  }
  if (appearance.godId === "Poseidon") {
    return [
      "After accepting Apollo's first boon, Poseidon is guaranteed at the start of a later Underworld night until you accept his first boon. Demeter is offered first while neither first appearance is complete.",
    ];
  }
  if (appearance.godId === "Hestia") {
    return [
      "After accepting both Demeter's and Poseidon's first boons, Hestia is guaranteed at the start of a later Underworld night until you accept her first boon.",
    ];
  }
  if (appearance.godId === "Aphrodite") {
    return [
      "After accepting Demeter's, Poseidon's, and Hestia's first boons, Aphrodite is guaranteed at the start of a later Underworld night until you accept her first boon.",
    ];
  }
  if (appearance.godId === "Ares") {
    return [
      "Enter Typhon's chamber on Mount Olympus at least once. Ares is then guaranteed in the first chamber of a later Underworld or Surface night until you accept his first boon.",
    ];
  }
  if (appearance.godId === "Hera") {
    return [
      "Complete Unraveling a Fateful Bond. Starting on the following night, Hera is guaranteed in the first chamber until you accept her first boon.",
    ];
  }
  if (appearance.godId === "Hephaestus") {
    return [
      "Accept Zeus's first boon, then wait through the immediately following night. From the second later night onward, Hephaestus is guaranteed at the start of an Underworld night until you accept his first boon.",
    ];
  }
  if (appearance.godId === "Hermes") {
    return [
      "Accept a Zeus boon and enter Oceanus on two nights. Hermes then appears in person at the start of a later Underworld night and grants his first boon. Later Hermes rewards require that first meeting, cannot repeat in the same biome reward history, and are limited to two offers per night.",
    ];
  }
  if (appearance.godId === "Chaos") {
    return [
      `Accept a Hermes boon, then begin a later night. Chaos Gates have a ${String((appearance.secretDoorChance ?? 0) * 100)}% base chance in eligible rooms, do not appear while the Surface curse is active, and cannot recur within ${String(appearance.minimumRoomsBetweenAppearances ?? 0)} rooms.`,
    ];
  }
  return [
    ...readableStaticConditions(appearance.initialConditions),
    ...readableStaticConditions(appearance.repeatConditions),
  ];
}

export function readableFriendAppearance(
  friend: StaticEncounterFriend,
): readonly string[] {
  const regions = [
    ...new Set(
      friend.appearances.map(
        (appearance) => regionNames[appearance.regionId] ?? appearance.regionId,
      ),
    ),
  ];
  const exactConditions = friend.appearances.flatMap((appearance) =>
    readableStaticConditions(appearance.appearanceConditions),
  );
  if (friend.id === "Echo") {
    return [
      "Echo can appear in a Fields of Mourning story room after you have entered that region's guardian chamber at least once.",
    ];
  }
  return [
    `${friend.displayName} can appear in ${naturalList(regions)}.`,
    ...exactConditions,
  ];
}

export function readableRequirementExpression(
  value: unknown,
  names: ReadonlyMap<string, string> = emptyNames,
): readonly string[] {
  const output: string[] = [];
  const visit = (entry: unknown): void => {
    if (Array.isArray(entry)) {
      entry.forEach(visit);
      return;
    }
    if (typeof entry !== "object" || entry === null) return;
    const record = entry as Readonly<Record<string, unknown>>;
    const consumed = new Set<string>();
    for (const [field, comparison] of [
      ["PathTrue", "true"],
      ["PathFalse", "false"],
      ["Path", typeof record.Comparison === "string" ? record.Comparison : "="],
    ] as const) {
      if (!Array.isArray(record[field])) continue;
      const path = record[field].filter(
        (part): part is string => typeof part === "string",
      );
      const qualifiers = Object.fromEntries(
        [
          "HasAll",
          "HasAny",
          "HasNone",
          "IsAny",
          "IsNone",
          "CountOf",
          "UseLength",
          "SumOf",
          "SumPrevRuns",
        ].flatMap((key) =>
          record[key] === undefined
            ? []
            : [[key, record[key] as JsonValue] as const],
        ),
      );
      const value = record.Value as JsonValue | undefined;
      const rule = readablePathRule(path, comparison, value, qualifiers, names);
      if (rule === null)
        throw new Error(`Cannot translate requirement path ${path.join(".")}.`);
      output.push(rule);
      [
        field,
        "Comparison",
        "Value",
        "HasAll",
        "HasAny",
        "HasNone",
        "IsAny",
        "IsNone",
        "CountOf",
        "UseLength",
        "SumOf",
        "SumPrevRuns",
        "PathFromArgs",
      ].forEach((key) => consumed.add(key));
    }
    for (const [field, negative] of [
      ["NamedRequirements", false],
      ["NamedRequirementsFalse", true],
    ] as const) {
      const values =
        collectionValues(record[field]).length > 0
          ? collectionValues(record[field])
          : [record[field]];
      for (const id of values) {
        if (typeof id !== "string") continue;
        output.push(namedRequirementRule(id, negative, names));
      }
      if (record[field] !== undefined) consumed.add(field);
    }
    if (record.FunctionName === "RequireAllMetaUpgradesAtMaxLevel") {
      output.push(
        "Requires every Arcana Card to be upgraded to its maximum rank.",
      );
      consumed.add("FunctionName");
      consumed.add("FunctionArgs");
    }
    if (record.FunctionName === "RequireGiftTrackProgress") {
      const arguments_ =
        typeof record.FunctionArgs === "object" && record.FunctionArgs !== null
          ? (record.FunctionArgs as Readonly<Record<string, unknown>>)
          : {};
      const anyOf = collectionValues(arguments_.AnyOf ?? arguments_.AnyNPC);
      const minGifts =
        typeof arguments_.MinGifts === "number" ? arguments_.MinGifts : null;
      if (anyOf.length > 0 && minGifts !== null) {
        output.push(
          `Give at least ${String(minGifts)} ${minGifts === 1 ? "gift" : "gifts"} to any one of: ${anyOf.map((id) => readableIdentifier(String(id), names)).join(", ")}.`,
        );
      } else if (arguments_.AnyNPC === true && minGifts !== null) {
        output.push(
          `Give at least ${String(minGifts)} ${minGifts === 1 ? "gift" : "gifts"} to any one character.`,
        );
      } else
        throw new Error(
          "Cannot translate RequireGiftTrackProgress without its character list and gift threshold.",
        );
      consumed.add("FunctionName");
      consumed.add("FunctionArgs");
    }
    if (
      typeof record.FunctionName === "string" &&
      !consumed.has("FunctionName")
    ) {
      throw new Error(
        `Cannot translate requirement function ${record.FunctionName}.`,
      );
    }
    const oneOf = collectionValues(record.OneOf);
    if (oneOf.length > 0) {
      output.push(
        `Choose any 1 of these options: ${oneOf.map((id) => readableIdentifier(String(id), names)).join(", ")}.`,
      );
      ["OneOf", "PriorityChance", "Type"].forEach((key) => consumed.add(key));
    }
    const oneFromEachSet = collectionValues(record.OneFromEachSet)
      .map((set) => collectionValues(set))
      .filter((set) => set.length > 0);
    if (oneFromEachSet.length > 0) {
      const groups = oneFromEachSet.map(
        (set, index) =>
          `group ${String(index + 1)}: ${set.map((id) => readableIdentifier(String(id), names)).join(", ")}`,
      );
      output.push(
        `Choose 1 option from each of these ${String(oneFromEachSet.length)} groups (${String(oneFromEachSet.length)} choices total): ${groups.join(", ")}.`,
      );
      ["OneFromEachSet", "PriorityChance", "Type"].forEach((key) =>
        consumed.add(key),
      );
    }
    const requiredTextLines = collectionValues(record.RequiredTextLines);
    if (requiredTextLines.length > 0) {
      output.push(
        `Requires these story events: ${requiredTextLines.map((id) => eventText(String(id), names)).join(", ")}.`,
      );
      consumed.add("RequiredTextLines");
    }
    if (typeof record.initiallyRevealable === "boolean") {
      const adjacent = collectionValues(record.adjacentCardIds).map((id) =>
        readableIdentifier(String(id), names),
      );
      output.push(
        record.initiallyRevealable
          ? "Available to reveal from the starting Arcana position."
          : `Reveal an adjacent Arcana Card first${adjacent.length > 0 ? `: ${adjacent.join(", ")}` : ""}.`,
      );
      consumed.add("initiallyRevealable");
      consumed.add("adjacentCardIds");
    }
    if (record.Skip === true) {
      output.push("Not offered through the standard selection pool.");
      consumed.add("Skip");
    }
    if (typeof record.MaxDuplicateCount === "number") {
      output.push(
        `Activates automatically when at least ${String(record.RequiredMetaUpgradesMin ?? 1)} regular Card is active and no more than ${String(record.MaxDuplicateCount)} active Cards share the same Grasp cost.`,
      );
      consumed.add("MaxDuplicateCount");
      consumed.add("RequiredMetaUpgradesMin");
    } else if (typeof record.RequiredMetaUpgradesMax === "number") {
      output.push(
        `Activates automatically with ${String(record.RequiredMetaUpgradesMin ?? 0)} to ${String(record.RequiredMetaUpgradesMax)} regular Cards active.`,
      );
      consumed.add("RequiredMetaUpgradesMin");
      consumed.add("RequiredMetaUpgradesMax");
    }
    if (
      record.OtherRowOrColumnEquipped === true &&
      typeof record.CardsRequired === "number"
    ) {
      output.push(
        `Activates automatically when all ${String(record.CardsRequired)} Cards in another complete row or column are active.`,
      );
      ["OtherRowOrColumnEquipped", "CardsRequired", "MetaUpgradeName"].forEach(
        (key) => consumed.add(key),
      );
    }
    if (typeof record.HasCostsThrough === "number") {
      output.push(
        `Activates automatically when at least one regular Card of every Grasp cost from 1 through ${String(record.HasCostsThrough)} is active.`,
      );
      consumed.add("HasCostsThrough");
    }
    if (record.SurroundEquipped === true) {
      output.push(
        "Activates automatically when any surrounding Card is active.",
      );
      consumed.add("SurroundEquipped");
      consumed.add("MetaUpgradeName");
    }
    if (record.SurroundAllEquipped === true) {
      output.push(
        "Activates automatically when all surrounding Cards are active.",
      );
      consumed.add("SurroundAllEquipped");
      consumed.add("MetaUpgradeName");
    }
    if (Array.isArray(record.OrRequirements)) {
      const alternatives = record.OrRequirements.map((entry) =>
        readableRequirementExpression(entry, names),
      )
        .filter((rules) => rules.length > 0)
        .map((rules) => rules.map(alternativeClause).join(" and "));
      if (alternatives.length > 0)
        output.push(
          `Meet one of these conditions: ${alternatives.join(", or ")}.`,
        );
      consumed.add("OrRequirements");
    }
    for (const [field, entry] of Object.entries(record)) {
      if (!consumed.has(field)) visit(entry);
    }
  };
  visit(value);
  return [...new Set(output)];
}

export function publicRequirements(
  value: unknown,
  names: ReadonlyMap<string, string> = emptyNames,
): Readonly<Record<string, unknown>> {
  const rules = readableRequirementExpression(value, names);
  if (hasMeaningfulValue(value) && rules.length === 0) {
    throw new Error(
      "Cannot publish a nonempty requirement expression without a readable rule.",
    );
  }
  return { rules };
}
