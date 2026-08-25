const COLLECTION_DESCRIPTIONS = {
    achievements:
        'Find every Hades II achievement trigger, prerequisite, related system, and the progression step that helps you complete it.',
    arcana: 'Compare every Hades II Arcana Card by effect, Grasp cost, unlock order, and fit with each weapon and aspect.',
    boons: 'Browse every Hades II god and Boon, then compare effects, prerequisites, scaling, status curses, Infusions, and complete build options.',
    enemies:
        'Find where each Hades II enemy appears, what role it fills, and the combat details available for that encounter.',
    familiars:
        'Compare every Hades II Animal Familiar by passive effect, gathering ability, recruitment requirement, and upgrade path.',
    hammers:
        'Find every Hades II Daedalus Hammer upgrade, the weapon and move it changes, and the builds that can use it well.',
    hexes: 'Compare every Hades II Hex by effect, Path of Stars upgrades, Magick requirement, and fit with each weapon and aspect.',
    incantations:
        'Find every Hades II incantation, including what reveals it, what it costs, what it unlocks, and when to brew it.',
    keepsakes:
        'Compare every Hades II Keepsake by gift source, effect, rank, best use, and the point when another Keepsake is better.',
    oath: 'Compare every Hades II Oath condition and Testament by Fear effect, required weapon, route, guardian, and Nightmare reward.',
    prophecies:
        'Find every Hades II Fated List prophecy, including how it appears, what completes it, what blocks it, and its reward.',
    regions:
        'Explore every Hades II region, route, encounter, friend room, reward, Surface condition, and progression effect.',
    relationships:
        'Find every Hades II relationship requirement, including gifts, heart locks, meeting places, required events, and rewards.',
    resources:
        'Find every Hades II resource, including where to get it, what uses it, what to reserve, and when it can be traded or sold.',
    story: 'Find the Hades II story requirement that is blocking progress, including its route, conversation, relationship, or prophecy.',
    weapons:
        'Compare every Hades II weapon and aspect by unlock order, rank cost, attack pattern, defining move, and complete build plan.',
} as const;

type CollectionSlug = keyof typeof COLLECTION_DESCRIPTIONS;

const GUIDE_TITLES: Record<string, string> = {
    'before-the-first-night': 'Beginner Combat Guide: Controls & First Room',
    'the-first-night': 'First Night Walkthrough: Apollo, Staff & Rewards',
    'first-return': 'First Crossroads Return: Altar & Silver Pool',
    'second-night': 'Second Night: Moly, Ashes & Early Unlocks',
    'second-return': "Unlock the Cauldron & Night's Craftwork",
    'first-permanent-choices': 'Early Arcana, Grasp & Weapon Upgrades',
    'productive-night-loop': 'Run Preparation & Resource Priorities',
    'tools-incantations-fated-list': 'Early Unlocks: Tools, Incantations & Fated List',
    'guardian-preparation': 'First-Clear Preparation: Fix Your Staff Build',
    'first-clear-build': "First-Clear Build: Witch's Staff Special",
    'first-route-clear': 'First Route Clear: Rewards & Next Unlocks',
    'open-the-surface': 'How to Unlock the Surface & Remove the Curse',
    'gods-and-field-allies': 'God & Field Ally Unlock Requirements',
    'weapons-and-aspects': 'Weapon & Aspect Unlock Guide',
    'complete-loadout': 'Loadout Guide: Arcana, Keepsakes, Familiars & Hexes',
    'advanced-boon-planning': 'Boon Planning: Duos, Legendaries & Infusions',
    'advance-both-routes': 'Ending Requirements: Zagreus, Gigaros & Typhon',
    'true-ending': 'True Ending Guide: Rescue the House & Reach Credits',
    'rescue-the-fates': 'Epilogue Guide: Find the Fates',
    'fear-testaments-nightmare': 'Fear, Testaments & Nightmare Rewards',
    'trials-bounties-ranks': 'Chaos Trials, Bounties & Remaining Upgrades',
    'relationship-cleanup': 'Relationship Guide: Gifts, Heart Locks & Events',
    'fated-list-cleanup': 'Fated List Guide: Prophecy Completion & Rewards',
    'exhaustive-completion': 'Completion Checklist: Remaining Goals & Systems',
};

export function guideMetadataTitle(chapterId: string): string {
    const title = GUIDE_TITLES[chapterId];
    if (!title) throw new Error(`Guide chapter has no authored metadata title: ${chapterId}`);
    return title;
}

const possessive = (name: string): string => (name.endsWith('s') ? `${name}'` : `${name}'s`);

export function collectionMetadataDescription(slug: string): string {
    const description = COLLECTION_DESCRIPTIONS[slug as CollectionSlug];
    if (!description) throw new Error(`Knowledge collection has no authored metadata description: ${slug}`);
    return description;
}

const RECORD_DESCRIPTION_BUILDERS: Record<CollectionSlug, (name: string, recordType: string) => string> = {
    achievements: (name) =>
        `See how to unlock ${name} in Hades II, including its trigger, prerequisites, and related progression steps.`,
    arcana: (name, recordType) =>
        recordType === 'mechanics/grasp-progression'
            ? `See how ${name} works in Hades II, how to increase it, and how it determines which Arcana Cards you can activate.`
            : `See what ${name} does in Hades II, how much Grasp it uses, when it unlocks, and which builds benefit from it.`,
    boons: (name, recordType) => {
        if (recordType === 'mechanics/god') {
            return `See when ${possessive(name)} Boons unlock in Hades II, which effects they offer, and how they connect to builds and prerequisites.`;
        }
        if (recordType === 'mechanics/status-element') {
            return `See how ${name} works in Hades II, which Boons provide it, and which Infusions or builds require it.`;
        }
        return `See what ${name} does in Hades II, which god offers it, what it requires, and which weapons and builds use it best.`;
    },
    enemies: (name) =>
        `See where ${name} appears in Hades II, what role this enemy fills, and the combat details available for its encounter.`,
    familiars: (name) =>
        `See how to recruit ${name} in Hades II, including this Familiar's passive effects, gathering ability, and upgrade path.`,
    hammers: (name) =>
        `See how ${name} changes its weapon in Hades II, which move it affects, and which aspects and builds can use it well.`,
    hexes: (name) =>
        `See what ${name} does in Hades II, how much Magick it needs, what its Path of Stars changes, and which builds use it well.`,
    incantations: (name) =>
        `Find the condition that reveals ${name} in Hades II, what the incantation costs, what it unlocks, and which requirements come next.`,
    keepsakes: (name) =>
        `See how to obtain ${name} in Hades II, what its ranks change, when to equip it, and when another Keepsake is better.`,
    oath: (name, recordType) =>
        recordType === 'world-progression/testament-bounty'
            ? `See the weapon, route, Fear requirement, guardian, and Nightmare reward for ${name} in Hades II.`
            : `See what ${name} changes in Hades II, how much Fear it adds, and when to use this Oath condition.`,
    prophecies: (name) =>
        `See how ${name} appears in Hades II, what completes this Fated List prophecy, what can block it, and what it rewards.`,
    regions: (name, recordType) => {
        if (recordType === 'world-progression/region') {
            return `Explore ${name} in Hades II, including its route, encounters, friend rooms, rewards, resources, and progression requirements.`;
        }
        return `See where ${name} appears in Hades II, what triggers it, and how it affects a route, encounter, reward, or Surface attempt.`;
    },
    relationships: (name) =>
        `See every Hades II relationship requirement for ${name}, including gifts, heart locks, meeting places, required events, and rewards.`,
    resources: (name, recordType) => {
        if (recordType === 'mechanics/gathering-tool') {
            return `See how to unlock and upgrade ${name} in Hades II, what it gathers, and which resources its upgrades require.`;
        }
        if (recordType === 'mechanics/fish') {
            return `See where to catch ${name} in Hades II, how rare it is, and what the fish is worth when sold.`;
        }
        return `See where to get ${name} in Hades II, what uses it, what to reserve it for, and when it can be traded or sold.`;
    },
    story: (name) =>
        `See how to reach ${name} in Hades II, including the route, conversations, relationships, and other story requirements involved.`,
    weapons: (name, recordType) =>
        recordType === 'mechanics/weapon-aspect'
            ? `See how to unlock and rank ${name} in Hades II, which move defines the aspect, and which complete build supports it.`
            : `See how to unlock ${name} in Hades II, how its attacks work, which aspects it has, and which complete builds use it.`,
};

export function recordMetadataDescription(
    name: string,
    collectionSlug: string,
    recordType: string,
    summary: string
): string {
    const effectDescription = `${name} in Hades II: ${summary.replaceAll(/\s+/gu, ' ').trim()}`;
    if (
        ['mechanics/boon', 'mechanics/arcana-card', 'mechanics/keepsake', 'mechanics/hex'].includes(recordType) &&
        summary.trim() &&
        effectDescription.length <= 160
    ) {
        return effectDescription;
    }
    const buildDescription = RECORD_DESCRIPTION_BUILDERS[collectionSlug as CollectionSlug];
    if (!buildDescription) {
        throw new Error(`Knowledge record has no authored metadata description family: ${collectionSlug}`);
    }
    return buildDescription(name, recordType);
}
