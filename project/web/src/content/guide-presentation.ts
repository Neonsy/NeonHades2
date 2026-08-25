export type ChapterSection =
    'orientation' | 'loadout' | 'learning' | 'actions' | 'choices' | 'overlap' | 'fallback' | 'checklist';

export type ChapterVisualForm =
    | 'night'
    | 'altar'
    | 'workshop'
    | 'route'
    | 'constellation'
    | 'armory'
    | 'story'
    | 'oath'
    | 'bond'
    | 'prophecy'
    | 'ledger';

export type ChapterPresentation = {
    form: ChapterVisualForm;
    headings: {
        orientation: string;
        learning: string;
        actions: string;
        choices: string;
        overlap: string;
        fallback: string;
        checklist: string;
    };
    order: ChapterSection[];
};

const actionPlan: ChapterSection[] = [
    'orientation',
    'loadout',
    'learning',
    'actions',
    'choices',
    'overlap',
    'fallback',
    'checklist',
];

const dependencyPlan: ChapterSection[] = [
    'orientation',
    'learning',
    'actions',
    'overlap',
    'choices',
    'fallback',
    'checklist',
];

const completionPlan: ChapterSection[] = [
    'orientation',
    'actions',
    'overlap',
    'learning',
    'choices',
    'fallback',
    'checklist',
];

const presentations: Record<string, ChapterPresentation> = {
    'before-the-first-night': {
        form: 'night',
        headings: {
            orientation: 'What a fresh save gives you',
            learning: 'Learn the four actions that keep you safe',
            actions: 'Practice this before chasing damage',
            choices: 'When two safe options compete',
            overlap: 'Progress that can share the same night',
            fallback: 'If the controls still feel crowded',
            checklist: 'Ready for the first offer',
        },
        order: actionPlan,
    },
    'the-first-night': {
        form: 'night',
        headings: {
            orientation: 'The fixed first room',
            learning: 'Read the first rewards correctly',
            actions: 'Play the first night in this order',
            choices: 'Choose by the problem in front of you',
            overlap: 'Useful progress during the same night',
            fallback: 'If the first night goes badly',
            checklist: 'Ready to return to the Crossroads',
        },
        order: actionPlan,
    },
    'first-return': {
        form: 'altar',
        headings: {
            orientation: 'What is available on the first return',
            learning: 'Separate the open systems from the locked Cauldron',
            actions: 'Use the first return in this order',
            choices: 'Spend only what the first return supports',
            overlap: 'Prepare the second night at the same time',
            fallback: 'If the first return produced few materials',
            checklist: 'Ready to begin the second night',
        },
        order: actionPlan,
    },
    'second-night': {
        form: 'route',
        headings: {
            orientation: 'The run between the two early returns',
            learning: 'Know which materials make the next return useful',
            actions: 'Fund the first unlocks without changing the combat plan',
            choices: 'Choose survival before a fragile resource run',
            overlap: 'Carry permanent progress through the same night',
            fallback: 'If Moly or Ashes do not appear',
            checklist: 'Ready to use the Cauldron',
        },
        order: actionPlan,
    },
    'second-return': {
        form: 'workshop',
        headings: {
            orientation: 'The Cauldron is available now',
            learning: 'Follow the recipe and tool dependency chain',
            actions: 'Open the first gathering access in this order',
            choices: 'Respond to the exact missing recipe or material',
            overlap: 'Name the next permanent target before leaving',
            fallback: "If Night's Craftwork is delayed",
            checklist: 'The first gathering plan is ready',
        },
        order: dependencyPlan,
    },
    'first-permanent-choices': {
        form: 'altar',
        headings: {
            orientation: 'Start with survival and access',
            learning: 'What the first permanent upgrades change',
            actions: 'Buy these upgrades before optional ones',
            choices: 'When two upgrades compete',
            overlap: 'Reserve resources for the next unlocks',
            fallback: 'If the full Arcana board does not fit yet',
            checklist: 'The permanent foundation is in place',
        },
        order: actionPlan,
    },
    'productive-night-loop': {
        form: 'route',
        headings: {
            orientation: 'Give every night one permanent purpose',
            learning: 'Separate run strength from permanent progress',
            actions: 'Plan the night before the first door',
            choices: 'Choose the reward that solves the current problem',
            overlap: 'Advance these goals together',
            fallback: 'If the preferred gods do not appear',
            checklist: 'The night produced lasting progress',
        },
        order: actionPlan,
    },
    'tools-incantations-fated-list': {
        form: 'workshop',
        headings: {
            orientation: 'Choose the permanent systems that multiply every night',
            learning: 'Know which ritual unlocks each service',
            actions: 'Brew and craft in this order',
            choices: 'When materials have two uses',
            overlap: 'Pair system unlocks with route goals',
            fallback: 'If a recipe has not appeared',
            checklist: 'The Crossroads services are working',
        },
        order: dependencyPlan,
    },
    'guardian-preparation': {
        form: 'route',
        headings: {
            orientation: 'Name the encounter that ends the run',
            learning: 'Change the cause, not the whole build',
            actions: 'Repair one failure at a time',
            choices: 'Choose the repair with the clearest effect',
            overlap: 'Keep permanent progress moving',
            fallback: 'If Apollo does not complete the plan',
            checklist: 'The next Guardian attempt has one clear plan',
        },
        order: actionPlan,
    },
    'first-clear-build': {
        form: 'armory',
        headings: {
            orientation: 'Use one Staff plan for the whole route',
            learning: 'Know what each part of the build must solve',
            actions: 'Assemble the first-clear build in this order',
            choices: 'Use these substitutions when needed',
            overlap: 'Improve the same plan between attempts',
            fallback: 'If the exact Apollo choices do not appear',
            checklist: 'The build is ready for a full-route attempt',
        },
        order: actionPlan,
    },
    'first-route-clear': {
        form: 'route',
        headings: {
            orientation: 'Carry the practiced plan through the final region',
            learning: 'What changes after a route clear',
            actions: 'Finish the route and process the return',
            choices: 'Choose the next route by its requirement',
            overlap: 'Use the clear to open more than one objective',
            fallback: 'If the final encounter still wins',
            checklist: 'The first clear has been fully processed',
        },
        order: actionPlan,
    },
    'open-the-surface': {
        form: 'route',
        headings: {
            orientation: 'Separate the ward, Strife, and ordinary damage',
            learning: 'What the Surface changes',
            actions: 'Open the route and remove its progression penalties',
            choices: 'Choose the route by the resource or story gate',
            overlap: 'Pair Surface learning with permanent goals',
            fallback: 'If Strife ends the attempt early',
            checklist: 'The Surface is a deliberate route choice',
        },
        order: dependencyPlan,
    },
    'gods-and-field-allies': {
        form: 'constellation',
        headings: {
            orientation: 'Meet each god when the game opens the gate',
            learning: 'Know what field aid can change',
            actions: 'Open the remaining gods and ally encounters',
            choices: 'Choose aid for the current weapon plan',
            overlap: 'Pair rare meetings with another route goal',
            fallback: 'If a god or ally does not appear',
            checklist: 'The available god and ally pool is understood',
        },
        order: dependencyPlan,
    },
    'weapons-and-aspects': {
        form: 'armory',
        headings: {
            orientation: 'Unlock breadth before spending for depth',
            learning: 'What weapons and aspects ask you to learn',
            actions: 'Open every weapon and choose one main aspect',
            choices: 'Spend Nightmare where it changes a real plan',
            overlap: 'Use unlock nights for prophecies and Testaments',
            fallback: 'If a rank-one aspect feels weak',
            checklist: 'Every weapon family has a plan',
        },
        order: actionPlan,
    },
    'complete-loadout': {
        form: 'armory',
        headings: {
            orientation: 'Make every permanent system serve the aspect',
            learning: 'How Arcana, Keepsakes, Familiars, and Hexes connect',
            actions: 'Complete the permanent setup',
            choices: 'Choose the option that preserves the main move',
            overlap: 'Level the parts that share the same goal',
            fallback: 'If one ideal Boon is missing',
            checklist: 'The aspect remains functional through bad offers',
        },
        order: actionPlan,
    },
    'advanced-boon-planning': {
        form: 'constellation',
        headings: {
            orientation: 'Start from the move the aspect actually uses',
            learning: 'Read slots, prerequisites, and rare offers',
            actions: 'Build toward a rare target without breaking the run',
            choices: 'Stop chasing when the path is no longer realistic',
            overlap: 'Let one choice satisfy several prerequisites',
            fallback: 'If the planned god pair never forms',
            checklist: 'The build survives a missed rare target',
        },
        order: actionPlan,
    },
    'advance-both-routes': {
        form: 'story',
        headings: {
            orientation: 'Two route requirements open the ending',
            learning: 'Know what each route contributes',
            actions: 'Collect both ending requirements',
            choices: 'Choose the route with the unfinished gate',
            overlap: 'Advance story and permanent systems together',
            fallback: 'If one route objective does not advance',
            checklist: 'Both ending requirements are complete',
        },
        order: dependencyPlan,
    },
    'true-ending': {
        form: 'story',
        headings: {
            orientation: 'The final rescue chain is available',
            learning: 'Know the events that must happen in sequence',
            actions: 'Reach the credits without guessing at run counts',
            choices: 'Follow the requirement the game has opened',
            overlap: 'Keep useful late-game goals moving',
            fallback: 'If the next story event does not trigger',
            checklist: 'The family rescue and credits are complete',
        },
        order: dependencyPlan,
    },
    'rescue-the-fates': {
        form: 'story',
        headings: {
            orientation: 'The post-ending Fates chain is available',
            learning: 'Trace the epilogue requirements',
            actions: 'Find the Fates and finish the epilogue',
            choices: 'Follow the active clue rather than repeating clears',
            overlap: 'Pair the search with remaining route goals',
            fallback: 'If the next epilogue event does not appear',
            checklist: 'The Fates epilogue and reward are complete',
        },
        order: dependencyPlan,
    },
    'fear-testaments-nightmare': {
        form: 'oath',
        headings: {
            orientation: 'Raise Fear for a specific Testament',
            learning: 'Know what each active vow changes',
            actions: 'Configure the Oath and protect the build',
            choices: 'Remove the vow that attacks the main plan',
            overlap: 'Earn Nightmare while advancing the right weapon',
            fallback: 'If the chosen Fear total is unstable',
            checklist: 'The Testament setup is ready',
        },
        order: actionPlan,
    },
    'trials-bounties-ranks': {
        form: 'oath',
        headings: {
            orientation: 'Finish finite challenges before prestige spending',
            learning: 'Separate trials, Testaments, ranks, and repeatable work',
            actions: 'Clear the remaining challenge systems',
            choices: 'Spend the reward on the next finite requirement',
            overlap: 'Batch weapon and route requirements',
            fallback: 'If a supplied trial setup feels unfamiliar',
            checklist: 'The finite combat challenges are complete',
        },
        order: completionPlan,
    },
    'relationship-cleanup': {
        form: 'bond',
        headings: {
            orientation: 'Finish bonds by their actual gates',
            learning: 'Know when gifts can and cannot advance a bond',
            actions: 'Resolve each relationship efficiently',
            choices: 'Reserve gifts for the next usable recipient',
            overlap: 'Pair field meetings with route objectives',
            fallback: 'If a heart stays locked',
            checklist: 'Every bond has a finished or exact next step',
        },
        order: completionPlan,
    },
    'fated-list-cleanup': {
        form: 'prophecy',
        headings: {
            orientation: 'Turn every prophecy into a concrete route plan',
            learning: 'Separate reveal, objective, solution, and reward',
            actions: 'Batch objectives that share a route',
            choices: 'Group discoveries that share a god or weapon',
            overlap: 'Combine prophecy work with other route goals',
            fallback: 'If a prophecy refuses to advance',
            checklist: 'Every prophecy is claimed or has one exact blocker',
        },
        order: completionPlan,
    },
    'exhaustive-completion': {
        form: 'ledger',
        headings: {
            orientation: 'Define what finished means',
            learning: 'Separate finite completion from repeatable play',
            actions: 'Close every remaining finite objective',
            choices: 'Finish blockers before cosmetic or repeatable work',
            overlap: 'Batch the last compatible objectives',
            fallback: 'If one requirement is still unknown',
            checklist: 'The finite game checklist is closed',
        },
        order: completionPlan,
    },
};

export function getChapterPresentation(chapterId: string): ChapterPresentation {
    const presentation = presentations[chapterId];
    if (!presentation) throw new Error(`Guide chapter has no authored presentation: ${chapterId}`);
    return presentation;
}
