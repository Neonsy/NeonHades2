import type { AspectBuildPlan } from "./types.js";

export type SafestAspectPlanSource = Omit<
  AspectBuildPlan,
  "arcanaIds" | "boonReasons" | "familiarId" | "hexId"
> &
  Partial<
    Pick<AspectBuildPlan, "arcanaIds" | "boonReasons" | "familiarId" | "hexId">
  >;

export const safestAspectPlans = {
  AxeArmCastAspect: {
    focuses: ["cast", "special", "omega"],
    boonPriorityOrder: ["cast", "omega", "special", "sprint", "attack"],
    strengths: [
      "Pins the target before the Axe commits to its Omega Special",
      "Keeps Magick recovery ahead of optional damage",
    ],
    weaknesses: [
      "Still needs a stable release window",
      "A missed Cast and Special sequence delays the next safe burst",
    ],
    combatSequence: [
      "Root the priority target inside Cast",
      "Restore enough Magick for the full Omega Special",
      "Release from range and move before the target recovers",
    ],
    primaryBoonIds: [
      "DemeterCastBoon",
      "HeraManaBoon",
      "ApolloSpecialBoon",
      "ApolloSprintBoon",
      "DemeterWeaponBoon",
    ],
    fallbackBoonIds: [
      "ApolloCastBoon",
      "HestiaManaBoon",
      "DemeterSpecialBoon",
      "DemeterSprintBoon",
      "ApolloWeaponBoon",
    ],
    contextRatings: {
      consistency: "A",
      speed: "B",
      safety: "A",
      "high-fear": "A",
    },
    bossConsideration:
      "Release only while the boss remains inside Cast through the detonation window.",
    routeConsideration:
      "Root and ranged release reduce the danger of armored groups on either route.",
  },
  AxePerfectCriticalAspect: {
    focuses: ["attack", "cast", "sprint"],
    boonPriorityOrder: ["attack", "cast", "sprint", "omega", "special"],
    strengths: [
      "Freeze creates clean Axe openings without sacrificing direct Attack scaling",
      "Short strings preserve the aspect buff and the route",
    ],
    weaknesses: [
      "The plan loses damage when attacks continue after the opening closes",
      "Bosses still demand accurate spacing",
    ],
    combatSequence: [
      "Root the group with Cast",
      "Land one or two buffed Attacks from the edge",
      "Sprint out before retaliation and rebuild the clean-hit window",
    ],
    primaryBoonIds: [
      "DemeterWeaponBoon",
      "DemeterCastBoon",
      "ApolloSprintBoon",
      "HeraManaBoon",
      "ApolloSpecialBoon",
    ],
    fallbackBoonIds: [
      "AphroditeWeaponBoon",
      "ApolloCastBoon",
      "DemeterSprintBoon",
      "HestiaManaBoon",
      "DemeterSpecialBoon",
    ],
    contextRatings: {
      consistency: "A",
      speed: "A",
      safety: "A",
      "high-fear": "A",
    },
    bossConsideration:
      "End every string before the next boss hit can remove the clean-hit momentum.",
    routeConsideration:
      "Freeze makes dense rooms safer while the faster Sprint protects open arenas.",
  },
  AxeRallyAspect: {
    focuses: ["attack", "cast", "omega"],
    boonPriorityOrder: ["attack", "cast", "omega", "sprint", "special"],
    strengths: [
      "Controlled groups start Frenzy without chasing scattered enemies",
      "The plan keeps the aspect's sustained damage and recovery together",
    ],
    weaknesses: [
      "Single bosses still offer fewer safe Frenzy triggers",
      "Maintaining Frenzy is never worth trading a full enemy hit",
    ],
    combatSequence: [
      "Root the group before the first broad Attack",
      "Build Frenzy without leaving the Cast area",
      "Spend the active window on the priority target and leave when it ends",
    ],
    primaryBoonIds: [
      "DemeterWeaponBoon",
      "DemeterCastBoon",
      "HeraManaBoon",
      "ApolloSprintBoon",
      "ApolloSpecialBoon",
    ],
    fallbackBoonIds: [
      "ApolloWeaponBoon",
      "ApolloCastBoon",
      "HestiaManaBoon",
      "DemeterSprintBoon",
      "DemeterSpecialBoon",
    ],
    contextRatings: {
      consistency: "S",
      speed: "A",
      safety: "S",
      "high-fear": "A",
    },
    bossConsideration:
      "Use only boss openings that let the Rally window begin without taking the return hit.",
    routeConsideration:
      "Cast control prevents the group density that powers Rally from becoming the main danger.",
  },
  AxeRecoveryAspect: {
    focuses: ["attack", "cast", "sprint"],
    boonPriorityOrder: ["attack", "cast", "sprint", "special", "omega"],
    strengths: [
      "Freeze and the aspect's Life bonus cover the Axe's long recovery",
      "The plan needs no rare synergy or Magick loop",
    ],
    weaknesses: [
      "The final swing remains unsafe without a fully controlled target",
      "Its ceiling stays below the specialized Axe aspects",
    ],
    combatSequence: [
      "Root approaching enemies",
      "Use one or two direct Attacks",
      "Sprint out and reserve the finisher for a confirmed stagger or recovery window",
    ],
    primaryBoonIds: [
      "DemeterWeaponBoon",
      "DemeterCastBoon",
      "ApolloSprintBoon",
      "ApolloSpecialBoon",
      "HeraManaBoon",
    ],
    fallbackBoonIds: [
      "AphroditeWeaponBoon",
      "ApolloCastBoon",
      "DemeterSprintBoon",
      "DemeterSpecialBoon",
      "HestiaManaBoon",
    ],
    contextRatings: {
      consistency: "S",
      speed: "B",
      safety: "S",
      "high-fear": "A",
    },
    bossConsideration:
      "Treat the final swing as optional unless the boss is committed to a long recovery.",
    routeConsideration:
      "The same short-string rule works in cramped Underworld rooms and open Surface arenas.",
  },
  BaseStaffAspect: {
    focuses: ["special", "cast", "omega"],
    boonPriorityOrder: ["special", "cast", "omega", "sprint", "attack"],
    strengths: [
      "Ranged Special pressure stays behind Cast control",
      "Reliable recovery keeps Omega Special available without forcing close range",
    ],
    weaknesses: [
      "Normal Special remains slow before a matching Hammer",
      "Mobile bosses can leave the Cast before the next charged shot",
    ],
    combatSequence: [
      "Root the approach with Cast",
      "Fire Special from outside the enemy response range",
      "Charge Omega Special only while the target remains controlled",
    ],
    primaryBoonIds: [
      "ApolloSpecialBoon",
      "DemeterCastBoon",
      "HeraManaBoon",
      "ApolloSprintBoon",
      "DemeterWeaponBoon",
    ],
    fallbackBoonIds: [
      "DemeterSpecialBoon",
      "ApolloCastBoon",
      "HestiaManaBoon",
      "DemeterSprintBoon",
      "ApolloWeaponBoon",
    ],
    contextRatings: {
      consistency: "S",
      speed: "B",
      safety: "S",
      "high-fear": "S",
    },
    bossConsideration:
      "Keep reaction distance and release Omega Special only into a predictable animation.",
    routeConsideration:
      "Range, Root, and full Magick restoration remain useful in every room shape.",
  },
  StaffClearCastAspect: {
    focuses: ["cast", "special", "omega"],
    boonPriorityOrder: ["cast", "special", "omega", "sprint", "attack"],
    strengths: [
      "Rooted targets stay inside both Cast and familiar pressure",
      "The ranged follow-up avoids trading for familiar damage",
    ],
    weaknesses: [
      "Familiar position can still reduce the aspect payoff",
      "Boss phases without stable Cast uptime lower the extra damage",
    ],
    combatSequence: [
      "Place a rooting Cast where the target will remain",
      "Let the familiar engage while Special attacks from range",
      "Refresh Cast before control and Magick expire",
    ],
    primaryBoonIds: [
      "DemeterCastBoon",
      "ApolloSpecialBoon",
      "HeraManaBoon",
      "ApolloSprintBoon",
      "DemeterWeaponBoon",
    ],
    fallbackBoonIds: [
      "ApolloCastBoon",
      "DemeterSpecialBoon",
      "HestiaManaBoon",
      "DemeterSprintBoon",
      "ApolloWeaponBoon",
    ],
    contextRatings: {
      consistency: "S",
      speed: "B",
      safety: "S",
      "high-fear": "A",
    },
    bossConsideration:
      "Recast after movement phases instead of sending the familiar toward an empty circle.",
    routeConsideration:
      "Dense rooms reward the shared control action without requiring Melinoe to stand beside it.",
  },
  StaffRaiseDeadAspect: {
    focuses: ["attack", "cast", "special"],
    boonPriorityOrder: ["attack", "cast", "special", "sprint", "omega"],
    strengths: [
      "Freeze makes the first kill safer before Shade pressure begins",
      "Ranged Special keeps Melinoe outside the summoned Shade's target",
    ],
    weaknesses: [
      "The aspect still needs a vulnerable first target",
      "Boss-only phases fall back to the normal Staff plan",
    ],
    combatSequence: [
      "Root and focus the weakest foe",
      "Create the first Shade without entering the center of the group",
      "Use ranged Special beside the Shade and repeat from safety",
    ],
    primaryBoonIds: [
      "DemeterWeaponBoon",
      "DemeterCastBoon",
      "ApolloSpecialBoon",
      "ApolloSprintBoon",
      "HeraManaBoon",
    ],
    fallbackBoonIds: [
      "ApolloWeaponBoon",
      "ApolloCastBoon",
      "DemeterSpecialBoon",
      "DemeterSprintBoon",
      "HestiaManaBoon",
    ],
    contextRatings: {
      consistency: "A",
      speed: "B",
      safety: "A",
      "high-fear": "B",
    },
    bossConsideration:
      "Use the rooted ranged Staff loop when no expendable foe can start the Shade cycle.",
    routeConsideration:
      "Prioritize rooms with controllable weaker foes rather than forcing the summon in elite openings.",
  },
  StaffSelfHitAspect: {
    focuses: ["omega", "cast", "special"],
    boonPriorityOrder: ["omega", "cast", "special", "sprint", "attack"],
    strengths: [
      "Full Magick restoration protects the repeating Omega engine",
      "Cast control keeps targets inside stored strikes while Melinoe moves",
    ],
    weaknesses: [
      "Bad repeat placement still wastes the entire cycle",
      "The plan slows when the target leaves both Cast and stored attacks",
    ],
    combatSequence: [
      "Secure full Magick recovery before repeated placements",
      "Root the target and place the chosen Omega on its path",
      "Move away and add ranged Special while the stored strikes repeat",
    ],
    primaryBoonIds: [
      "HeraManaBoon",
      "DemeterCastBoon",
      "ApolloSpecialBoon",
      "ApolloSprintBoon",
      "DemeterWeaponBoon",
    ],
    fallbackBoonIds: [
      "HestiaManaBoon",
      "ApolloCastBoon",
      "DemeterSpecialBoon",
      "DemeterSprintBoon",
      "ApolloWeaponBoon",
    ],
    contextRatings: {
      consistency: "S",
      speed: "A",
      safety: "S",
      "high-fear": "A",
    },
    bossConsideration:
      "Store repeats only after the boss commits to an area long enough to receive them.",
    routeConsideration:
      "Tight rooms simplify stored coverage while Root compensates for open-room movement.",
  },
  DaggerBackstabAspect: {
    focuses: ["attack", "cast", "special"],
    boonPriorityOrder: ["attack", "cast", "special", "sprint", "omega"],
    strengths: [
      "Root creates deliberate backstab windows instead of forcing a chase",
      "The Attack plan keeps direct scaling while adding room control",
    ],
    weaknesses: [
      "Bosses that turn quickly still shorten the safe backstab window",
      "Wave Strike still depends on each splash landing against the intended target",
    ],
    combatSequence: [
      "Root the priority target",
      "Move behind it during the control window",
      "Use a short Attack string and leave before the target can turn",
    ],
    primaryBoonIds: [
      "DemeterWeaponBoon",
      "PoseidonWeaponBoon",
      "DemeterCastBoon",
      "ApolloSpecialBoon",
      "ApolloSprintBoon",
      "HeraManaBoon",
    ],
    fallbackBoonIds: [
      "AphroditeWeaponBoon",
      "ApolloCastBoon",
      "HestiaSpecialBoon",
      "DemeterSprintBoon",
      "HestiaManaBoon",
    ],
    boonReasons: {
      DemeterWeaponBoon:
        "Freeze creates the backstab opening and still scales the direct hit that receives the aspect bonus.",
      PoseidonWeaponBoon:
        "Wave Strike beats Flutter Strike on each 15- or 20-damage opening hit and adds knockback. The five stabs are 0.08 seconds apart, which clears its 0.033-second cooldown, but Demeter remains safer because Freeze creates the backstab window directly.",
    },
    contextRatings: {
      consistency: "A",
      speed: "B",
      safety: "A",
      "high-fear": "A",
    },
    bossConsideration:
      "Take one controlled backstab window and disengage before the boss retargets.",
    routeConsideration:
      "Root protects the flank in crowded rooms while Wave Strike remains an optional room-control alternative.",
  },
  DaggerBlockAspect: {
    focuses: ["attack", "omega", "cast"],
    boonPriorityOrder: ["attack", "cast", "omega", "sprint", "special"],
    strengths: [
      "Freeze creates a charged Attack window before the block is needed",
      "The aspect's guard remains a backup instead of the only defense",
    ],
    weaknesses: [
      "Unknown attack timings still make a deliberate block dangerous",
      "The counter window can end before a long combo finishes",
    ],
    combatSequence: [
      "Root the threat before charging Omega Attack",
      "Block only a response whose timing is known",
      "Use the counter burst and disengage immediately",
    ],
    primaryBoonIds: [
      "DemeterWeaponBoon",
      "DemeterCastBoon",
      "HeraManaBoon",
      "ApolloSprintBoon",
      "ApolloSpecialBoon",
    ],
    fallbackBoonIds: [
      "AphroditeWeaponBoon",
      "ApolloCastBoon",
      "HestiaManaBoon",
      "DemeterSprintBoon",
      "DemeterSpecialBoon",
    ],
    contextRatings: {
      consistency: "A",
      speed: "B",
      safety: "S",
      "high-fear": "A",
    },
    bossConsideration:
      "Use Root to create the charge and reserve the block for the predictable return hit.",
    routeConsideration:
      "Control mixed groups before attempting any parry sequence.",
  },
  DaggerHomingThrowAspect: {
    focuses: ["special", "cast", "omega"],
    boonPriorityOrder: ["special", "cast", "omega", "sprint", "attack"],
    strengths: [
      "Ranged homing volleys remain inside a rooting Cast",
      "The plan spends no melee window to reach its main damage",
    ],
    weaknesses: [
      "The volley loses value when a boss leaves Cast during the charge",
      "Magick recovery is required before repeated full volleys",
    ],
    combatSequence: [
      "Root the target inside Cast",
      "Charge Omega Special from outside its response range",
      "Release, move, and replace Cast after every movement phase",
    ],
    primaryBoonIds: [
      "PoseidonSpecialBoon",
      "DemeterCastBoon",
      "HeraManaBoon",
      "ApolloSprintBoon",
      "DemeterWeaponBoon",
    ],
    fallbackBoonIds: [
      "DemeterSpecialBoon",
      "ApolloCastBoon",
      "HestiaManaBoon",
      "DemeterSprintBoon",
      "ApolloWeaponBoon",
    ],
    contextRatings: {
      consistency: "S",
      speed: "A",
      safety: "S",
      "high-fear": "S",
    },
    bossConsideration:
      "Cancel the charge rather than release after the boss has left the Cast area.",
    routeConsideration:
      "Tracking and range remain reliable in both dense rooms and open arenas.",
  },
  DaggerTripleAspect: {
    focuses: ["attack", "cast", "special"],
    boonPriorityOrder: ["attack", "cast", "special", "omega", "sprint"],
    strengths: [
      "Control gives the ritual sequence a protected start",
      "Direct Attack and Special choices still feed the aspect's full kit",
    ],
    weaknesses: [
      "The ritual remains more interruptible than a single-move plan",
      "Its finisher ignores ordinary Attack modifiers, so core boons support the setup rather than the final strike",
    ],
    combatSequence: [
      "Root the target before the first ritual input",
      "Perform only the setup that fits inside the control window",
      "Trigger the finisher or abandon the cycle before the enemy response",
    ],
    primaryBoonIds: [
      "DemeterWeaponBoon",
      "DemeterCastBoon",
      "ApolloSpecialBoon",
      "HeraManaBoon",
      "ApolloSprintBoon",
    ],
    fallbackBoonIds: [
      "HeraWeaponBoon",
      "ApolloCastBoon",
      "DemeterSpecialBoon",
      "HestiaManaBoon",
      "DemeterSprintBoon",
    ],
    contextRatings: {
      consistency: "B",
      speed: "A",
      safety: "A",
      "high-fear": "A",
    },
    bossConsideration:
      "Start the ritual only inside a boss animation long enough to finish or safely abandon it.",
    routeConsideration:
      "Root keeps armored room threats from interrupting the multi-input setup.",
  },
  LobAmmoBoostAspect: {
    focuses: ["attack", "cast", "special"],
    boonPriorityOrder: ["attack", "cast", "special", "sprint", "omega"],
    strengths: [
      "Root protects both firing and Shell retrieval lines",
      "The plan keeps direct Attack scaling without entering a blind pickup path",
    ],
    weaknesses: [
      "Spent Shells can still land inside hazards",
      "Safe retrieval can lower peak damage uptime",
    ],
    combatSequence: [
      "Root the target before firing Shells",
      "Use Special through a clear retrieval line",
      "Recover only the Shells that do not cross an active enemy attack",
    ],
    primaryBoonIds: [
      "DemeterWeaponBoon",
      "DemeterCastBoon",
      "ApolloSpecialBoon",
      "ApolloSprintBoon",
      "HeraManaBoon",
    ],
    fallbackBoonIds: [
      "HeraWeaponBoon",
      "ApolloCastBoon",
      "DemeterSpecialBoon",
      "DemeterSprintBoon",
      "HestiaManaBoon",
    ],
    contextRatings: {
      consistency: "S",
      speed: "B",
      safety: "S",
      "high-fear": "A",
    },
    bossConsideration:
      "Leave a Shell spent when its retrieval path crosses the boss's next attack.",
    routeConsideration:
      "Root makes cramped retrieval safer and leaves open arenas easy to route.",
  },
  LobCloseAttackAspect: {
    focuses: ["attack", "cast", "sprint"],
    boonPriorityOrder: ["attack", "cast", "sprint", "special", "omega"],
    strengths: [
      "Freeze creates the close detonation window before the Skull commits",
      "Faster Sprint gives the explosion a planned exit",
    ],
    weaknesses: [
      "The aspect still requires melee range",
      "A missed Special leaves the Shell and Melinoe exposed",
    ],
    combatSequence: [
      "Root the priority target",
      "Place the close Attack and trigger it with Special",
      "Sprint out before the explosion window ends",
    ],
    primaryBoonIds: [
      "DemeterWeaponBoon",
      "DemeterCastBoon",
      "ApolloSprintBoon",
      "ApolloSpecialBoon",
      "HeraManaBoon",
    ],
    fallbackBoonIds: [
      "AphroditeWeaponBoon",
      "ApolloCastBoon",
      "DemeterSprintBoon",
      "DemeterSpecialBoon",
      "HestiaManaBoon",
    ],
    contextRatings: {
      consistency: "A",
      speed: "A",
      safety: "A",
      "high-fear": "A",
    },
    bossConsideration:
      "Enter only after Root or a committed boss animation guarantees the Special trigger.",
    routeConsideration:
      "Use Cast to separate one detonation target from crowded room attacks.",
  },
  LobGunAspect: {
    focuses: ["omega", "attack", "cast"],
    boonPriorityOrder: ["omega", "attack", "cast", "sprint", "special"],
    strengths: [
      "Full Magick recovery secures every Overheat setup",
      "Root protects the three-second firing window from ordinary enemies",
    ],
    weaknesses: [
      "Overheat still disables Cast and Omega tools during the firing window",
      "A mobile boss can waste part of the fixed duration",
    ],
    combatSequence: [
      "Restore enough Magick for Omega Special before Overheat",
      "Root the target and spend Omega Special",
      "Fire through the safe window, then move before starting another cycle",
    ],
    primaryBoonIds: [
      "HeraManaBoon",
      "ApolloWeaponBoon",
      "DemeterCastBoon",
      "ApolloSprintBoon",
      "DemeterSpecialBoon",
    ],
    fallbackBoonIds: [
      "HestiaManaBoon",
      "DemeterWeaponBoon",
      "ApolloCastBoon",
      "DemeterSprintBoon",
      "ApolloSpecialBoon",
    ],
    contextRatings: {
      consistency: "A",
      speed: "A",
      safety: "A",
      "high-fear": "A",
    },
    bossConsideration:
      "Delay Overheat until the boss commits to a window that lasts most of its three seconds.",
    routeConsideration:
      "Root prevents room pressure from forcing an early end to the fixed firing window.",
  },
  LobImpulseAspect: {
    focuses: ["special", "omega", "sprint"],
    boonPriorityOrder: ["omega", "special", "sprint", "cast", "attack"],
    strengths: [
      "Recovery keeps the steering move available after every room transition",
      "Sprint and Cast create a safe endpoint before the charge begins",
    ],
    weaknesses: [
      "Steering can still enter an unseen hazard",
      "The safer line can hit fewer targets than the damage-maximizing path",
    ],
    combatSequence: [
      "Restore Magick and choose an empty endpoint",
      "Root enemies along the travel line",
      "Steer Omega Special through the group and finish where Sprint can disengage",
    ],
    primaryBoonIds: [
      "HeraManaBoon",
      "PoseidonSpecialBoon",
      "ApolloSprintBoon",
      "DemeterCastBoon",
      "DemeterWeaponBoon",
    ],
    fallbackBoonIds: [
      "HestiaManaBoon",
      "DemeterSpecialBoon",
      "DemeterSprintBoon",
      "ApolloCastBoon",
      "ApolloWeaponBoon",
    ],
    contextRatings: {
      consistency: "A",
      speed: "B",
      safety: "A",
      "high-fear": "A",
    },
    bossConsideration:
      "Choose the endpoint before charging and cancel when the boss closes that line.",
    routeConsideration:
      "Open Surface arenas offer safer steering while Cast defines lanes in tight rooms.",
  },
  BaseSuitAspect: {
    focuses: ["sprint", "attack", "special"],
    boonPriorityOrder: ["sprint", "attack", "special", "cast", "omega"],
    strengths: [
      "Faster Sprint and Blind create the Coat's attack angle",
      "Attack and seeking Special preserve damage while Melinoe moves",
    ],
    weaknesses: [
      "Splitting upgrades across both moves still lowers the ceiling",
      "Sprint cannot rescue an attack string held through an enemy response",
    ],
    combatSequence: [
      "Sprint through an empty angle and Blind nearby threats",
      "Use a short rooted Attack string",
      "Back away behind seeking Special before repeating",
    ],
    primaryBoonIds: [
      "ApolloSprintBoon",
      "DemeterWeaponBoon",
      "ApolloSpecialBoon",
      "DemeterCastBoon",
      "HeraManaBoon",
    ],
    fallbackBoonIds: [
      "DemeterSprintBoon",
      "ApolloWeaponBoon",
      "DemeterSpecialBoon",
      "ApolloCastBoon",
      "HestiaManaBoon",
    ],
    contextRatings: {
      consistency: "S",
      speed: "A",
      safety: "S",
      "high-fear": "A",
    },
    bossConsideration:
      "Use Sprint to choose the angle before attacking, not after the boss begins its response.",
    routeConsideration:
      "Blind and seeking Special keep the plan stable in both crowded and open rooms.",
  },
  SuitComboAspect: {
    focuses: ["special", "cast", "omega"],
    boonPriorityOrder: ["special", "cast", "omega", "sprint", "attack"],
    strengths: [
      "Root holds targets inside the Special setup",
      "The guarded Omega Attack remains the payoff instead of a panic button",
    ],
    weaknesses: [
      "Poor Special placement still delays the empowered state",
      "The setup must be abandoned when the control window closes",
    ],
    combatSequence: [
      "Root the target before firing the required Special pattern",
      "Charge Omega Attack only while the blasts remain aligned",
      "Spend the empowered sequence and Sprint away before rebuilding",
    ],
    primaryBoonIds: [
      "ApolloSpecialBoon",
      "DemeterCastBoon",
      "HeraManaBoon",
      "ApolloSprintBoon",
      "DemeterWeaponBoon",
    ],
    fallbackBoonIds: [
      "DemeterSpecialBoon",
      "ApolloCastBoon",
      "HestiaManaBoon",
      "DemeterSprintBoon",
      "ApolloWeaponBoon",
    ],
    contextRatings: {
      consistency: "A",
      speed: "A",
      safety: "A",
      "high-fear": "A",
    },
    bossConsideration:
      "Build the blast pattern only during an animation that cannot leave its placement.",
    routeConsideration:
      "Root prevents mixed groups from breaking the setup before the guarded retaliation.",
  },
  SuitHexAspect: {
    focuses: ["omega", "hex", "special"],
    boonPriorityOrder: ["omega", "special", "cast", "sprint", "attack"],
    strengths: [
      "Full Magick restoration keeps the guaranteed Hex cycling",
      "Ranged Special maintains pressure without entering the automatic target area",
    ],
    weaknesses: [
      "Automatic Hex targeting remains less controllable than direct damage",
      "The plan slows when Omega spending stops",
    ],
    combatSequence: [
      "Secure recovery before spending Magick",
      "Cycle safe Omega moves until the Hex fires",
      "Maintain ranged Special and reposition during the vulnerability window",
    ],
    arcanaIds: [
      "BonusHealth",
      "ChanneledCast",
      "LastStand",
      "ManaOverTime",
      "SorceryRegenUpgrade",
    ],
    primaryBoonIds: [
      "HeraManaBoon",
      "ApolloSpecialBoon",
      "DemeterCastBoon",
      "ApolloSprintBoon",
      "DemeterWeaponBoon",
    ],
    fallbackBoonIds: [
      "HestiaManaBoon",
      "DemeterSpecialBoon",
      "ApolloCastBoon",
      "DemeterSprintBoon",
      "ApolloWeaponBoon",
    ],
    contextRatings: {
      consistency: "S",
      speed: "B",
      safety: "S",
      "high-fear": "A",
    },
    bossConsideration:
      "Spend Magick only through moves that leave enough time to react while the Hex chooses its target.",
    routeConsideration:
      "Ranged pressure and frequent Hex cycles reduce the danger of mixed rooms.",
  },
  SuitMarkCritAspect: {
    focuses: ["sprint", "attack", "cast"],
    boonPriorityOrder: ["sprint", "attack", "cast", "special", "omega"],
    strengths: [
      "Faster Sprint and Blind create a safer critical-mark angle",
      "Root keeps the marked target available for the damage window",
    ],
    weaknesses: [
      "A missed mark still wastes the prepared window",
      "Over-sprinting can carry Melinoe beyond the controlled target",
    ],
    combatSequence: [
      "Root the priority target",
      "Sprint through a clear line to prepare the mark",
      "Turn onto the target, spend a short critical string, and leave",
    ],
    primaryBoonIds: [
      "ApolloSprintBoon",
      "DemeterWeaponBoon",
      "DemeterCastBoon",
      "ApolloSpecialBoon",
      "HeraManaBoon",
    ],
    fallbackBoonIds: [
      "DemeterSprintBoon",
      "AphroditeWeaponBoon",
      "ApolloCastBoon",
      "DemeterSpecialBoon",
      "HestiaManaBoon",
    ],
    contextRatings: {
      consistency: "A",
      speed: "A",
      safety: "A",
      "high-fear": "A",
    },
    bossConsideration:
      "Prepare the mark only when the Sprint line also leaves a safe exit.",
    routeConsideration:
      "Root prevents room targets from turning the marked approach into a trade.",
  },
  TorchAutofireAspect: {
    focuses: ["attack", "sprint", "cast"],
    boonPriorityOrder: ["attack", "sprint", "cast", "omega", "special"],
    strengths: [
      "Ranged Attack pressure continues while Sprint protects the orbit",
      "Cast control keeps fast enemies out of the firing path",
    ],
    weaknesses: [
      "Tight rooms still reduce the available orbit",
      "Long firing periods can hide incoming attacks behind damage effects",
    ],
    combatSequence: [
      "Root the fastest threats",
      "Begin firing from the edge and Sprint around the group",
      "Stop the stream before the orbit crosses a hazard or attack line",
    ],
    primaryBoonIds: [
      "ZeusWeaponBoon",
      "ApolloSprintBoon",
      "DemeterCastBoon",
      "HeraManaBoon",
      "DemeterSpecialBoon",
    ],
    fallbackBoonIds: [
      "HestiaWeaponBoon",
      "DemeterSprintBoon",
      "ApolloCastBoon",
      "HestiaManaBoon",
      "ApolloSpecialBoon",
    ],
    contextRatings: {
      consistency: "S",
      speed: "A",
      safety: "S",
      "high-fear": "A",
    },
    bossConsideration:
      "Keep the firing orbit outside the boss's next attack line rather than maximizing uninterrupted uptime.",
    routeConsideration:
      "Root creates room to kite in cramped encounters while open arenas favor the normal orbit.",
  },
  TorchDetonateAspect: {
    focuses: ["attack", "cast", "special"],
    boonPriorityOrder: ["attack", "cast", "special", "sprint", "omega"],
    strengths: [
      "Root holds targets inside the lingering Attack field",
      "The ranged Special triggers the detonation without entering its center",
    ],
    weaknesses: [
      "Early Special still produces a weak detonation",
      "Fast bosses can leave before enough Attacks are placed",
    ],
    combatSequence: [
      "Root the target path",
      "Place several lingering Attacks without crossing the group",
      "Send Special through the field and move before starting another setup",
    ],
    primaryBoonIds: [
      "HestiaWeaponBoon",
      "DemeterCastBoon",
      "ApolloSpecialBoon",
      "ApolloSprintBoon",
      "HeraManaBoon",
    ],
    fallbackBoonIds: [
      "ZeusWeaponBoon",
      "ApolloCastBoon",
      "DemeterSpecialBoon",
      "DemeterSprintBoon",
      "HestiaManaBoon",
    ],
    contextRatings: {
      consistency: "A",
      speed: "A",
      safety: "A",
      "high-fear": "A",
    },
    bossConsideration:
      "Build the field only while the boss remains committed to its current path.",
    routeConsideration:
      "Root makes dense rooms easier to cover without standing beside the detonation.",
  },
  TorchSpecialDurationAspect: {
    focuses: ["attack", "special", "cast"],
    boonPriorityOrder: ["attack", "special", "cast", "sprint", "omega"],
    strengths: [
      "Ranged Attack and extended Special pressure cover the controlled area",
      "The plan needs no close-range trigger or rare setup",
    ],
    weaknesses: [
      "Critical timing remains random",
      "Maintaining both projectile patterns can reduce attention available for positioning",
    ],
    combatSequence: [
      "Root the priority area",
      "Maintain Attack pressure from range and add Special rings",
      "Reposition before refreshing either pattern",
    ],
    primaryBoonIds: [
      "ZeusWeaponBoon",
      "ApolloSpecialBoon",
      "DemeterCastBoon",
      "ApolloSprintBoon",
      "HeraManaBoon",
    ],
    fallbackBoonIds: [
      "HestiaWeaponBoon",
      "DemeterSpecialBoon",
      "ApolloCastBoon",
      "DemeterSprintBoon",
      "HestiaManaBoon",
    ],
    contextRatings: {
      consistency: "S",
      speed: "A",
      safety: "S",
      "high-fear": "A",
    },
    bossConsideration:
      "Refresh the projectile patterns only after moving outside the boss's next line.",
    routeConsideration:
      "Root and persistent range keep the plan stable across both routes.",
  },
  TorchSprintRecallAspect: {
    focuses: ["omega", "sprint", "attack"],
    boonPriorityOrder: ["omega", "sprint", "attack", "cast", "special"],
    strengths: [
      "Recovery and Sprint keep the recalled projectile under control",
      "Root defines the line where the persistent shot should remain",
    ],
    weaknesses: [
      "A poor recall still moves the projectile away from the priority target",
      "Tracking both Melinoe and the shot remains demanding",
    ],
    combatSequence: [
      "Secure recovery and root the target line",
      "Fire Omega Attack through that line",
      "Sprint to recall the shot before either Melinoe or the projectile enters danger",
    ],
    primaryBoonIds: [
      "HeraManaBoon",
      "ApolloSprintBoon",
      "ZeusWeaponBoon",
      "DemeterCastBoon",
      "DemeterSpecialBoon",
    ],
    fallbackBoonIds: [
      "HestiaManaBoon",
      "DemeterSprintBoon",
      "HestiaWeaponBoon",
      "ApolloCastBoon",
      "ApolloSpecialBoon",
    ],
    contextRatings: {
      consistency: "A",
      speed: "A",
      safety: "A",
      "high-fear": "A",
    },
    bossConsideration:
      "Recall early when the boss leaves the projectile line instead of chasing lost uptime.",
    routeConsideration:
      "Cast gives the shot a stable lane in tight rooms while open arenas favor wide recall paths.",
  },
} as const satisfies Readonly<Record<string, SafestAspectPlanSource>>;
