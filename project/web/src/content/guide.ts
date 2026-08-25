import type { SpoilerLevel } from '../lib/publication';
import { guideFacts } from './guide-facts';

export type GuideReference = {
    id: string;
    recordType: string;
};

export type GuideLink = {
    href: string;
    label: string;
};

export type GuideTerm = {
    term: string;
    meaning: string;
};

export type GuideStep = {
    title: string;
    body: string;
    references?: GuideReference[];
    links?: GuideLink[];
};

export type GuideChoice = {
    situation: string;
    choice: string;
    reason: string;
};

export type GuideLoadout = {
    title: string;
    summary: string;
    items: Array<{
        label: string;
        value: string;
        reason: string;
        references?: GuideReference[];
        links?: GuideLink[];
    }>;
};

export type GuideChapter = {
    id: string;
    milestone: string;
    title: string;
    spoilerLevel: SpoilerLevel;
    entry: string;
    objective: string;
    overviewObjective?: string;
    why: string;
    terms?: GuideTerm[];
    learn: string[];
    loadout?: GuideLoadout;
    steps: GuideStep[];
    choices?: GuideChoice[];
    overlap?: GuideStep[];
    fallback: string;
    fallbackLinks?: GuideLink[];
    exit: string[];
};

const reference = (recordType: string, id: string): GuideReference => ({ recordType, id });

export const guideRouteContract = {
    reader: 'A first-time Hades II player with no assumed knowledge of its combat or progression systems.',
} as const;

export const guideMilestones = [
    {
        id: 'begin',
        title: 'Begin well',
        summary: 'Learn the first night before permanent systems compete for attention.',
    },
    {
        id: 'crossroads',
        title: 'Build the foundation',
        summary: 'Turn each return to the Crossroads into permanent progress.',
    },
    {
        id: 'clear',
        title: 'Earn the first clear',
        summary: 'Assemble one reliable run instead of chasing a perfect one.',
    },
    {
        id: 'expand',
        title: 'Open the whole game',
        summary: 'Connect both routes, every weapon, and the full combat setup.',
    },
    {
        id: 'story',
        title: 'Finish the story',
        summary: 'Follow the requirements the game has opened instead of guessing at run counts.',
    },
    {
        id: 'complete',
        title: 'Finish every remaining objective',
        summary: 'Finish challenges, relationships, prophecies, and achievements.',
    },
] as const;

const authoredGuideChapters: GuideChapter[] = [
    {
        id: 'before-the-first-night',
        milestone: 'begin',
        title: 'At the start of the first night',
        spoilerLevel: 'none',
        entry: "A fresh save places Melinoë directly in the first Erebus combat room with the Witch's Staff already equipped. The first night is already underway. You reach the Crossroads only after this attempt ends.",
        objective: 'Use the four actions that keep you safe, clear the opening room, and reach the fixed Apollo offer.',
        why: 'A night is one attempt through a route. You move through combat rooms, choose one reward after each room, and return to the Crossroads when the attempt ends. Early deaths open more conversations and systems. They do not damage the save.',
        terms: [
            {
                term: 'Crossroads',
                meaning:
                    'The safe hub you first reach after the opening night ends. This is where you talk to characters and make permanent upgrades.',
            },
            {
                term: 'Night',
                meaning: 'One attempt through a route. A night ends when Melinoë falls or completes that route.',
            },
            {
                term: 'Room',
                meaning:
                    'One combat or event area during a night. Clear it, take its reward, then choose the next door.',
            },
            {
                term: 'Life and Magick',
                meaning: 'Life is your health. Magick is the blue resource spent by charged Omega actions.',
            },
            {
                term: 'Dash and Sprint',
                meaning:
                    'Press the Dash/Sprint control once for a short burst of movement. Keep holding that same control after the dash to continue into a Sprint.',
            },
            {
                term: 'Salute',
                meaning:
                    'A context action used near characters and certain Crossroads objects. Open Options, then Controls, to see or rebind it. The default is T on a keyboard and left bumper on an Xbox-style controller.',
            },
            {
                term: 'God Mode',
                meaning:
                    'An optional gameplay setting that starts with 20% damage resistance. Each eligible failed night adds 2 percentage points, up to the selected God Mode Limit.',
            },
        ],
        learn: [
            'Attack and Special are the two repeatable actions supplied by the equipped weapon. With the Staff, Attack is close-range and Special travels safely from a distance.',
            'Hold Attack or Special to charge its Omega version. The charge uses Magick and leaves Melinoë exposed, so release it only after creating space.',
            'Cast places a binding circle around Melinoë. Normal enemies inside it cannot move freely, which creates room to attack or leave.',
            'Press A once for a short dash. Keep holding A to Sprint away from an enemy attack line instead of trying to win every exchange.',
        ],
        loadout: {
            title: 'Use this for the first night',
            summary: 'Nothing needs to be assembled yet. Use the starting Staff and practice one short sequence.',
            items: [
                {
                    label: 'Weapon',
                    value: "Witch's Staff",
                    reason: 'It is already equipped and gives you a close Attack plus a safer ranged Special.',
                    references: [reference('mechanics/weapon', 'WeaponStaffSwing')],
                },
                {
                    label: 'Room sequence',
                    value: 'Cast, Special, then Attack only when the lane is clear',
                    reason: 'Cast controls normal foes, Special deals damage from range, and Attack finishes isolated targets.',
                },
                {
                    label: 'Omega rule',
                    value: 'Charge only after Cast has created space',
                    reason: 'Charging without a protected window leaves you standing still inside enemy attack patterns.',
                },
            ],
        },
        steps: [
            {
                title: 'Recognize where the fresh save starts',
                body: 'A fresh save begins in the first room of the Underworld route, not at the Crossroads. Clear this room with the starting Staff. Apollo’s fixed reward appears after the room is cleared.',
            },
            {
                title: 'Use the Staff as two ranges',
                body: 'Tap Attack for quick nearby strikes. Tap Special to fire from farther away. Hold either button only when Cast or an enemy recovery animation gives you time to charge the Omega version.',
                references: [reference('mechanics/weapon', 'WeaponStaffSwing')],
            },
            {
                title: 'Treat Cast as your safety tool',
                body: 'Press Cast as normal enemies approach, then move outside the bright attack shapes they draw on the ground. Strike while the enemies remain inside the circle. Guardians can move through it, but the same habit still creates deliberate spacing.',
            },
            {
                title: 'Spend Magick on purpose',
                body: 'An Omega action is useful when it solves the current enemy group or creates a safe damage window. Do not empty the bar simply because a move can be charged.',
            },
            {
                title: 'Check the Salute control',
                body: 'Open Options, then Controls, and find Salute. Stand near a character or object that shows the Salute prompt, then press the listed control. The binding can be changed, so the Controls screen is authoritative for your setup.',
            },
            {
                title: 'Let the first night teach you',
                body: 'A death is expected progression, not a failed save. Notice which enemy action hit you, which reward you chose, and whether you still had Cast, Sprint, or distance available.',
            },
            {
                title: 'Use God Mode if you want more room to learn',
                body: 'God Mode is available in the gameplay options. It immediately reduces incoming damage by 20%. Each eligible failed night adds another 2 percentage points of resistance, for at most 30 increases and never beyond the selected God Mode Limit. A cleared route, a cleared bounty, or a Surface death caused by the life penalty does not add an increase.',
            },
        ],
        fallback:
            'If the controls feel crowded, use only normal Attack, Special, Cast, and Sprint until each has a clear purpose. Add Omega moves after that basic sequence feels stable.',
        exit: [
            'You cleared the opening room and reached Apollo’s fixed offer.',
            'Attack, Special, Cast, and Sprint have each been used in a room.',
            'Cast has been placed before entering melee range.',
            'You can tell Life from Magick and know that Omega actions spend Magick.',
        ],
    },
    {
        id: 'the-first-night',
        milestone: 'begin',
        title: 'The first night',
        spoilerLevel: 'none',
        entry: 'After the opening combat room, Apollo appears and presents three rectangular Boon choices: Nova Strike, Blinding Rush, and Lucid Gain. Select Nova Strike, the choice labelled as an Attack Boon.',
        objective:
            'Take the fixed Attack boon, repeat one safe Staff sequence, and bring Ashes back if an Ash door appears.',
        why: 'A Boon is a power offered by a god for the current night. The first Apollo offer is fixed. Nova Strike immediately strengthens the normal Staff Attack you already practiced, while the other two choices ask you to build around Sprint or Magick recovery.',
        terms: [
            {
                term: 'Boon',
                meaning: 'A god-given power for the current night. Most Boons disappear when the night ends.',
            },
            {
                term: 'Common rarity',
                meaning: 'The basic version of a Boon. Rarity changes its numbers, not the action it modifies.',
            },
            {
                term: 'Reward door',
                meaning:
                    'The symbol above an exit previews the reward in the next room. Choose a door after taking the current room reward.',
            },
        ],
        learn: [
            'Nova Strike improves normal Attack. It does not require Magick, a second boon, or a status-effect setup.',
            'Ashes return with you after the night. Centaur Hearts add maximum Life for the current night.',
            'Door priorities are conditional. Take survival when the current night is in danger, otherwise take the permanent upgrade you can use next.',
        ],
        loadout: {
            title: 'Take this opening',
            summary:
                'The first Apollo offer is fixed. Choose the option that immediately strengthens the simplest Staff action.',
            items: [
                {
                    label: 'Apollo Boon',
                    value: 'Nova Strike',
                    reason: 'It strengthens the normal Attack you already have, adds no resource cost or setup condition, and asks for no new combat sequence.',
                    references: [reference('mechanics/boon', 'ApolloWeaponBoon')],
                },
                {
                    label: 'How to fight',
                    value: 'Cast, Attack twice, Sprint out',
                    reason: 'Cast holds normal foes in place. Two quick Attacks use the opening. Sprint ends the exchange before they recover.',
                },
                {
                    label: 'First useful door',
                    value: 'Ashes while healthy, a Centaur Heart when survival is slipping',
                    reason: 'Ashes return with you after the night. A Heart is the better choice when low maximum Life is already ending rooms.',
                },
            ],
        },
        steps: [
            {
                title: "Take Apollo's fixed first offer",
                body: "On Apollo's three-choice screen, select Nova Strike. It is the option whose description says that Attack deals more damage in a larger area. The rest of this night can now use one repeatable plan.",
                references: [reference('mechanics/boon', 'ApolloWeaponBoon')],
            },
            {
                title: 'Read the next door by what it solves',
                body: 'The Ashes door uses the Ashes reward icon, the Centaur Heart door uses a heart icon. Take Ashes if they appear and your Life is comfortable. Take a Centaur Heart if ordinary rooms are already draining you.',
                references: [
                    reference('mechanics/run-reward', 'MaxHealthDrop'),
                    reference('mechanics/resource', 'MetaCardPointsCommon'),
                ],
            },
            {
                title: 'Repeat one room sequence',
                body: 'Place Cast under the closest group, use two normal Attacks, then Sprint out before the enemies recover. Use ranged Special until another safe opening appears. Watch for terrain that can help damage enemies, and use it when you can do so safely.',
            },
            {
                title: 'Collect Moly when you see it',
                body: 'Moly is the yellow flower that grows at the edge of some Erebus rooms. It needs no gathering tool: walk up to the plant and use the displayed interaction prompt. Collect the first one you find and bring it back to the Crossroads.',
                references: [reference('mechanics/resource', 'PlantFMoly')],
            },
        ],
        choices: [
            {
                situation: 'Ashes and a Centaur Heart appear together',
                choice: 'Take the Heart if another ordinary room is likely to end the night, otherwise take Ashes.',
                reason: 'The Heart protects the current attempt. Ashes are the permanent reward only when the current Life buffer is already usable.',
            },
            {
                situation: 'A Pom appears after Nova Strike',
                choice: 'Take it when the other door does not add needed Life or permanent progress.',
                reason: 'The Pom strengthens the boon already carrying normal Attack instead of starting a second plan.',
            },
            {
                situation: 'No Ash door appears',
                choice: 'Keep the run and choose immediate survival or Attack support.',
                reason: 'The first return opens permanent progression. Restarting teaches less and delays the Crossroads.',
            },
        ],
        fallback:
            'If normal Attack feels unsafe, hold more distance with Special, use Cast before enemies reach you, and take a Centaur Heart over long-term value. Keep the run even if no Ash door appears.',
        exit: [
            'You chose Nova Strike from the fixed Apollo offer.',
            'You used Cast before the two-Attack exchange.',
            'You returned knowing when to choose Ashes and when to choose a Centaur Heart.',
        ],
    },
    {
        id: 'first-return',
        milestone: 'crossroads',
        title: 'Use the first Crossroads return',
        spoilerLevel: 'progression',
        entry: 'After the first night, Melinoë wakes beside Frinos at the Crossroads. The Altar and Silver Pool are available, but the Cauldron is still being purified. It becomes usable when you return after the second night.',
        objective:
            'Talk to every marked character, use the Altar and Silver Pool, confirm that the Cauldron is unavailable, then begin the second night with one material target.',
        why: 'This return introduces permanent preparation without asking you to use every hub system at once. The locked Cauldron is an expected progression state, not a missing interaction. Leave after the current conversations and upgrades are finished, then use it on the next return.',
        terms: [
            {
                term: 'Dialogue marker',
                meaning:
                    'A speech-bubble symbol above a character. Speak to that character before leaving the Crossroads.',
            },
            {
                term: 'Altar of Ashes',
                meaning:
                    'The stone altar in Melinoë’s room. Spend Ashes here to reveal Arcana Cards and activate cards that fit within Grasp.',
            },
            {
                term: 'Cauldron',
                meaning:
                    'Hecate’s large cauldron. It is still being purified on the first return and becomes usable on the second return, after the second night.',
            },
            {
                term: 'Silver Pool',
                meaning:
                    "The weapon and tool area beside the Training Grounds. You can inspect it now. Its gathering-tool tab opens after Night's Craftwork is brewed later.",
            },
        ],
        learn: [
            'The first return gives you conversations, the Altar of Ashes, the Silver Pool, and the Training Grounds.',
            'The Cauldron is deliberately locked during this visit. Do not wait beside it or search for a hidden purchase.',
            'Leaving the Crossroads begins the second night. The Cauldron becomes usable when that night ends and you return.',
            "The Silver Pool is open now, but gathering tools remain unavailable until Night's Craftwork opens its tool tab.",
        ],
        loadout: {
            title: 'Leave the first return ready for night two',
            summary:
                'Use what is available now. Reserve the first materials for the systems that open on the next return.',
            items: [
                {
                    label: 'Arcana',
                    value: 'Reveal and activate The Sorceress if you returned with 1 Ash',
                    reason: 'It costs 1 Ash and 1 Grasp, and it makes every Omega move charge faster.',
                    references: [reference('mechanics/arcana-card', 'ChanneledCast')],
                },
                {
                    label: 'Plant target',
                    value: "Reserve 1 Moly for Night's Craftwork",
                    reason: 'Moly grows in Erebus and is collected by hand. It is not a reward-door choice.',
                    references: [reference('mechanics/resource', 'PlantFMoly')],
                },
                {
                    label: 'Ash target',
                    value: 'Reserve the next spare Ash for the Crescent Pick',
                    reason: "The Pick costs 1 Ash, but you cannot buy it until Night's Craftwork opens the tool tab.",
                    references: [reference('mechanics/resource', 'MetaCardPointsCommon')],
                },
                {
                    label: 'Second-night setup',
                    value: "Witch's Staff with The Sorceress active",
                    reason: 'Keep the weapon and Attack sequence you just practiced. Add new systems without changing the combat plan at the same time.',
                },
            ],
        },
        steps: [
            {
                title: 'Start with every marked conversation',
                body: 'Begin beside Hecate, the tall masked witch near the glowing Cauldron, then walk near every character with a speech-bubble marker and use the displayed Talk prompt. A conversation can reveal the next system or recipe, so finish these before deciding that nothing is available.',
            },
            {
                title: 'Open the Altar of Ashes',
                body: 'If you have 1 Ash, reveal The Sorceress and make sure it is active. If the first night produced no Ashes, leave the Altar without buying a substitute and prioritize an Ash door next night.',
                references: [reference('mechanics/arcana-card', 'ChanneledCast')],
            },
            {
                title: 'Inspect the Silver Pool without forcing a purchase',
                body: "Enter the Training Grounds and inspect the Silver Pool. Weapons are managed here, but the gathering-tool tab does not exist until Night's Craftwork is brewed. Leave if no available purchase matches the current plan.",
                links: [{ href: '/knowledge/weapons/', label: 'See weapon unlock costs' }],
            },
            {
                title: 'Confirm that the Cauldron is still being purified',
                body: 'The locked interaction is the correct first-return state. You cannot brew an Incantation during this visit. The Cauldron opens when you come back after the second night.',
            },
            {
                title: 'Practice once, then begin the second night',
                body: 'Keep the Staff equipped and rehearse Cast, two normal Attacks, then Sprint. Check once more for marked dialogue, then use the exit in the Training Grounds to begin night two.',
            },
        ],
        fallback:
            'If the first night returned no Ashes or Moly, nothing is broken. Keep the Staff, choose an Ash door when survival is comfortable, collect Moly by hand when it appears, and return after the second night.',
        exit: [
            'Every available character has been spoken to on this return.',
            'The Sorceress is active or 1 Ash is the next named target.',
            'The Altar and Silver Pool have been checked, and the purifying Cauldron has been left for the next return.',
            'The Staff is equipped and the second night has one named material target.',
        ],
    },
    {
        id: 'second-night',
        milestone: 'crossroads',
        title: 'Use the second night to fund the first unlocks',
        spoilerLevel: 'progression',
        entry: 'Leaving the Crossroads after the first return begins the second night. The Cauldron will not become usable during the run. It opens when this attempt ends and you return.',
        objective:
            "Repeat the safe Staff plan, collect 1 Moly for Night's Craftwork, and bring home the next Ash needed for The Sorceress or the Crescent Pick.",
        why: 'This night has a narrow job. Preserve the combat sequence you already know while collecting the two materials that turn the second return into permanent access.',
        terms: [
            {
                term: 'Second night',
                meaning: 'The run that begins when you leave the Crossroads for the first time.',
            },
            {
                term: 'Moly',
                meaning:
                    "A yellow Erebus plant collected by hand inside a room. It is not a reward-door option. Reserve the first one for Night's Craftwork.",
            },
            {
                term: 'Ashes',
                meaning:
                    'A permanent resource shown on reward doors. Ashes reveal Arcana Cards and buy the Crescent Pick once the tool tab opens.',
            },
        ],
        learn: [
            'The Cauldron unlock is tied to returning after this night, not to reaching a certain room during it.',
            'Collect Moly whenever it appears. No gathering tool is required.',
            'Choose an Ash door when current Life and damage are stable enough to keep the run useful.',
            'A failed second night still reaches the correct second-return state.',
        ],
        loadout: {
            title: 'Keep the second night deliberately small',
            summary: 'Do not add a new weapon plan while the first permanent unlocks are still being funded.',
            items: [
                {
                    label: 'Weapon',
                    value: "Witch's Staff",
                    reason: 'Use the same Cast, two-Attack, Sprint sequence from the first night.',
                },
                {
                    label: 'Arcana',
                    value: 'The Sorceress when available',
                    reason: 'Its faster Omega channel supports the starting weapon without changing its inputs.',
                    references: [reference('mechanics/arcana-card', 'ChanneledCast')],
                },
                {
                    label: 'Plant target',
                    value: '1 Moly',
                    reason: "Night's Craftwork costs 1 Moly once the recipe is revealed.",
                    references: [reference('mechanics/resource', 'PlantFMoly')],
                },
                {
                    label: 'Door target',
                    value: 'Ashes after immediate survival',
                    reason: 'Use the first required Ash on The Sorceress, then reserve 1 Ash for the Crescent Pick.',
                    references: [reference('mechanics/resource', 'MetaCardPointsCommon')],
                },
            ],
        },
        steps: [
            {
                title: 'Start with the same safe exchange',
                body: 'Use Cast to hold ordinary enemies, Attack twice through the opening, then Sprint out before the counterattack.',
            },
            {
                title: 'Take an Ash door only when the run can carry it',
                body: 'Choose Ashes when Life is comfortable and the main damage move already works. Choose a Centaur Heart instead when ordinary rooms are still draining too much Life.',
                references: [reference('mechanics/resource', 'MetaCardPointsCommon')],
            },
            {
                title: 'Collect the first Moly you see',
                body: "Walk to the yellow plant and collect it by hand. Moly is a room pickup, not a door reward, and the first one funds Night's Craftwork.",
                references: [reference('mechanics/resource', 'PlantFMoly')],
            },
            {
                title: 'Do not restart for a perfect second night',
                body: 'Keep every useful room and material. Whether the run ends early or reaches a new region, returning to the Crossroads is the required progression step.',
            },
        ],
        choices: [
            {
                situation: 'Ashes or a Centaur Heart',
                choice: 'Take the Heart when ordinary rooms are already threatening the run.',
                reason: 'Reaching more rooms creates more chances to find Moly and permanent rewards.',
            },
            {
                situation: 'A new weapon or the practiced Staff',
                choice: 'Keep the Staff for this night.',
                reason: 'The run is funding access. It does not need a second weapon-learning problem.',
            },
        ],
        fallback:
            'If Moly does not appear, finish the night anyway and keep it as the next collection target. If no safe Ash door appears, preserve the run and fund the missing Ash later.',
        exit: [
            'The second night has ended and Melinoë has returned to the Crossroads.',
            "One Moly is reserved for Night's Craftwork, or Moly remains the next named room pickup.",
            'The Sorceress is active or its Ash cost is still the first permanent target.',
            'The Staff sequence remains familiar enough to use on the next run.',
        ],
    },
    {
        id: 'second-return',
        milestone: 'crossroads',
        title: 'Open the Cauldron on the second return',
        spoilerLevel: 'progression',
        entry: 'After the second night, Melinoë returns to a Crossroads where the Cauldron is now usable. This is the first visit on which Incantations can be inspected and brewed.',
        objective:
            "Check the limited Cauldron reveal queue, brew Night's Craftwork when it is visible and affordable, then unlock the Crescent Pick from the Silver Pool tool tab.",
        why: 'The Cauldron and the tool tab are a dependency chain. The second return opens the Cauldron, but the tool tab opens only after the correct Incantation is purchased.',
        terms: [
            {
                term: 'Incantation',
                meaning:
                    'A permanent Cauldron recipe that opens a service, rule, route feature, or other lasting change.',
            },
            {
                term: 'Reveal queue',
                meaning:
                    'The ordered set of eligible Incantations the Cauldron can reveal. Only a limited number appear per night, so an eligible recipe can be delayed.',
            },
            {
                term: 'Tool tab',
                meaning: "The Silver Pool section that appears after Night's Craftwork is brewed.",
            },
        ],
        learn: [
            'The Cauldron is available from the second return onward.',
            guideFacts.incantations.revealPolicy,
            "Night's Craftwork costs 1 Moly. It opens the gathering-tool tab at the Silver Pool.",
            'The Crescent Pick costs 1 Ash after the tool tab opens and lets you mine Silver during later nights.',
            'The Tablet of Peace costs 4 Silver and gathers Psyche from Lost Shades. Psyche is not a normal chamber-door reward.',
        ],
        loadout: {
            title: 'Follow the first access chain in order',
            summary:
                'Each purchase creates the next resource source. Do not skip ahead to a cost whose source is still locked.',
            items: [
                {
                    label: 'Cauldron',
                    value: "Night's Craftwork for 1 Moly",
                    reason: 'Buy it when revealed. Earlier eligible recipes can delay when it appears.',
                    references: [reference('mechanics/incantation', 'WorldUpgradeToolsShop')],
                },
                {
                    label: 'Silver Pool',
                    value: 'Crescent Pick for 1 Ash',
                    reason: "The Pick appears in the tool tab after Night's Craftwork is complete.",
                    references: [reference('mechanics/gathering-tool', 'ToolPickaxe')],
                },
                {
                    label: 'Next nights',
                    value: 'Mine 4 Silver',
                    reason: 'Four Silver funds the Tablet of Peace after the Pick has made ore collectible.',
                    references: [reference('mechanics/resource', 'OreFSilver')],
                },
                {
                    label: 'Then',
                    value: 'Tablet of Peace',
                    reason: 'Compel Lost Shades to gather Psyche for Grasp increases.',
                    references: [reference('mechanics/gathering-tool', 'ToolExorcismBook')],
                },
            ],
        },
        steps: [
            {
                title: 'Repeat every marked conversation first',
                body: 'Speak to each marked character before judging what is missing. Conversations can satisfy another system or recipe condition.',
            },
            {
                title: 'Open the Cauldron and read every visible recipe',
                body: `This is the first return on which the Cauldron can be used. ${guideFacts.incantations.revealPolicy}`,
            },
            {
                title: "Brew Night's Craftwork when it appears",
                body: 'Spend 1 Moly. If the recipe is absent, do not farm an invented prerequisite. An earlier eligible recipe may still be ahead of it in the reveal queue.',
                references: [reference('mechanics/incantation', 'WorldUpgradeToolsShop')],
            },
            {
                title: 'Return to the Silver Pool after brewing',
                body: 'Open the new tool tab and buy the Crescent Pick for 1 Ash. If the Ash is missing, keep the recipe complete and make 1 Ash the next door target.',
                references: [reference('mechanics/gathering-tool', 'ToolPickaxe')],
            },
            {
                title: 'Name the next resource source before leaving',
                body: 'Use the Pick on later nights until four Silver funds the Tablet of Peace. The Tablet, not a door, begins repeatable Psyche gathering.',
                references: [reference('mechanics/gathering-tool', 'ToolExorcismBook')],
            },
        ],
        choices: [
            {
                situation: "Night's Craftwork is not visible",
                choice: 'Finish conversations, begin another night, and recheck on the next return.',
                reason: 'The fixed reveal queue can delay an eligible recipe without adding a hidden material requirement.',
            },
            {
                situation: "Night's Craftwork is visible but Moly is missing",
                choice: 'Keep 1 Moly as the next room-pickup target.',
                reason: 'The recipe is already known. More unrelated spending does not unlock its material.',
            },
            {
                situation: 'The tool tab is open but 1 Ash is missing',
                choice: 'Choose a safe Ash door on the next night.',
                reason: 'The Crescent Pick is the next purchase that creates a new resource source.',
            },
        ],
        fallback:
            "If the queue delays Night's Craftwork, keep using the Altar and the practiced Staff while another night advances the reveal pass. Do not treat the missing recipe as a reason to restart the save.",
        fallbackLinks: [{ href: '/knowledge/incantations/', label: 'Check Incantation availability' }],
        exit: [
            'Every marked conversation has been completed on this return.',
            "Night's Craftwork is complete, visible with 1 Moly reserved, or waiting on a known reveal pass.",
            'The Crescent Pick is unlocked or 1 Ash is the next named door target.',
            'The next night has one exact material target and a known way to collect it.',
        ],
    },
    {
        id: 'first-permanent-choices',
        milestone: 'crossroads',
        title: 'Buy the foundation, not the whole shop',
        spoilerLevel: 'progression',
        entry: 'The Cauldron and gathering-tool chain are available, so Ashes, Psyche, Silver, plants, and Bones now compete for several permanent purchases.',
        objective:
            'Build the cheapest Arcana setup that adds survival, then fund only the Grasp and weapon purchases that support the next clear attempt.',
        why: 'Early resources are most valuable when they improve every future night or reveal a system that produces more resources.',
        learn: [
            'Revealing a card and having enough Grasp to activate it are separate costs.',
            'A resource reserve is for the next named purchase, not an arbitrary pile.',
            'The next required card or Grasp increase is worth more than an unrelated side build.',
        ],
        loadout: {
            title: 'Reveal this path, then build the Arcana foundation',
            summary:
                'Reveal The Wayward Son as a three-Ash bridge to Persistence. Activate only the cards that fit the planned board, and put Psyche toward Grasp when the next card does not fit.',
            items: [
                {
                    label: 'First',
                    value: 'The Sorceress',
                    reason: 'It is available from the starting Arcana position, costs one Ash and one Grasp, and shortens every Omega channel by 20%.',
                    references: [reference('mechanics/arcana-card', 'ChanneledCast')],
                },
                {
                    label: 'Bridge',
                    value: 'The Wayward Son',
                    reason: 'Reveal it for three Ashes to open the path to Persistence. Its room-to-room healing is useful early, but it does not need to remain active in the final board.',
                    references: [reference('mechanics/arcana-card', 'HealthRegen')],
                },
                {
                    label: 'Foundation',
                    value: 'Persistence',
                    reason: 'It adds Life and Magick before the night begins and costs two Grasp.',
                    references: [reference('mechanics/arcana-card', 'BonusHealth')],
                },
                {
                    label: 'Safety',
                    value: 'Death',
                    reason: "Its Death Defiance is this route's next safety layer while guardians and their attack patterns are still unfamiliar.",
                    references: [reference('mechanics/arcana-card', 'LastStand')],
                },
                {
                    label: 'Then',
                    value: 'The Unseen',
                    reason: 'Add it when the complete twelve-Grasp board fits and Omega Special has become the main damage source.',
                    references: [reference('mechanics/arcana-card', 'ManaOverTime')],
                },
            ],
        },
        steps: [
            {
                title: 'Use the first Ashes on The Sorceress',
                body: 'The card costs one Ash and one Grasp. It improves every charged move while you learn which Omega action deserves regular use.',
                references: [reference('mechanics/arcana-card', 'ChanneledCast')],
            },
            {
                title: 'Reveal The Wayward Son to reach Persistence',
                body: 'The Wayward Son costs three Ashes and is adjacent to The Sorceress and Persistence. Reveal it as the bridge for this path. Activate it for early room-to-room healing only when its one-Grasp cost fits.',
                references: [reference('mechanics/arcana-card', 'HealthRegen')],
            },
            {
                title: 'Reveal and activate Persistence',
                body: 'Once The Wayward Son has opened its adjacent position, reveal Persistence. It adds maximum Life and Magick for two Grasp and gives immediate value before the run offers any reward.',
                references: [reference('mechanics/arcana-card', 'BonusHealth')],
            },
            {
                title: 'Add Death when its path opens',
                body: 'Death grants a Death Defiance and is worth its four Grasp while guardians are still unfamiliar. Remove it later only when another card has a clearer job in the current build.',
                references: [reference('mechanics/arcana-card', 'LastStand')],
            },
            {
                title: 'Raise Grasp before buying side cards',
                body: "Your first Grasp increase costs 30 Psyche and adds two capacity. Psyche is not a normal chamber-door reward. Compel Lost Shades with the Tablet of Peace, buy 5 Psyche from the Wretched Broker for 30 Bones, or accept a reward that explicitly grants Psyche, such as Narcissus's Mystic Secrets. Fund only the next Grasp increase your planned cards need.",
                references: [
                    reference('mechanics/grasp-progression', 'Grasp'),
                    reference('mechanics/resource', 'MemPointsCommon'),
                    reference('mechanics/gathering-tool', 'ToolExorcismBook'),
                    reference('mechanics/market-offer', 'MarketScreen_Resources:1:2:MemPointsCommon'),
                    reference('mechanics/encounter-aid', 'NarcissusD'),
                ],
            },
            {
                title: 'Use the exact upgrade tables before spending',
                body: 'Arcana Cards show every rank cost and changed stat. Keepsakes show all three ranks and the chamber thresholds that raise them. Weapon Aspects show every forge cost and value from Rank I through Rank V. Boons separate rarity from Pom levels, including fixed, minimum, maximum, and weapon-dependent values. Grasp, Familiar bonds, gathering tools, Oath conditions, Hex Paths, and Incantations list their own costs and exact effects. Open the matching reference before committing a rare resource.',
                links: [
                    { href: '/knowledge/arcana/', label: 'Arcana ranks' },
                    { href: '/knowledge/records/arcana/grasp/', label: 'Grasp capacity' },
                    { href: '/knowledge/keepsakes/', label: 'Keepsake ranks' },
                    { href: '/knowledge/builds/', label: 'Aspect ranks' },
                    { href: '/knowledge/boons/', label: 'Boon rarity and Pom levels' },
                    { href: '/knowledge/familiars/', label: 'Familiar bonds' },
                    { href: '/knowledge/resources/', label: 'Tool upgrades' },
                    { href: '/knowledge/oath/', label: 'Oath ranks' },
                    { href: '/knowledge/hexes/', label: 'Hex Path upgrades' },
                    { href: '/knowledge/incantations/', label: 'Incantation costs' },
                ],
            },
            {
                title: 'Unlock the Sister Blades when one Silver is spare',
                body: 'They are the cheapest first weapon expansion. Do not abandon the Staff mid-progression unless the Blades immediately feel safer or solve a current prophecy.',
                references: [reference('mechanics/weapon', 'WeaponDagger')],
            },
        ],
        choices: [
            {
                situation: 'The next card is still hidden',
                choice: 'Take Ashes.',
                reason: 'Ashes reveal it. More Grasp cannot activate a card you have not revealed.',
            },
            {
                situation: 'The next card is visible but will not fit',
                choice: 'Fund the Grasp increase with Psyche.',
                reason: 'Compel Lost Shades with the Tablet of Peace, buy Psyche from the Wretched Broker, or accept a reward that explicitly grants it. Psyche does not appear as a normal chamber-door reward.',
            },
            {
                situation: 'A cosmetic competes with a progression recipe',
                choice: 'Keep the materials for the progression recipe.',
                reason: 'A system-opening recipe creates new progress. A cosmetic does not.',
            },
        ],
        fallback:
            'If three Ashes are not available for The Wayward Son, keep The Sorceress active and save for that bridge. Increase Grasp only when a chosen active card needs it, and follow adjacent-card reveal requirements from the Arcana reference.',
        fallbackLinks: [{ href: '/knowledge/arcana/', label: 'Open the Arcana reference' }],
        exit: [
            'The Sorceress is active.',
            'Persistence is active or is the next funded reveal.',
            'The next Grasp increase has a named Psyche source and a specific card to make room for.',
            'Every saved rare resource has a named planned use.',
        ],
    },
    {
        id: 'productive-night-loop',
        milestone: 'clear',
        title: 'Make every night productive',
        spoilerLevel: 'progression',
        entry: 'You can now repeat nights, carry permanent materials home, and begin offering Nectar to eligible characters before starting the next attempt.',
        objective:
            'Use one pre-run, in-run, and post-run routine until ordinary rooms stop draining the resources needed for guardians.',
        why: 'Reliable repetition advances resources, conversations, Keepsakes, and new objectives even when the final encounter remains out of reach.',
        learn: [
            "Choose the door that repairs the build's current failure. There is no universal reward order.",
            'A god Keepsake is valuable before its required Boon appears and may become inactive after its job is complete.',
            'One focused build survives imperfect offers better than several half-built ideas.',
            "The first accepted Nectar usually awards that character's Keepsake. Later gifts deepen the relationship. They do not rank the Keepsake.",
            'Apollo opens the first night. Demeter and Poseidon can follow. Hestia requires both, and Aphrodite requires all three.',
            'Nemesis is a later encounter. When she reaches the exits, choose promptly: she can take a door before you do.',
        ],
        loadout: {
            title: 'Use this until the first clear',
            summary:
                'This route keeps the starting Staff because its ranged Special preserves reaction time and asks for no weapon unlock or aspect mechanic.',
            items: [
                {
                    label: 'Weapon',
                    value: "Witch's Staff",
                    reason: 'Its ranged Special works without another unlock or narrow condition.',
                },
                {
                    label: 'Arcana',
                    value: 'The Sorceress, Persistence, Death, then The Unseen',
                    reason: 'Keep this order when Grasp is short. The full board needs twelve Grasp.',
                },
                {
                    label: 'Main move',
                    value: 'Special and Omega Special',
                    reason: 'Cast to control the lane, fire Special from range, and charge Omega Special only when the lane stays clear.',
                },
                {
                    label: 'First Boon target',
                    value: 'Nova Flourish',
                    reason: 'Apollo strengthens the exact move carrying this plan. Lucid Gain is the next target when Omega Special drains Magick.',
                    references: [
                        reference('mechanics/boon', 'ApolloSpecialBoon'),
                        reference('mechanics/boon', 'ApolloManaBoon'),
                    ],
                },
            ],
        },
        steps: [
            {
                title: 'Use the first Nectar for a Keepsake you understand',
                body: "At the Crossroads, approach an eligible character while carrying Nectar and use the Gift prompt before starting the night. The first accepted Nectar usually awards that character's Keepsake. You do not need to keep gifting the same character yet.",
                references: [reference('mechanics/resource', 'GiftPoints')],
                links: [{ href: '/knowledge/relationships/', label: 'Learn how gifts and relationship locks work' }],
            },
            {
                title: 'Before the night',
                body: "Equip the Witch's Staff. Use The Sorceress, Persistence, and Death, adding The Unseen when twelve Grasp fits. Equip Harmonic Photon after Apollo's first gift unlocks it. Until then, use Luckier Tooth if you have earned it, or another still-active Keepsake that protects the current run.",
                references: [
                    reference('mechanics/keepsake', 'ForceApolloBoonKeepsake'),
                    reference('mechanics/keepsake', 'ReincarnationKeepsake'),
                ],
            },
            {
                title: 'In the opening region',
                body: 'Take Nova Flourish first. Take Lucid Gain next. If Apollo does not supply Nova Flourish, use Volcanic Flourish or Wave Flourish and keep the same Special-led plan.',
                references: [
                    reference('mechanics/boon', 'ApolloSpecialBoon'),
                    reference('mechanics/boon', 'HephaestusSpecialBoon'),
                    reference('mechanics/boon', 'PoseidonSpecialBoon'),
                ],
            },
            {
                title: 'Let the early god pool open in order',
                body: 'Apollo begins the chain. After meeting him, accept Demeter and Poseidon when they appear. Hestia becomes eligible after both, and Aphrodite after Demeter, Poseidon, and Hestia. A missing god may be progression-gated rather than bad luck.',
                references: [
                    reference('mechanics/god', 'ApolloUpgrade'),
                    reference('mechanics/god', 'DemeterUpgrade'),
                    reference('mechanics/god', 'PoseidonUpgrade'),
                    reference('mechanics/god', 'HestiaUpgrade'),
                    reference('mechanics/god', 'AphroditeUpgrade'),
                ],
            },
            {
                title: 'Choose promptly when Nemesis reaches the exits',
                body: 'Nemesis can take a visible door before you do. Read the available rewards as soon as combat ends and choose the door that solves the run’s current need instead of waiting beside the exits.',
                references: [reference('world-progression/encounter-friend', 'Nemesis')],
            },
            {
                title: 'After the main damage move works',
                body: 'Take Rapid Moonshot, Shimmering Moonshot, or Dual Moonshot when offered. Otherwise level the Special Boon, add maximum Life, or take a permanent resource tied to the next purchase.',
                references: [
                    reference('mechanics/hammer-upgrade', 'StaffFastSpecialTrait'),
                    reference('mechanics/hammer-upgrade', 'StaffJumpSpecialTrait'),
                    reference('mechanics/hammer-upgrade', 'StaffTripleShotTrait'),
                ],
            },
            {
                title: 'At a Keepsake cabinet',
                body: `${guideFacts.harmonicPhoton.switchCondition} Replace Luckier Tooth after its Last Stand has triggered. Keep a still-active defensive effect when it addresses the next region.`,
            },
            {
                title: 'After the night',
                body: "Speak to everyone, inspect the Cauldron, spend on one permanent priority, then choose the next night's target.",
            },
        ],
        choices: [
            {
                situation: 'Hammer or Boon before the main damage slot is filled',
                choice: 'Take the Boon for the move you use most unless the Hammer directly improves that move.',
                reason: 'Hammers reshape weapon behavior, but they do not fill Attack, Special, Cast, Sprint, or Magick slots.',
            },
            {
                situation: 'Hammer or Boon after the main damage move works',
                choice: 'Take the compatible Hammer.',
                reason: 'A second Hammer can appear only later in the route, while more Boon opportunities remain. Take the compatible weapon upgrade now instead of assuming the same choice will return.',
            },
            {
                situation: 'Centaur Heart or speculative synergy',
                choice: 'Take the Heart when survival is not stable.',
                reason: 'Twenty-five maximum Life creates immediate error tolerance for every remaining room.',
            },
        ],
        overlap: [
            {
                title: 'Let new objectives share a useful night',
                body: 'Try a new Boon, Hammer, weapon, or gift when it does not break the run. Do not reroute a clear-ready build only to fill an optional objective.',
            },
            {
                title: 'Give early Nectar for Keepsakes',
                body: "A first accepted gift usually earns a Keepsake. Spread early Nectar across useful first rewards. Do not spend repeated Nectar on one character until the Book of Shadows shows that character's next relationship step.",
                links: [{ href: '/knowledge/relationships/', label: 'Open the relationship guide' }],
            },
        ],
        fallback:
            'If the preferred god does not appear, take a compatible Boon for the same move. A reliable option available now is better than leaving the slot empty for a perfect offer that may never arrive.',
        exit: [
            'Every active Arcana Card and Keepsake has a named job for the next night.',
            'The next reward is chosen for survival, the main damage move, or a permanent target.',
            'A failed night still advances a named permanent target.',
        ],
    },
    {
        id: 'tools-incantations-fated-list',
        milestone: 'crossroads',
        title: 'Open the systems that prevent wasted runs',
        spoilerLevel: 'progression',
        entry: 'You are repeating useful nights and early Cauldron recipes are appearing.',
        objective:
            'Unlock resource detection, gathering, the Broker, the garden, the Fated List, and useful wells before convenience purchases.',
        why: 'These systems turn rooms and returns you already make into materials, objectives, and recovery options.',
        learn: [
            'A recipe can require both a prior incantation and an observed game event.',
            guideFacts.incantations.revealPolicy,
            'Conversations and recipes are conditional. A missing next step can mean another run, encounter, or conversation is required. It does not prove that a resource cost is missing.',
            'Fish cannot be sold until Deathly Fortune is complete.',
            'The Fated List appears through a recipe and subsequent story timing, so its first recipe is the start of the chain.',
        ],
        steps: [
            {
                title: 'Read the Cauldron as a reveal queue, not a complete catalogue',
                body: `${guideFacts.incantations.revealPolicy} Talk to newly available characters after each return because conversations and observed events can satisfy another condition. You do not need to complete every earlier recipe merely to reveal a later eligible one.`,
                references: [reference('mechanics/incantation', 'WorldUpgradeQuestLog')],
            },
            {
                title: 'Brew Reagent Sensing',
                body: "After Night's Craftwork is complete, the Crescent Pick is unlocked, and five Silver have been gathered in total, spend one Moly on Reagent Sensing. Its markers reduce the chance that ore, plants, shade points, and other gathering opportunities are missed during a route.",
                references: [reference('mechanics/incantation', 'WorldUpgradeResourceFinder')],
            },
            {
                title: 'Brew Fated Intervention',
                body: 'Spend two Ashes, one Silver, and two Moly on this initial Cauldron recipe. It begins the Fated List chain. Continue speaking with Moros and rechecking the Cauldron until the List itself is established.',
                references: [reference('mechanics/incantation', 'WorldUpgradeQuestLog')],
            },
            {
                title: 'Summon the Wretched Broker',
                body: 'Spend ten Bones on Summoning of Mercantile Fortune. It creates the permanent Bones exchange. Use that exchange to solve planned shortages, not to liquidate rare materials without a target.',
                references: [reference('mechanics/incantation', 'WorldUpgradeMarket')],
            },
            {
                title: 'Open the garden after gathering six Moly in total',
                body: 'Once the lifetime total reaches six Moly, spend one Moly on Flourishing Soil. It creates two plots and grants one Nightshade Seed. Plant for the next known recipe instead of filling every plot with the same crop.',
                references: [reference('mechanics/incantation', 'WorldUpgradeGarden')],
            },
            {
                title: 'Use Forget-Me-Not as a resource lead',
                body: 'After unlocking Forget-Me-Not, pin an unfinished purchase. A small Forget-Me-Not symbol can appear on a visible reward door when that room advertises, or can yield, a resource still needed by a pinned non-Boon purchase. It is a lead, not a guarantee. Some resource sources are not marked.',
                references: [reference('mechanics/incantation', 'WorldUpgradePinning')],
            },
            {
                title: 'Unlock fish selling only after its full chain is ready',
                body: "Deathly Fortune requires the Broker, Night's Craftwork, Flourishing Soil, access to the Broker, and at least one caught fish. Until then, keep every catch.",
                references: [reference('mechanics/incantation', 'WorldUpgradeSellShop')],
            },
            {
                title: 'Add wells and fountains after core progression recipes',
                body: 'Rise of Stygian Wells and route-specific lifesprings add recovery and run decisions. They are useful once the systems above no longer compete for their materials.',
                references: [reference('mechanics/incantation', 'WorldUpgradeWellShops')],
            },
        ],
        fallback:
            'If a named incantation is absent, open its knowledge page and check the reveal requirements. Complete the missing conversation, prior recipe, resource discovery, or route entry before farming more materials.',
        fallbackLinks: [{ href: '/knowledge/incantations/', label: 'Find the missing Incantation' }],
        exit: [
            'Resource detection is active.',
            'Gathering tools are available.',
            'The Broker and garden are active or have a named unmet requirement.',
            'The Fated List chain is progressing.',
            'Deathly Fortune is complete, or its exact unmet requirement is visible on the incantation page.',
        ],
    },
    {
        id: 'guardian-preparation',
        milestone: 'clear',
        title: 'Repair the first-clear setup',
        spoilerLevel: 'progression',
        entry: 'Ordinary rooms are manageable, but a guardian still ends otherwise useful runs.',
        objective: 'Keep the Staff plan and repair one missing permanent, Boon, Keepsake, or reward layer at a time.',
        why: 'The base Staff is rated for high safety and consistency in the new-player context because its Special preserves reaction time at range. Keeping that sequence avoids adding a new weapon pattern while repairing the part that actually ended the run.',
        learn: [
            'The Staff plan needs a Special Boon, Magick recovery, survival Arcana, and a still-active Keepsake.',
            'Rapid Moonshot, Shimmering Moonshot, and Dual Moonshot improve the plan without changing its inputs.',
            'A spent Luckier Tooth should be replaced at the next cabinet because it cannot trigger twice.',
        ],
        loadout: {
            title: 'Check these four lines',
            summary: 'Do not start another repair pass until the first unmet line has been addressed.',
            items: [
                {
                    label: 'Arcana',
                    value: 'The Sorceress, Persistence, Death, The Unseen',
                    reason: 'Raise Grasp until the twelve-Grasp board fits. Leave The Unseen out first when capacity is short.',
                },
                {
                    label: 'Special',
                    value: 'Nova Flourish, Volcanic Flourish, or Wave Flourish',
                    reason: 'Take the first one offered and keep Poms on that Special.',
                },
                {
                    label: 'Magick',
                    value: 'Lucid Gain or Tranquil Gain',
                    reason: 'One of these keeps Omega Special available across a full room.',
                },
                {
                    label: 'Survival',
                    value: 'Luckier Tooth before Knuckle Bones',
                    reason: 'Use the Tooth while any room can spend a Death Defiance. Use Knuckle Bones only after reaching the final guardian reliably.',
                },
            ],
        },
        steps: [
            {
                title: "Keep the Witch's Staff equipped",
                body: 'Practice carries between attempts. Continue using Cast, ranged Special, Omega Special through an open lane, then Sprint to a new lane.',
            },
            {
                title: 'Complete the Arcana line first',
                body: 'Activate The Sorceress, Persistence, and Death. Raise Grasp and add The Unseen next. Do not spend Ashes or Psyche on reroll cards before this board fits.',
                references: [
                    reference('mechanics/arcana-card', 'BonusHealth'),
                    reference('mechanics/arcana-card', 'LastStand'),
                    reference('mechanics/arcana-card', 'ChanneledCast'),
                    reference('mechanics/arcana-card', 'ManaOverTime'),
                ],
            },
            {
                title: 'Equip Luckier Tooth',
                body: 'Take the extra Last Stand through the regions while the route is still unstable. If it triggers, replace the spent Tooth at the next cabinet. Use Knuckle Bones for the final guardian only after normal rooms are safe.',
                references: [
                    reference('mechanics/keepsake', 'ReincarnationKeepsake'),
                    reference('mechanics/keepsake', 'BossPreDamageKeepsake'),
                ],
            },
            {
                title: 'Secure Special before optional rewards',
                body: 'Take Nova Flourish, Volcanic Flourish, or Wave Flourish before another Attack, Cast, or Sprint Boon. Take Lucid Gain or Tranquil Gain before spending Poms on secondary effects.',
            },
            {
                title: 'Use the beginner-safe reward order',
                body: 'Core Special, Magick recovery, a top Special Hammer, maximum Life, then a Pom on Special. Rare synergy comes only after those pieces already work.',
            },
            {
                title: 'Check the enemy that ended the attempt',
                body: 'Open its record for maximum Life, encounter role, regions, attack patterns, and the exact control effects it can resist. Change the answer to that behavior instead of replacing the whole build.',
                links: [{ href: '/knowledge/enemies/', label: 'Open enemies and Guardians' }],
            },
        ],
        choices: [
            {
                situation: 'Special is empty',
                choice: 'Take the god room over a Hammer or Pom.',
                reason: 'The build does not have its main damage source yet.',
            },
            {
                situation: 'Special works but Magick empties',
                choice: 'Take a Gain Boon before another damage reward.',
                reason: 'Omega Special cannot carry the room when its Magick runs out.',
            },
            {
                situation: 'Special damage and Magick recovery are working',
                choice: 'Take Rapid, Shimmering, or Dual Moonshot, otherwise take maximum Life.',
                reason: 'The Hammer improves the exact move you use. Life is the reliable fallback when none appears.',
            },
        ],
        fallback:
            'If the exact Apollo choices do not appear, use Volcanic Flourish or Wave Flourish with Tranquil Gain. Do not replace the Staff or the Special sequence.',
        fallbackLinks: [{ href: '/knowledge/enemies/', label: 'Check the enemy or Guardian record' }],
        exit: [
            'The encounter that ended the last attempt is recorded.',
            'One cause of the failure has changed while the weapon plan stayed the same.',
            'The chosen weapon move, its Boon, Arcana, and Keepsake support the same plan.',
        ],
    },
    {
        id: 'first-clear-build',
        milestone: 'clear',
        title: 'Assemble the first clear build',
        spoilerLevel: 'progression',
        entry: 'Later regions are within reach, but the run still needs one attack pattern you can repeat safely from the first room to the final guardian.',
        objective: "Use the Witch's Staff and one ranged Special build from the first room to the final guardian.",
        why: 'The starting Staff needs no unlock cost, keeps a ranged Special available, and lets you repeat the same plan before the first clear.',
        learn: [
            'The build is complete when its main move, Magick need, survival, and guardian plan are answered.',
            'Rare synergy is a bonus after the required pieces fit the run, not the definition of success.',
            'Keepsakes form a route sequence. One Keepsake is not expected to do every job.',
        ],
        loadout: {
            title: 'First-clear setup',
            summary: 'Build the first available item on each line. Do not wait for rare synergy.',
            items: [
                {
                    label: 'Weapon',
                    value: "Witch's Staff",
                    reason: 'Use Cast, fire Special from range, then charge Omega Special only through an open lane.',
                },
                {
                    label: 'Arcana',
                    value: 'The Sorceress + Persistence + Death + The Unseen',
                    reason: 'This is the complete twelve-Grasp board. If it does not fit yet, remove The Unseen first and use Lucid Gain for recovery.',
                    references: [
                        reference('mechanics/arcana-card', 'ChanneledCast'),
                        reference('mechanics/arcana-card', 'BonusHealth'),
                        reference('mechanics/arcana-card', 'LastStand'),
                        reference('mechanics/arcana-card', 'ManaOverTime'),
                    ],
                },
                {
                    label: 'Preferred Boons',
                    value: 'Nova Flourish + Lucid Gain',
                    reason: 'Nova Flourish powers the ranged move without adding a timing condition. Lucid Gain restores the Magick used by Omega Special. The fallback line below keeps the build valid when either does not appear.',
                    references: [
                        reference('mechanics/boon', 'ApolloSpecialBoon'),
                        reference('mechanics/boon', 'ApolloManaBoon'),
                    ],
                },
                {
                    label: 'Hammer order',
                    value: 'Rapid Moonshot, Shimmering Moonshot, Dual Moonshot',
                    reason: "Rapid Moonshot speeds up the same ranged action without reducing its reach. Shimmering Moonshot adds crowd coverage. Dual Moonshot is last because its second projectile costs 40% of the Special's range.",
                    references: [
                        reference('mechanics/hammer-upgrade', 'StaffFastSpecialTrait'),
                        reference('mechanics/hammer-upgrade', 'StaffJumpSpecialTrait'),
                        reference('mechanics/hammer-upgrade', 'StaffTripleShotTrait'),
                    ],
                },
                {
                    label: 'Keepsakes',
                    value: 'Harmonic Photon, then Luckier Tooth, then Knuckle Bones',
                    reason: `Make Apollo likely first. ${guideFacts.harmonicPhoton.switchCondition} Use Knuckle Bones for the last guardian only when ordinary rooms are already safe.`,
                    references: [
                        reference('mechanics/keepsake', 'ForceApolloBoonKeepsake'),
                        reference('mechanics/keepsake', 'ReincarnationKeepsake'),
                        reference('mechanics/keepsake', 'BossPreDamageKeepsake'),
                    ],
                },
            ],
        },
        steps: [
            {
                title: "Use the Staff's ranged plan",
                body: 'Open with Cast, use Special from range, and charge Omega Special only while the line ahead is clear. Sprint to a new lane before repeating.',
            },
            {
                title: 'Equip the twelve-Grasp board',
                body: 'Use The Sorceress, Persistence, Death, and The Unseen. If current Grasp is lower, keep that order and leave The Unseen out until it fits.',
                references: [
                    reference('mechanics/arcana-card', 'ChanneledCast'),
                    reference('mechanics/arcana-card', 'BonusHealth'),
                    reference('mechanics/arcana-card', 'LastStand'),
                ],
            },
            {
                title: 'Prefer Nova Flourish, then Lucid Gain',
                body: 'Nova Flourish fills the Special slot that carries this route. Lucid Gain sustains Omega Special. When either is absent, use the listed fallback instead of spending the whole night chasing one exact offer.',
                references: [
                    reference('mechanics/boon', 'ApolloSpecialBoon'),
                    reference('mechanics/boon', 'ApolloManaBoon'),
                ],
            },
            {
                title: 'Use the reliable fallback choices',
                body: 'If Nova Flourish is unavailable, take Volcanic Flourish or Wave Flourish. If Lucid Gain is unavailable, take Tranquil Gain. Keep the same Cast, Special, Omega Special sequence.',
                references: [
                    reference('mechanics/boon', 'HephaestusSpecialBoon'),
                    reference('mechanics/boon', 'PoseidonSpecialBoon'),
                    reference('mechanics/boon', 'DemeterManaBoon'),
                ],
            },
            {
                title: 'Take the first top Special Hammer',
                body: "Choose Rapid Moonshot first because its 25% speed increase keeps the full range and shortens exposure. Choose Shimmering Moonshot next for its two extra bounces. Choose Dual Moonshot after those because the second projectile also reduces the Special's range by 40%. If none appears, keep the build intact rather than changing to an Attack plan.",
            },
            {
                title: 'Switch Keepsakes when their job ends',
                body: `${guideFacts.harmonicPhoton.switchCondition} Luckier Tooth is finished after its Last Stand triggers. Use Knuckle Bones only for the final guardian when normal rooms no longer need the Tooth.`,
                references: [
                    reference('mechanics/keepsake', 'ReincarnationKeepsake'),
                    reference('mechanics/keepsake', 'BossPreDamageKeepsake'),
                ],
            },
        ],
        fallback:
            'If Apollo cannot complete the build, use Volcanic Flourish or Wave Flourish with Tranquil Gain. Keep every later Pom and Hammer on Special. The fallback changes the gods, not the weapon plan.',
        exit: [
            'The Staff has one primary damage move.',
            'The build has a named source of Magick recovery.',
            'Arcana protects the main failure.',
            'Every Keepsake has a current job and a switch condition.',
            'The run can enter the final region without depending on rare synergy.',
        ],
    },
    {
        id: 'first-route-clear',
        milestone: 'clear',
        title: 'Finish one route and process the return',
        spoilerLevel: 'story',
        entry: 'The build reaches the final encounter of the currently accessible route with its main damage move working.',
        objective:
            'Clear the route, then handle every new conversation, recipe, objective, and resource use before changing goals.',
        why: 'The first clear is a progression hinge. The return matters as much as the victory because several later systems reveal through its aftermath.',
        learn: [
            'The final room tests the same plan under longer pressure. A new trick is less reliable than a practiced sequence.',
            'A clear can reveal systems without making them immediately affordable.',
            'The next route or story step should be chosen from the new objective state, not from habit.',
        ],
        steps: [
            {
                title: 'Keep the established plan',
                body: 'Use Cast for control and timing, take safe damage windows, and preserve Death Defiance for mistakes that cannot be avoided. Do not add a new input pattern during the final encounter.',
            },
            {
                title: 'Use the last rewards to solve the final fight',
                body: 'Prefer maximum Life, recovery, or damage that affects the boss. Ignore room-clear effects that no longer address the remaining encounter.',
            },
            {
                title: 'Confirm the clear',
                body: 'Use the relevant route achievement, prophecy, or unlocked follow-up to confirm progress. Do not rely on an assumed number of nights.',
                references: [
                    reference('world-progression/achievement', 'AchClearTartarus'),
                    reference('world-progression/achievement', 'AchClearSummit'),
                ],
            },
            {
                title: 'Run the full Crossroads circuit',
                body: 'Speak to everyone and inspect each Crossroads interface the game has already opened. New dialogue may reveal the next recipe or system.',
            },
            {
                title: 'Choose the next named objective',
                body: 'Open the alternate route when its recipe and cost are ready, or continue the current route when a story requirement, boss material, or system unlock still points there.',
            },
        ],
        fallback:
            'If the clear fails late, keep the same weapon plan and rebuild only the weak layer. Farm permanent power on productive nights, then return with more Life, Grasp, or one completed upgrade instead of changing every choice.',
        exit: [
            'One route clear is recorded.',
            'Every post-clear conversation has been checked.',
            'New Cauldron recipes and objectives have been reviewed.',
            'The next route is chosen for a named requirement.',
        ],
    },
    {
        id: 'open-the-surface',
        milestone: 'expand',
        title: 'Open and survive the Surface',
        spoilerLevel: 'story',
        entry: 'Permeation of Witching-Wards has appeared or its Hecate conversation is the next explicit requirement.',
        objective:
            'Open the Surface, learn its separate progression chain, and remove the escalating ward damage before treating it as a normal route.',
        why: 'The Surface has unique resources, encounters, and story requirements. Its early self-damage is a progression gate, not a build-quality test.',
        learn: [
            'Permeation of Witching-Wards needs one Cinder, one Shadow, and three Moly after the relevant Hecate conversation.',
            'The Surface ward starts at one self-damage every five seconds and increases each tick.',
            'Unraveling a Fateful Bond removes the ward after its recipe and materials become available.',
        ],
        steps: [
            {
                title: 'Brew Permeation of Witching-Wards',
                body: 'Use it when the recipe appears and its three resources are funded. This opens the warded gateway to the Surface.',
                references: [reference('mechanics/incantation', 'WorldUpgradeAltRunDoor')],
            },
            {
                title: 'Treat early Surface visits as scouting',
                body: 'Gather route-specific resources, meet available characters, and learn the opening encounter. The ward is supposed to end these early visits, so it is not a fair test of the weapon or Boons.',
            },
            {
                title: 'Cure the ward',
                body: 'Complete Unraveling a Fateful Bond as soon as its reveal requirements and cost are met. It is the prerequisite for ordinary Surface endurance.',
                references: [
                    reference('mechanics/incantation', 'WorldUpgradeSurfacePenaltyCure'),
                    reference('world-progression/surface-penalty', 'surface-ward'),
                ],
            },
            {
                title: 'Expect the Blessing of Strife early',
                body: 'Eris appears at deterministic progression stages, not random locations. Her curse begins at 20 percent increased enemy damage, rises by 5 percentage points after each encounter up to 100 percent, and ends with the current night.',
                references: [reference('world-progression/strife-curse', 'strife-blessing')],
            },
            {
                title: 'Alternate routes for a reason',
                body: 'Use the Underworld for its story and boss materials. Use the Surface for its separate chain, Bronze, route plants, and required clears. Let the next unmet requirement choose the route.',
            },
        ],
        fallback:
            'If the Surface penalty or Strife curse makes a clear unrealistic, gather the required materials, progress the relevant conversations, and leave the clear for a later night. Those effects are designed to stop early overextension.',
        exit: [
            'The Surface is open.',
            'The active damage pressure is identified as the ward, Strife, or ordinary enemy damage.',
            'Unraveling a Fateful Bond is complete or has an exact unmet requirement.',
            'Both routes have a named current purpose.',
        ],
    },
    {
        id: 'gods-and-field-allies',
        milestone: 'expand',
        title: 'Meet every god and field ally when their gate opens',
        spoilerLevel: 'progression',
        entry: 'Both routes are open, so the remaining Olympians and region-specific encounters can join the normal run pool.',
        objective:
            'Complete the god roster in progression order and recognize which region can offer each field ally before planning a run around them.',
        why: 'Late gods and field allies do not share one random global pool. Their first appearances depend on route progress, earlier gods, or a particular region.',
        learn: [
            'Apollo opens the first night. Demeter and Poseidon can follow Apollo. Hestia requires both, and Aphrodite requires Demeter, Poseidon, and Hestia.',
            `Zeus first becomes eligible after three completed nights. ${guideFacts.hephaestus.availability} Hermes also requires Zeus and at least two entries to Oceanus.`,
            'Hera enters the pool after Unraveling a Fateful Bond cures the Surface ward. Ares enters after you have reached the Guardian at the Summit once.',
        ],
        steps: [
            {
                title: 'Let the early Olympian chain expand naturally',
                body: 'Take each newly available god at least once. Apollo leads to Demeter and Poseidon, those two lead to Hestia, and those three lead to Aphrodite. Do not spend rerolls trying to force a god whose prerequisite has not happened yet.',
                references: [
                    reference('mechanics/god', 'ApolloUpgrade'),
                    reference('mechanics/god', 'DemeterUpgrade'),
                    reference('mechanics/god', 'PoseidonUpgrade'),
                    reference('mechanics/god', 'HestiaUpgrade'),
                    reference('mechanics/god', 'AphroditeUpgrade'),
                ],
            },
            {
                title: 'Open the three later Underworld gods through their own gates',
                body: `After three completed nights, Zeus can receive his first forced opening when the weather gate allows it. ${guideFacts.hephaestus.availability} Hermes separately becomes eligible after Zeus plus at least two Oceanus entries. Hephaestus and Hermes are not a strict order after Zeus.`,
                references: [
                    reference('mechanics/god', 'ZeusUpgrade'),
                    reference('mechanics/god', 'HephaestusUpgrade'),
                    reference('mechanics/god', 'HermesUpgrade'),
                ],
            },
            {
                title: 'Unlock Hera and Ares through Surface progress',
                body: 'Hera first appears after the Surface ward is cured. Ares first appears after you have entered the Summit Guardian room once. Until those events happen, neither god belongs in a planned build.',
                references: [reference('mechanics/god', 'HeraUpgrade'), reference('mechanics/god', 'AresUpgrade')],
            },
            {
                title: 'Know the Underworld friend regions',
                body: "Arachne appears in Erebus, Narcissus in Oceanus, Echo in the Fields of Mourning after you have reached that region's Guardian, and Hades in Tartarus. Artemis can begin appearing in Erebus after the early Olympian introductions are far enough along.",
                references: [
                    reference('world-progression/encounter-friend', 'Arachne'),
                    reference('world-progression/encounter-friend', 'Narcissus'),
                    reference('world-progression/encounter-friend', 'Echo'),
                    reference('world-progression/encounter-friend', 'Hades'),
                    reference('world-progression/encounter-friend', 'Artemis'),
                ],
            },
            {
                title: 'Know the Surface friend regions',
                body: 'Medea appears in the City of Ephyra. Circe and Dionysus appear in the Rift of Thessaly. Athena appears on Mount Olympus. Icarus begins in Thessaly after repeated visits and can appear later on Olympus. Heracles can cross several Surface regions as his meetings progress.',
                references: [
                    reference('world-progression/encounter-friend', 'Medea'),
                    reference('world-progression/encounter-friend', 'Circe'),
                    reference('world-progression/encounter-friend', 'Dionysus'),
                    reference('world-progression/encounter-friend', 'Athena'),
                    reference('world-progression/encounter-friend', 'Icarus'),
                    reference('world-progression/encounter-friend', 'Heracles'),
                ],
            },
            {
                title: 'Choose encounter aid for the current build',
                body: 'When a friend room appears, open that character’s page and compare the offered aid with your weapon, current Boons, and survival needs. Prefer effects that strengthen the attacks you already use.',
                links: [{ href: '/knowledge/regions/', label: 'Find encounter friends by region' }],
            },
        ],
        fallback:
            'If a god or friend has not appeared, check the linked requirement before repeating the route. Continue another named objective when the gate is unmet. When the gate is met, combine that search with a resource, relationship, or clear objective because the exact room still depends on the run.',
        exit: [
            'Every Olympian is unlocked or has one exact unmet progression gate.',
            'Each field ally has a recorded route and region.',
            "The planned ally reward supports the selected weapon's main move, survival, or resource goal.",
            'A missing encounter is paired with another useful objective for the same route.',
        ],
    },
    {
        id: 'weapons-and-aspects',
        milestone: 'expand',
        title: 'Unlock every weapon without wasting rare materials',
        spoilerLevel: 'progression',
        entry: 'The Silver Pool is active, several route resources are available, and weapon prerequisites can be checked directly.',
        objective:
            'Open all six weapons, reveal aspects, then finish one reliable aspect before spreading Nightmare across side builds.',
        why: 'Weapon access completes core prophecy coverage. Focused aspect investment creates a dependable clear tool sooner than equal spending.',
        learn: [
            'The Staff is free. Sister Blades cost one Silver. Later weapons have their own resource and prerequisite chains.',
            `${guideFacts.argentSkull.unlockRequirements} ${guideFacts.blackCoat.unlockRequirements}`,
            'Aspects of Night and Darkness appears through Hecate and costs five Bronze plus one Nightshade.',
        ],
        steps: [
            {
                title: 'Unlock the cheap weapons first',
                body: 'Start with Sister Blades, then Umbral Flames and Moonstone Axe as their costs become available. Each unlock widens rewards and advances the prerequisite chain.',
                references: [
                    reference('mechanics/weapon', 'WeaponDagger'),
                    reference('mechanics/weapon', 'WeaponTorch'),
                    reference('mechanics/weapon', 'WeaponAxe'),
                ],
            },
            {
                title: 'Open the Argent Skull after its three prerequisites',
                body: guideFacts.argentSkull.unlockRequirements,
                references: [reference('mechanics/weapon', 'WeaponLob')],
            },
            {
                title: 'Open the Black Coat last',
                body: guideFacts.blackCoat.unlockRequirements,
                references: [reference('mechanics/weapon', 'WeaponSuit')],
            },
            {
                title: 'Brew Aspects of Night and Darkness',
                body: 'After Hecate provides the recipe, spend five Bronze and one Nightshade to reveal aspect choices in the Silver Pool.',
                references: [reference('mechanics/incantation', 'WorldUpgradeWeaponUpgradeSystem')],
            },
            {
                title: 'Choose one reliable aspect per weapon',
                body: 'Use the aspect build pages to compare how each aspect plays, plus its Arcana, Boons, Hammers, Keepsakes, and route fit, before spending Nightmare.',
                references: [
                    reference('editorial/aspect-guide', 'DaggerHomingThrowAspect'),
                    reference('editorial/aspect-guide', 'BaseStaffAspect'),
                ],
                links: [
                    { href: '/knowledge/weapons/', label: 'Compare weapon and aspect unlocks' },
                    { href: '/knowledge/builds/', label: 'Compare complete aspect builds' },
                ],
            },
            {
                title: 'Max one main aspect first',
                body: 'Reserve Nightmare for the aspect that already clears reliably. Build secondary aspects when a prophecy or playstyle need names them.',
            },
        ],
        fallback:
            'If a weapon feels wrong at rank one, test its basic attack pattern before spending Nightmare. Keep the current reliable aspect for progression and use the new weapon only for safe prophecy work.',
        exit: [
            'All six weapons are unlocked or each missing weapon shows an exact unmet prerequisite.',
            'The aspect system is open.',
            'One main aspect has first claim on Nightmare.',
            'Every weapon family has one planned aspect rather than equal unfocused investment.',
        ],
    },
    {
        id: 'complete-loadout',
        milestone: 'expand',
        title: 'Connect the permanent combat systems',
        spoilerLevel: 'progression',
        entry: 'Weapons and aspects are open, and the remaining permanent systems can now support specific builds.',
        objective:
            'Build Arcana, Keepsake, Familiar, and Hex choices around the selected aspect instead of treating each system as a separate tier list.',
        why: 'A strong setup makes every system support the same actions. A highly rated Arcana card, Keepsake, Familiar, or Hex can still be wrong for the weapon plan you are using.',
        learn: [
            "Arcana must fit both Grasp and the aspect's mechanics.",
            'Keepsakes have a lifecycle and should be switched when their effect is spent or their forcing job is complete.',
            'Familiars combine combat and gathering value. Hexes consume Magick and can either preserve or interrupt the weapon plan.',
        ],
        steps: [
            {
                title: 'Finish the chosen Arcana board',
                body: "Start with survival and the aspect's resource need. Add Origination only when two curses can remain active. Add rerolls only when a particular Boon or door materially changes the build.",
                references: [
                    reference('mechanics/arcana-card', 'StatusVulnerability'),
                    reference('mechanics/arcana-card', 'ScreenReroll'),
                ],
            },
            {
                title: 'Use Keepsakes as a sequence',
                body: 'Force the first required god, switch once that god has appeared, then carry survival, guardian damage, or a still-active utility effect for the remaining regions.',
            },
            {
                title: 'Recruit and upgrade Familiars deliberately',
                body: 'Use Frinos while learning routes or when maximum Life is the main constraint, its Life bonus asks for no build-specific setup. Use Hecuba for an Omega-heavy build that needs Magick, Raki after survival is stable, Gale when mobility solves the current route, and Toula when recovery or fishing access advances the current objective.',
                references: [
                    reference('mechanics/familiar', 'FrogFamiliar'),
                    reference('mechanics/familiar', 'HoundFamiliar'),
                    reference('mechanics/familiar', 'RavenFamiliar'),
                    reference('mechanics/familiar', 'PolecatFamiliar'),
                    reference('mechanics/familiar', 'CatFamiliar'),
                ],
            },
            {
                title: 'Choose a Hex that fits the plan',
                body: 'For a new player keeping the same weapon sequence, Phase Shift and Moon Water add safety without demanding a new attack pattern. Lunar Ray needs a protected channeling window. Dark Side replaces the normal aspect actions while active.',
                references: [
                    reference('mechanics/hex', 'TimeSlow'),
                    reference('mechanics/hex', 'Potion'),
                    reference('mechanics/hex', 'Laser'),
                    reference('mechanics/hex', 'Transform'),
                ],
            },
            {
                title: 'Unlock the supporting systems when they appear',
                body: 'Faith of Familiar Spirits recruits companions. Path rewards appear after repeated Hex use. The Keepsake cabinet and post-guardian switches become more valuable as route plans mature.',
                references: [reference('mechanics/incantation', 'WorldUpgradeFamiliarSystem')],
            },
        ],
        choices: [
            {
                situation: 'General S-tier item or aspect-specific A-tier item',
                choice: 'Choose the aspect-specific item.',
                reason: 'The build page rates the interaction, while the general tier list assumes no particular weapon.',
            },
            {
                situation: 'Expired Keepsake or lower-ranked active Keepsake',
                choice: 'Switch to the active Keepsake.',
                reason: 'A spent effect contributes nothing to the remaining route.',
            },
            {
                situation: 'Damage Hex that interrupts the plan or safety Hex that preserves it',
                choice: 'Use the safety Hex until the weapon sequence is stable.',
                reason: "A Hex is support, not a reason to abandon the aspect's primary damage.",
            },
        ],
        fallback:
            'If a system is not unlocked yet, keep the current working layer and use its knowledge page to identify the exact conversation, incantation, or event requirement. Do not substitute an invented run count.',
        fallbackLinks: [{ href: '/knowledge/', label: 'Search the exact locked system' }],
        exit: [
            'The selected aspect has a complete Arcana plan.',
            'The Keepsake route includes switch conditions.',
            'The Familiar and Hex have named jobs.',
            'The setup still works when one ideal Boon does not appear.',
        ],
    },
    {
        id: 'advanced-boon-planning',
        milestone: 'expand',
        title: 'Plan Boons without chasing them blindly',
        spoilerLevel: 'progression',
        entry: 'The aspect pages and god Keepsakes are available, and each active move has a clear purpose in the build.',
        objective:
            'Build from the move the aspect uses most, then add status, elements, Infusions, Duos, and Legendaries only when their prerequisites reinforce it.',
        why: "Rare Boons raise a working build's ceiling. They do not repair an empty damage slot, missing Magick recovery, or inadequate survival.",
        learn: [
            'Attack, Special, Cast, Sprint, and Magick recovery are the five main Boon slots. Most other Boons add support around them.',
            'Origination needs two curses on the same target, not merely two gods in the pool.',
            'Duo and Legendary offers require their named prerequisite Boons and the relevant gods or pool state.',
            'Elements matter when an Infusion target is reachable without weakening the main damage plan.',
        ],
        steps: [
            {
                title: 'Start from the aspect page',
                body: 'Choose the main damage move and first god. Read preferred options and fallbacks before equipping the god Keepsake.',
                references: [reference('editorial/aspect-guide', 'DaggerHomingThrowAspect')],
                links: [{ href: '/knowledge/builds/', label: 'Choose the current aspect build' }],
            },
            {
                title: 'Strengthen one main attack first',
                body: 'Do not fill another attack slot simply because its Boon has higher rarity. Your weapon pattern decides whether Attack, Special, or Cast deserves the damage investment.',
            },
            {
                title: 'Secure Magick recovery',
                body: 'Add a Gain Boon or Arcana recovery when Omega actions consume Magick faster than it returns. Skip recovery when the build does not need it.',
            },
            {
                title: 'Add the second status intentionally',
                body: 'When Origination is active, choose a curse that can remain on the same priority target while the main move deals damage.',
                references: [reference('mechanics/arcana-card', 'StatusVulnerability')],
            },
            {
                title: 'Check exact rare prerequisites',
                body: 'Use the Boon page or the in-game pinned path to check the exact requirements. Stop chasing when a missing god, required Boon, or the number of rooms left makes the target unrealistic.',
                references: [reference('mechanics/incantation', 'WorldUpgradePinningBoons')],
                links: [{ href: '/knowledge/boons/', label: 'Check Boon prerequisites' }],
            },
            {
                title: 'Pivot without breaking the run',
                body: 'Keep the stronger existing core, take health or a compatible support Boon, and move the rare target to a future night instead of filling conflicting slots.',
            },
        ],
        fallback:
            'When the planned god pair does not form, finish the run with one strong core, one resource answer, and survival. The aspect page lists compatible alternatives without requiring the rare target.',
        exit: [
            'The build has one named primary damage Boon and any supporting Boons have separate jobs.',
            'The chosen Duo or Legendary target has every prerequisite listed.',
            'Rerolls stop after the named prerequisite path is no longer reachable.',
            'A failed rare target still leaves a functional build.',
        ],
    },
    {
        id: 'advance-both-routes',
        milestone: 'story',
        title: 'Prepare the two ending keys',
        spoilerLevel: 'story',
        entry: 'Both routes can be cleared with one reliable aspect and the full Surface is open.',
        objective:
            'Complete the Zagreus memory sequence below the House, obtain Gigaros, and stop the storm around Typhon.',
        overviewObjective: 'Complete the final requirement opened on each route without revealing those events here.',
        why: 'The final story sequence requires one completed chain from each route. More clears alone do not open the ending until both named chains are complete.',
        learn: [
            "Underworld clears lead through Zagreus's bedchamber and a sequence of memories.",
            "Zagreus eventually leaves Gigaros for the incantation that can stop Typhon's storm.",
            'Disintegration of Monstrosity costs one Gigaros, one Zodiac Sand, and four Void Lenses.',
        ],
        steps: [
            {
                title: 'Repeat the Underworld route for Zagreus',
                body: "Clear Chronos, enter Zagreus's bedchamber, and complete the available conversation or interaction before leaving. Use zero Fear for the lowest-risk story attempt unless another explicit objective requires Fear. Return on later clears until Zagreus says he will leave Hades's spear for you.",
            },
            {
                title: 'Take Gigaros from the bedchamber',
                body: 'On the next relevant visit, collect the spear when it appears. Do not spend it elsewhere. It is the unique ingredient for the Typhon incantation.',
            },
            {
                title: 'Reveal Disintegration of Monstrosity',
                body: `${guideFacts.stormStop.unlockRequirements} Gigaros is part of the brewing cost, not the reveal condition. When the recipe appears, reserve one Zodiac Sand from Chronos and four Void Lenses from Typhon attempts.`,
                references: [reference('mechanics/incantation', 'WorldUpgradeStormStop')],
            },
            {
                title: 'Brew the incantation before fighting Typhon again',
                body: "Spend one Gigaros, one Zodiac Sand, and four Void Lenses on Disintegration of Monstrosity. The recipe turns Typhon's own power against him once he is weakened.",
                references: [reference('mechanics/incantation', 'WorldUpgradeStormStop')],
            },
            {
                title: 'Clear the Surface and stop the storm',
                body: 'Use the proven setup, defeat Typhon, and finish the incantation-driven storm sequence. This produces Entropy and completes the Surface half of the ending gate.',
            },
        ],
        fallback:
            "If the recipe has not appeared, do not grind Typhon. Continue Zagreus's bedchamber sequence after Chronos and speak with Hecate after every return. If the recipe is ready but materials are missing, farm only the named boss drops and use zero Fear when no separate objective requires it.",
        exit: [
            'Gigaros has been collected.',
            'Disintegration of Monstrosity has been brewed.',
            'Typhon has been defeated with the storm stopped.',
        ],
    },
    {
        id: 'true-ending',
        milestone: 'story',
        title: 'Rescue the House and reach the credits',
        spoilerLevel: 'ending',
        entry: 'Zagreus has provided Gigaros and Typhon has been defeated after Disintegration of Monstrosity.',
        objective:
            'Witness the event in Erebus, clear Chronos once more, rescue the captive family, and complete the credits sequence.',
        overviewObjective: 'Follow the newly opened story sequence to its conclusion.',
        why: 'Once both route keys are complete, the ending follows a short fixed chain. Leaving for an unrelated objective only delays it.',
        learn: [
            'The next ordinary Erebus visit replaces the Hecate fight with a story event.',
            'The following Chronos clear uses Gigaros as part of the ending sequence.',
            'The story event requires an ordinary run with no active Chaos Trial or bounty. Fear itself is not the gate.',
            'The True Ending achievement is awarded by the finale and credits, not by a fixed clear count.',
        ],
        steps: [
            {
                title: 'Enter Erebus without a Chaos Trial active',
                body: 'Take the ordinary Underworld route. When you reach Hecate, Chronos abducts her instead of starting the usual Guardian fight.',
            },
            {
                title: 'Finish that night or prepare one safe follow-up',
                body: 'Keep the aspect, Arcana, Familiar, Hex, and Keepsake sequence that already cleared Chronos. Use zero Fear for the least demanding attempt, but do not confuse that recommendation with the actual gate: no active Chaos Trial or bounty.',
            },
            {
                title: 'Defeat Chronos after Hecate is taken',
                body: 'Reach Tartarus and win the fight. The ending path now changes the defeat sequence and sends you onward instead of returning immediately to the Crossroads.',
            },
            {
                title: 'Follow the House sequence to its end',
                body: 'Complete the Zagreus bedchamber memory, continue into the restored House, and interact with the captive family when prompted. Do not leave an available story interaction unused.',
            },
            {
                title: 'Finish the chariot scene and credits',
                body: 'The rescue leads directly to the departure and credits. Let the sequence finish and return to the Crossroads. The True Ending achievement confirms completion.',
                references: [reference('world-progression/achievement', 'AchTrueEnding')],
            },
        ],
        fallback:
            "If Hecate fights normally, first confirm Zagreus's fifth memory, Typhon's defeat after Disintegration of Monstrosity, and that no Chaos Trial or bounty is active. If Hecate has already been taken, the next required action is an ordinary Underworld clear, zero Fear is the beginner-safe setting, not a story requirement.",
        exit: [
            'The family rescue and credits have played.',
            'The True Ending achievement is recorded.',
            'Post-ending routes and the Fates epilogue are now available.',
        ],
    },
    {
        id: 'rescue-the-fates',
        milestone: 'story',
        title: 'Find the Fates and complete the epilogue',
        spoilerLevel: 'ending',
        entry: 'The true ending and credits are complete.',
        objective:
            'Complete the post-ending character chain, make the Fated List react, and follow its final clue in Oceanus.',
        overviewObjective: 'Follow the post-ending clues to finish the remaining story.',
        why: 'The epilogue joins route encounters, relationship events, and post-ending conversations. Random clears cannot replace the named interactions.',
        learn: [
            'Moros opens the final Fates quest only after you meet the changed Chronos on both routes.',
            'Hecate and Moros each require a late relationship event for this chain.',
            'The final clue is solved in Oceanus after Death Defiance activates in each of the previous three chambers. Epic-rank Death supplies the three charges needed for a controlled attempt.',
        ],
        steps: [
            {
                title: 'Meet Chronos on both post-ending routes',
                body: 'Complete another Underworld run and another Surface run. Speak with the changed Chronos when he appears after Tartarus and on Olympus, then return to Moros at the Crossroads.',
            },
            {
                title: "Finish Hecate's required bond event",
                body: 'Complete her second bathhouse and second taverna events. After the true ending, give her final Ambrosia gift, then use one Twin Lure for her second fishing-pier event. That fishing conversation is required for the epilogue.',
            },
            {
                title: "Finish Moros's required bond event",
                body: 'Continue his gift track through his final Ambrosia gift, then spend one Ambrosia on his second taverna event. This is a story requirement, not optional romance flavor.',
            },
            {
                title: 'Collect the four field conversations',
                body: 'Meet Prometheus until both Fates conversations have played, meet Heracles after giving him three Nectar, speak with Chaos after the Chronos nightmare chain, and speak with the changed Chronos about the Fates in Erebus.',
            },
            {
                title: 'Return to Moros when the List reacts',
                body: 'After those conversations, Moros receives an important dialogue marker. Speak with him and read the newly revealed Fated List entry before starting the final night.',
            },
            {
                title: 'Spend three Death Defiances before an Oceanus room',
                body: 'First upgrade Death to Epic: Common to Rare costs six Moon Dust, then Rare to Epic costs twelve Moon Dust and one Star Dust. Enter the Underworld with Epic Death active. In Oceanus, make one of its three Death Defiances activate in each of three consecutive completed chambers. The game checks those previous three rooms while you are still in Oceanus. When the quest chain is ready, that pattern reveals the Fates and starts the epilogue scene.',
                references: [reference('mechanics/arcana-card', 'LastStand')],
            },
            {
                title: 'Claim the epilogue reward',
                body: "Return to the Crossroads, finish Moros's follow-up, and claim the completed Fates prophecy. The epilogue achievement and three Nightmare are the completion proof.",
                references: [reference('world-progression/achievement', 'AchEpilogue')],
            },
        ],
        fallback:
            "If Moros has no important dialogue, one named branch is incomplete. Prioritize Hecate's second fishing trip, Moros's second taverna visit, Prometheus's two Fates talks, Heracles after three Nectar, Chaos after the nightmare chain, and Chronos in Erebus. If the Oceanus event does not trigger, verify that the List has reacted, the run is not a Chaos Trial, and Death Defiance activated in each of the previous three chambers.",
        exit: [
            'The Fates epilogue scene has played.',
            'The epilogue achievement is recorded.',
            'The completed prophecy has paid three Nightmare.',
        ],
    },
    {
        id: 'fear-testaments-nightmare',
        milestone: 'complete',
        title: 'Raise Fear with a purpose',
        spoilerLevel: 'progression',
        entry: 'The Oath and Testament systems are available and normal clears are reliable.',
        objective:
            "Earn Nightmare through controlled Fear and weapon-bound Testaments without breaking the selected aspect's main attack sequence.",
        why: 'Nightmare is scarce aspect currency. Controlled difficulty creates steady upgrades while large jumps hide which condition caused the failure.',
        learn: [
            'Each Oath condition changes a specific part of the run.',
            'Testaments bind a target, route, weapon, and Fear requirement.',
            'Bounties of the Infinite Abyss can add Nightmare rewards after an eight-Fear route clear and the required late-route entries.',
        ],
        steps: [
            {
                title: 'Read the Testament before selecting Fear',
                body: 'Choose the required weapon and route first. Set only enough Fear to satisfy the current bounty.',
            },
            {
                title: 'Add one understandable condition',
                body: 'Prefer a condition whose effect the selected aspect can absorb. Avoid stacking several changes to enemy speed, damage, healing, or time before you know which one breaks the run.',
            },
            {
                title: 'Remove the condition that undermines the plan',
                body: 'A channeling build should avoid pressure that erases safe charge windows. A fragile close-range build should not add damage pressure merely because its numerical Fear is convenient.',
            },
            {
                title: 'Spend Nightmare on the planned aspect',
                body: 'Finish the aspect that earns reliable clears before upgrading a second version of the same weapon for novelty.',
            },
            {
                title: 'Unlock late Nightmare bounties when ready',
                body: 'Bounties of the Infinite Abyss costs six Glassrock and six Serpent Scales after an eight-Fear clear on either route and the required final-region entries.',
                references: [reference('mechanics/incantation', 'WorldUpgradeMetaRewardStands')],
            },
        ],
        fallback:
            'If a Testament run fails, lower all optional Fear, keep only the requirement, and restore the proven build. Change one Oath condition at a time until the cause is clear.',
        exit: [
            'Every active Fear point has a reason.',
            'The current Testament weapon and route are correct.',
            'Nightmare has a named aspect destination.',
            'Eight-Fear and later rewards are attempted only with a stable clear build.',
        ],
    },
    {
        id: 'trials-bounties-ranks',
        milestone: 'complete',
        title: 'Finish trials, bounties, and remaining systems',
        spoilerLevel: 'ending',
        entry: 'The main story is complete and challenge systems can be approached without delaying core progression.',
        objective:
            'Complete each challenge family in prerequisite order while using its rewards on the remaining completion goals.',
        why: 'Trials and bounties unlock in chains. Finishing available lower requirements first reveals later work and avoids farming a reward that another system will supply.',
        learn: [
            'Abyssal Insight activates the Pitch-Black Stone after Chaos provides it.',
            'Chaos Trials award Star Dust and can supply a fixed setup or, later, random conditions.',
            'Ranks and cosmetics belong after combat and story requirements unless a prophecy or achievement names them.',
        ],
        steps: [
            {
                title: 'Activate the Pitch-Black Stone',
                body: 'Complete Abyssal Insight after receiving the Stone from Chaos. Use the linked requirements if the recipe has not appeared.',
                references: [reference('mechanics/incantation', 'WorldUpgradeBountyBoard')],
            },
            {
                title: 'Complete fixed trials before random trials',
                body: 'Fixed trials teach the weapon and Boons they supply while providing predictable Star Dust. Leave all-random streak objectives until their explicit post-ending prerequisites are met.',
            },
            {
                title: 'Clear available Testaments by weapon',
                body: 'Use each required weapon at the stated Fear and route. Spend Nightmare only after checking the remaining Testament demands for that weapon.',
            },
            {
                title: 'Buy functional system upgrades',
                body: 'Finish tool upgrades, Familiar bonds, Arcana ranks, Keepsakes, route shops, fountains, and resource systems before ranks or cosmetics that change no progression state.',
            },
            {
                title: 'Close finite collections before repeatable prestige',
                body: 'Use the achievement and prophecy pages to distinguish a finite unlock from an endlessly repeatable or cosmetic sink.',
            },
        ],
        fallback:
            'When a challenge does not appear, open its incantation, prophecy, or achievement page and complete the first unmet prerequisite. Do not substitute repeated random runs for a missing system unlock.',
        fallbackLinks: [
            { href: '/knowledge/incantations/', label: 'Check Incantations' },
            { href: '/knowledge/prophecies/', label: 'Check Fated List prophecies' },
            { href: '/knowledge/achievements/', label: 'Check achievements' },
        ],
        exit: [
            'The Pitch-Black Stone and its available trials are complete.',
            'Every available Testament is cleared or has an exact weapon, route, and Fear target.',
            'Finite combat systems are complete before optional prestige spending.',
        ],
    },
    {
        id: 'relationship-cleanup',
        milestone: 'complete',
        title: 'Finish relationships without wasting nights',
        spoilerLevel: 'story',
        entry: 'Core story progress is complete and remaining character paths can be pursued deliberately.',
        objective:
            'Use gifts, route encounters, Crossroads conversations, and special interactions in the order each character requires.',
        why: 'A locked heart is usually a conversation or event gate, not a request for more of the same gift.',
        learn: [
            'A first accepted Nectar usually grants that character’s Keepsake. Keepsake rank rises through encounters while equipped. It is separate from the relationship track.',
            'Later relationship steps may require Nectar, Bath Salts, Twin Lures, Ambrosia, a route encounter, or a specific conversation. There is no universal gift order for every character.',
            'Some friend encounters, including Arachne, Echo, Circe, and others, appear only in their eligible regions and still depend on route opportunity.',
            'After a bond is forged, most Crossroads characters can accept Bath Salts, Twin Lures, or Ambrosia indefinitely. Those repeat scenes are optional and no longer fill the completed heart track.',
        ],
        steps: [
            {
                title: 'Read the current lock',
                body: "Cast Empath's Intuition when it appears at the Cauldron. Then use the Book of Shadows control listed in Settings → Controls, select the character, and read the symbol on the next heart. Use that prompt and the character's relationship page to distinguish an available gift from a locked event requirement.",
                references: [reference('mechanics/incantation', 'WorldUpgradeRelationshipBar')],
                links: [{ href: '/knowledge/relationships/', label: 'Open relationship tracks' }],
            },
            {
                title: 'Carry the next required gift, not every gift',
                body: 'Reserve Nectar, Bath Salts, Twin Lures, and Ambrosia for characters whose next Book of Shadows prompt can accept them. A returned gift remains in your inventory. It means the relationship needs another conversation, event, or story condition first.',
            },
            {
                title: 'Route for field characters only when needed',
                body: 'Arachne, Echo, Circe, Narcissus, Icarus, Medea, Heracles, and other encounter friends have region-based appearances. Combine their next interaction with a route, resource, or prophecy target.',
            },
            {
                title: 'Process Crossroads characters every return',
                body: 'Speak before and after major purchases or story events. A conversation may unlock the next gift or special interaction.',
            },
            {
                title: 'Verify the completion proof',
                body: 'Bond Forged finishes the heart track, but it does not mean every later scene or character prophecy is complete. Check the relationship page and any linked prophecy or achievement for the remaining narrative thread.',
            },
        ],
        fallback:
            'If a character accepts no gift and offers no new dialogue, stop spending resources. Check the relationship page for the next event, route, story, or one-night delay and pursue another completion target in parallel.',
        fallbackLinks: [{ href: '/knowledge/relationships/', label: 'Find that character’s next relationship gate' }],
        exit: [
            'Every relationship page shows complete or one exact remaining gate.',
            'Reserved gifts have named recipients.',
            'Field encounters are paired with another route objective.',
            'No locked heart is being attacked with repeated unusable gifts.',
        ],
    },
    {
        id: 'fated-list-cleanup',
        milestone: 'complete',
        title: 'Complete the Fated List in efficient batches',
        spoilerLevel: 'ending',
        entry: 'Normal progression has completed most passive prophecy requirements and the remaining objectives are visible.',
        objective:
            'Finish every Fated List prophecy by grouping compatible objectives and using each prophecy page for its reveal, completion, reward, and blockers.',
        why: 'Prophecies mix discovery, collection, relationships, bosses, systems, and story. Chasing them one at a time creates unnecessary nights.',
        learn: [
            'A prophecy can progress before it becomes visible.',
            'Boon and Hammer lists usually span many nights.',
            'Story and relationship prophecies should be solved through their prerequisite chain, not by random repetition.',
        ],
        steps: [
            {
                title: 'Claim completed natural progress first',
                body: 'Open the Fated List and claim every finished entry. Recheck purchases after rewards because Ashes, Psyche, Moon Dust, Nightmare, and other materials can close the next target.',
            },
            {
                title: 'Batch Olympian and Boon discovery',
                body: 'Choose one god, missing normal Boons, and a reachable Duo or Legendary path for the current aspect. Use Keepsakes and pinned prerequisites without weakening the main damage plan.',
            },
            {
                title: 'Batch weapon and Hammer discovery',
                body: 'Use the weapon whose Hammer list remains incomplete. Accept missing upgrades when they keep the run functional, and combine the night with its Testament or clear objective.',
            },
            {
                title: 'Batch systems and collections at the Crossroads',
                body: 'Finish Arcana reveals, tools, Familiars, Keepsakes, garden, Broker, wells, and upgrade prophecies together with their corresponding purchases.',
            },
            {
                title: 'Batch route and guardian objectives',
                body: 'Pair miniboss, Guardian, Fear, route, and weapon conditions when their requirements do not conflict.',
            },
            {
                title: 'Finish story and relationship prophecies last',
                body: 'Use the exact relationship or story chain on each prophecy page. These objectives often depend on dialogue timing and cannot be forced by another identical clear.',
            },
        ],
        fallback:
            'If progress does not register, open that prophecy page and verify three things: the prophecy is revealed, the official objective name matches what was completed, and every prerequisite event or claimed reward is satisfied.',
        fallbackLinks: [{ href: '/knowledge/prophecies/', label: 'Open Fated List prophecies' }],
        exit: [
            'Every prophecy is claimed, or each remaining entry has one exact unmet prerequisite.',
            'Boon and Hammer discovery is grouped by god or weapon.',
            'No story prophecy is being pursued through blind repeated clears.',
        ],
    },
    {
        id: 'exhaustive-completion',
        milestone: 'complete',
        title: 'Finish the completion checklist',
        spoilerLevel: 'ending',
        entry: 'The true ending, major systems, and ordinary postgame progression are complete.',
        objective:
            'Check every part of the game with a fixed endpoint, finish its remaining objectives, and separate repeatable optional content from unfinished progress.',
        why: 'Full completion needs a concrete checklist. Each area should show either a finished state or a precise remaining requirement.',
        learn: [
            'The searchable knowledge area contains the detailed checklists.',
            'Each area needs a clear completion state.',
            'A cosmetic or repeatable sink can be named as optional without hiding it.',
        ],
        steps: [
            {
                title: 'Story and characters',
                body: 'Confirm the true ending, all narrative milestones, every relationship maximum, and each story-sensitive prophecy or achievement.',
                references: [reference('world-progression/achievement', 'AchTrueEnding')],
            },
            {
                title: 'Weapons and permanent power',
                body: 'Confirm every weapon and aspect, the complete Arcana board, Keepsake ranks, Familiar bonds, and required Hex Path use.',
            },
            {
                title: 'Cauldron and economy',
                body: 'Confirm all relevant incantations, gathering tools, garden upgrades, Broker access, fish selling, resource exchanges, wells, fountains, and finite market unlocks.',
            },
            {
                title: 'Challenges',
                body: 'Confirm all Oath conditions encountered, every available Testament bounty, required Fear clears, Chaos Trials, Nightmare spending, and linked achievements.',
            },
            {
                title: 'Collections',
                body: 'Claim every prophecy, complete every achievement, and finish each remaining Boon, Hammer, enemy, Guardian, encounter, fish, plant, and resource objective with a fixed endpoint.',
                links: [{ href: '/knowledge/enemies/', label: 'Open the enemy and Guardian reference' }],
            },
            {
                title: 'Name the optional remainder',
                body: 'Separate repeatable prestige, resource accumulation, and cosmetics that unlock no guide-relevant state. Completion is still honest when optional infinite work is explicitly excluded.',
            },
        ],
        fallback:
            'When one checklist item remains open, follow its related requirements back to the first unmet prerequisite. Finish that prerequisite before spending another night on the visible endpoint.',
        exit: [
            'Every guide-relevant story, quest, unlock, relationship, prophecy, achievement, and finite system is complete.',
            'Every remaining optional or repeatable activity is named.',
            'No objective is left unexplained or blocked by an unknown condition.',
        ],
    },
];

const guideChapterOrder = [
    'before-the-first-night',
    'the-first-night',
    'first-return',
    'second-night',
    'second-return',
    'first-permanent-choices',
    'tools-incantations-fated-list',
    'first-clear-build',
    'productive-night-loop',
    'guardian-preparation',
    'first-route-clear',
    'open-the-surface',
    'gods-and-field-allies',
    'weapons-and-aspects',
    'complete-loadout',
    'advanced-boon-planning',
    'advance-both-routes',
    'true-ending',
    'rescue-the-fates',
    'fear-testaments-nightmare',
    'trials-bounties-ranks',
    'relationship-cleanup',
    'fated-list-cleanup',
    'exhaustive-completion',
] as const;

const guideChapterById = new Map(authoredGuideChapters.map((chapter) => [chapter.id, chapter]));

if (guideChapterById.size !== authoredGuideChapters.length) {
    throw new Error('Guide chapter ids must be unique.');
}
if (guideChapterOrder.length !== authoredGuideChapters.length) {
    throw new Error('Guide chapter order must include every authored chapter exactly once.');
}

export const guideChapters: GuideChapter[] = guideChapterOrder.map((id) => {
    const chapter = guideChapterById.get(id);
    if (!chapter) throw new Error(`Guide chapter order references a missing chapter: ${id}`);
    return chapter;
});

const unscopedRankingClaim = /\b(best|strongest|optimal|easiest|safest)\b/iu;

for (const chapter of guideChapters) {
    if (!chapter.entry.trim() || !chapter.objective.trim() || !chapter.why.trim() || !chapter.fallback.trim()) {
        throw new Error(`Guide chapter ${chapter.id} is missing its player state, objective, reason, or fallback.`);
    }
    if (chapter.steps.length === 0 || chapter.exit.length === 0) {
        throw new Error(`Guide chapter ${chapter.id} has no actionable steps or completion proof.`);
    }

    const recommendationCopy = [
        chapter.objective,
        chapter.why,
        chapter.fallback,
        ...chapter.steps.flatMap((step) => [step.title, step.body]),
        ...(chapter.loadout?.items.flatMap((item) => [item.value, item.reason]) ?? []),
        ...(chapter.choices?.flatMap((choice) => [choice.choice, choice.reason]) ?? []),
    ];
    const unsupportedClaim = recommendationCopy.find((text) => unscopedRankingClaim.test(text));
    if (unsupportedClaim) {
        throw new Error(
            `Guide chapter ${chapter.id} contains an unscoped ranking claim: ${JSON.stringify(unsupportedClaim)}`
        );
    }
}

export const completionDomains = [
    {
        href: '/knowledge/prophecies/',
        title: 'Fated List prophecies',
        scope: 'Reveal each prophecy, follow its solution path, and claim its reward.',
    },
    {
        href: '/knowledge/incantations/',
        title: 'Incantations',
        scope: 'See what each Cauldron recipe unlocks, when it appears, and what it costs.',
    },
    {
        href: '/knowledge/achievements/',
        title: 'Achievements',
        scope: 'Find each exact trigger and the progression that can be completed alongside it.',
    },
    {
        href: '/knowledge/builds/',
        title: 'Weapons and aspects',
        scope: 'Build every aspect with compatible Boons, Arcana, Hammers, Keepsakes, Familiar, and Hex.',
    },
    {
        href: '/knowledge/oath/',
        title: 'Fear and Testaments',
        scope: 'Match each Testament to its weapon, route, Fear requirement, and reward.',
    },
    {
        href: '/knowledge/relationships/',
        title: 'Relationships',
        scope: 'Follow every gift, lock, special interaction, reward, and connected quest.',
    },
    {
        href: '/knowledge/resources/',
        title: 'Resources and economy',
        scope: 'Gathering, fish sale values, cultivation, market exchanges, and reservation advice.',
    },
] as const;
