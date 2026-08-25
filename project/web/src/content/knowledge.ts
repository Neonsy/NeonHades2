import type { PublicationPage } from '../lib/publication';

export type CollectionGuide = {
    intro: string;
    useFor: string;
    questions: string[];
};

export const collectionGuides: Record<string, CollectionGuide> = {
    achievements: {
        intro: 'Find the exact trigger, the systems it depends on, and the walkthrough chapter that makes it efficient.',
        useFor: 'Use this after the true ending to finish the remaining achievements, or earlier when one overlaps the route you already plan to run.',
        questions: [
            'What actually triggers it?',
            'Can it overlap normal progression?',
            'Which prerequisite is still missing?',
        ],
    },
    arcana: {
        intro: 'Compare what each card changes, how much Grasp it uses, and which aspect can turn that cost into real value.',
        useFor: 'Start with survival and the resource your weapon consumes. Add conditional damage or rerolls only after those needs are covered.',
        questions: [
            'Does this card support the moves you use most?',
            'Can the board activate it?',
            'What would have to leave?',
        ],
    },
    boons: {
        intro: 'Move from a god or Boon to its prerequisites, aspect affinity, scaling, and connected build plans.',
        useFor: 'Strengthen the move the aspect repeats most. Pursue Duo, Legendary, status, and Infusion paths only when their prerequisites improve that same plan.',
        questions: ['Which move does it change?', 'What must be taken first?', 'Which aspects use it best?'],
    },
    enemies: {
        intro: 'Identify each foe by region and encounter role, then check the combat details the game exposes for it.',
        useFor: 'Use this after meeting an unfamiliar foe or Guardian. Start with its region and role, then look for the behavior that is ending the run.',
        questions: [
            'Where does it appear?',
            'Is it a normal foe, miniboss, or Guardian?',
            'Which behavior needs an answer?',
        ],
    },
    familiars: {
        intro: 'Compare combat passives, gathering access, recruitment requirements, and upgrade paths for every Animal Familiar.',
        useFor: 'Choose the Familiar that fixes the current build or resource target. Frinos is the safest first choice while maximum Life still limits progress.',
        questions: [
            'What does the passive solve?',
            'Which gathering bond matters now?',
            'What unlocks the next upgrade?',
        ],
    },
    hammers: {
        intro: 'Find the weapon compatibility and mechanical change behind every Daedalus Hammer upgrade.',
        useFor: 'Choose Hammers that strengthen the move already carrying the build. Skip upgrades that replace the safe plan with one you cannot support.',
        questions: ['Which weapon can receive it?', 'Which move changes?', 'Does it preserve the planned sequence?'],
    },
    hexes: {
        intro: 'Compare each Hex, its base effect, Path of Stars upgrades, Magick demand, and fit with the moves your weapon uses most.',
        useFor: 'Prefer safety or healing while progression is fragile. Take channels, transformations, or delayed damage when the aspect can create their window.',
        questions: [
            'Can you use it without abandoning your safest attack sequence?',
            'How much Magick must be spent?',
            'What does the Path change?',
        ],
    },
    incantations: {
        intro: 'See exactly when each Cauldron recipe appears, what it costs, and which permanent system or convenience it unlocks.',
        useFor: 'Buy progression, resource access, and route systems before convenience or cosmetics. If a recipe is absent, follow its first unmet reveal requirement.',
        questions: ['What reveals it?', 'What does it unlock?', 'Should its materials be reserved now?'],
    },
    keepsakes: {
        intro: "Compare acquisition, rank effects, leveling value, and the condition that ends each Keepsake's job.",
        useFor: 'Treat Keepsakes as a route sequence. Force the needed god, then switch when that god appears or a limited effect is spent.',
        questions: ['How is it acquired?', 'When is its effect active?', 'When should it be replaced?'],
    },
    oath: {
        intro: 'Trace every Oath condition, Fear effect, and weapon-bound Testament target with its exact route and reward.',
        useFor: 'Set the weapon and route first, then add only enough Fear for the current Testament. Change one condition at a time while learning.',
        questions: [
            'Which weapon and route are required?',
            'What does this Fear condition change?',
            'Where does the Nightmare go?',
        ],
    },
    prophecies: {
        intro: 'Every Fated List entry includes its reveal condition, exact completion requirements, and reward.',
        useFor: 'Let natural progress complete broad discovery goals. Deliberately route only the objective that cannot finish through ordinary story, build, or resource play.',
        questions: [
            'How does it appear?',
            'What must be completed?',
            'Which other objective can share the same night?',
        ],
    },
    regions: {
        intro: 'Trace each route through regions, encounters, friend rooms, run rewards, the Surface ward, and the Blessing of Strife.',
        useFor: 'Use this to plan route-specific materials, locate an encounter friend, or diagnose a progression effect that changes an early Surface attempt.',
        questions: ['Which route and region?', 'What can appear here?', 'Is an early progression effect active?'],
    },
    relationships: {
        intro: "Find every character's first gift reward, current heart lock, next accepted interaction, meeting place, and connected narrative requirement.",
        useFor: "A first accepted Nectar usually grants a Keepsake. Keepsake rank then grows through encounters while equipped. The heart track is separate. After Empath's Intuition appears, follow the next-heart prompt in the Book of Shadows before spending another gift. A returned gift means another event or conversation is required first.",
        questions: [
            'What does the first accepted Nectar reward?',
            'Can the next gift be accepted now?',
            'Which event, route, or conversation opens the lock?',
            'Does Bond Forged finish the heart track or the whole narrative thread?',
        ],
    },
    resources: {
        intro: 'Follow each material from its room reward or acquisition source to its uses, exchanges, cultivation cycle, fish sale value, and reservation advice.',
        useFor: 'Choose one planned purchase, reserve its scarce inputs, and gather or trade only what closes that target.',
        questions: ['Where does it come from?', 'What should it fund first?', 'Can it be sold or exchanged yet?'],
    },
    story: {
        intro: 'Find the walkthrough or focused reference for the exact story objective that has stopped moving.',
        useFor: 'Start with the walkthrough chapter that matches your progress. Open a focused reference only when one relationship, prophecy, or route encounter is blocking the next event.',
        questions: [
            'Are you working toward the main ending or the epilogue?',
            'Is a character bond or Fated List prophecy blocking progress?',
            'Does the next event happen on a route or at the Crossroads?',
        ],
    },
    weapons: {
        intro: 'Compare all six Nocturnal Arms, their unlock chains, 24 aspects, rank costs, attack patterns, and complete build plans.',
        useFor: 'Unlock in prerequisite order, then finish one reliable aspect before spreading Nightmare across side builds.',
        questions: ['What unlocks it?', 'Which move defines the aspect?', 'Which build plan supports that move?'],
    },
};

export const featuredCollections = [
    {
        slug: 'relationships',
        title: 'Understand gifts and relationships',
        detail: 'Separate the first Keepsake reward, equipped Keepsake rank, heart locks, meeting locations, and later story events.',
    },
    {
        slug: 'weapons',
        title: 'Choose a weapon and aspect',
        detail: 'Start from the moves the aspect uses most, then connect its Boons, Arcana, Hammers, Keepsakes, Familiar, and Hex.',
    },
    {
        slug: 'prophecies',
        title: 'Solve a Fated List entry',
        detail: 'See how it appears, what completes it, and what it rewards.',
    },
    {
        slug: 'incantations',
        title: 'Find the next Cauldron unlock',
        detail: 'Read the exact reveal chain, cost, and effect before spending materials.',
    },
    {
        slug: 'resources',
        title: 'Plan a resource target',
        detail: 'Trace ore, plants, fish, tools, exchanges, cultivation, and the purchase worth reserving for.',
    },
] as const;

export function collectionSlug(page: PublicationPage): string {
    return page.id.split('/')[1] ?? page.id;
}
