export type CrossroadsLink = {
    href: string;
    label: string;
};

export type CrossroadsTask = {
    title: string;
    body: string;
    links?: CrossroadsLink[];
};

export type CrossroadsService = {
    when: string;
    title: string;
    body: string;
    links: CrossroadsLink[];
};

export const crossroadsKnowledge = {
    searchTerms: [
        'Crossroads return checklist',
        'what to do after a run',
        'what to do between nights',
        'first return Cauldron purifying',
        'second return Cauldron available',
        'speech bubble conversation',
        'Cauldron recipe missing',
        'Incantation reveal limit',
        'Forget-Me-Not door marker',
        'Altar Grasp Arcana',
        'Silver Pool gathering tools',
        'Wretched Broker',
        'Fated List',
        'garden',
        'Training Grounds',
    ],
    firstReturnChecklist: [
        {
            title: 'Talk to every marked character',
            body: 'Start with speech-bubble markers. Conversations can open another scene, recipe, relationship step, or objective, so process them before deciding that the hub has nothing new.',
            links: [{ href: '/knowledge/relationships/', label: 'Relationships and gifts' }],
        },
        {
            title: 'Use the Altar of Ashes',
            body: 'Reveal and activate The Sorceress when 1 Ash is available. Revealing a card and fitting it within Grasp are separate checks.',
            links: [
                { href: '/knowledge/arcana/', label: 'Arcana board' },
                { href: '/knowledge/records/arcana/grasp/', label: 'Grasp capacity' },
            ],
        },
        {
            title: 'Inspect the Silver Pool and Training Grounds',
            body: "The Silver Pool is open, but its gathering-tool tab requires Night's Craftwork. Keep the Staff equipped and practice before leaving.",
            links: [
                { href: '/knowledge/weapons/', label: 'Weapons and aspects' },
                { href: '/guide/first-return/', label: 'First-return walkthrough' },
            ],
        },
        {
            title: 'Leave the purifying Cauldron for the next return',
            body: 'The Cauldron cannot brew anything during the first return. Begin the second night, then use it when you come back.',
            links: [{ href: '/guide/second-night/', label: 'Prepare the second night' }],
        },
    ] satisfies CrossroadsTask[],
    laterReturnChecklist: [
        {
            title: 'Talk to every marked character',
            body: 'Process conversations before checking conditional recipes, relationships, or objectives.',
            links: [{ href: '/knowledge/relationships/', label: 'Relationships and gifts' }],
        },
        {
            title: 'Read the Cauldron before spending',
            body: 'Check newly revealed Incantations, their exact costs, and the system each one opens. An absent recipe can be waiting on a reveal pass, event, or conversation rather than materials.',
            links: [{ href: '/knowledge/incantations/', label: 'Incantation requirements' }],
        },
        {
            title: 'Check Arcana, Grasp, and the Silver Pool',
            body: 'Confirm that active cards fit within Grasp, then choose the next weapon, gathering tool, or aspect purchase by its exact cost.',
            links: [
                { href: '/knowledge/arcana/', label: 'Arcana board' },
                { href: '/knowledge/resources/', label: 'Resources and gathering' },
            ],
        },
        {
            title: 'Process gifts and long-term objectives',
            body: 'Give a gift only when the recipient can accept the next one, then check the Fated List and any newly opened garden or Broker task.',
            links: [
                { href: '/knowledge/keepsakes/', label: 'Keepsakes' },
                { href: '/knowledge/prophecies/', label: 'Fated List prophecies' },
            ],
        },
        {
            title: 'Leave with one next-night purpose',
            body: 'Choose one route, resource, conversation, unlock, or run problem to advance. Practice the equipped weapon, then begin the night.',
            links: [
                { href: '/knowledge/builds/', label: 'Aspect builds' },
                { href: '/guide/second-return/', label: 'Second-return walkthrough' },
            ],
        },
    ] satisfies CrossroadsTask[],
    services: [
        {
            when: 'From the second return',
            title: 'Cauldron',
            body: 'Permanent Incantations open services, route features, recovery, and story systems. Recheck it after every return.',
            links: [{ href: '/knowledge/incantations/', label: 'Browse Incantations' }],
        },
        {
            when: 'Available from the first return',
            title: 'Altar of Ashes',
            body: 'Spend Ashes to reveal adjacent Arcana Cards and Psyche to raise Grasp. Build only the active board that currently fits.',
            links: [{ href: '/knowledge/arcana/', label: 'Plan Arcana' }],
        },
        {
            when: "First return. Tools after Night's Craftwork",
            title: 'Silver Pool',
            body: 'Manage Nocturnal Arms from the first return. The gathering-tool tab opens after Night’s Craftwork. Weapon aspects arrive later.',
            links: [
                { href: '/knowledge/records/incantations/nights-craftwork/', label: "Night's Craftwork" },
                { href: '/knowledge/weapons/', label: 'Weapon unlocks' },
            ],
        },
        {
            when: 'As relationships open',
            title: 'Keepsake cabinet and gifts',
            body: 'First accepted gifts usually award Keepsakes. Later gifts follow relationship locks and conversations, not a universal night count.',
            links: [
                { href: '/knowledge/relationships/', label: 'Relationship gates' },
                { href: '/knowledge/keepsakes/', label: 'Keepsake effects' },
            ],
        },
        {
            when: 'After its Incantation',
            title: 'Wretched Broker',
            body: 'Exchange Bones for planned shortages and selected weekly stock. Avoid converting rare materials without a named purchase.',
            links: [{ href: '/knowledge/resources/', label: 'Economy and resources' }],
        },
        {
            when: 'As their recipes and scenes open',
            title: 'Garden and Fated List',
            body: 'Grow the plant needed by the next recipe and batch compatible prophecy objectives into useful nights.',
            links: [
                { href: '/knowledge/incantations/', label: 'Garden unlocks' },
                { href: '/knowledge/prophecies/', label: 'Prophecy solutions' },
            ],
        },
        {
            when: 'Before every departure',
            title: 'Training Grounds',
            body: 'Equip the intended weapon, verify Arcana and Keepsake choices, then rehearse the one combat sequence the next night will use.',
            links: [{ href: '/knowledge/builds/', label: 'Choose a complete build' }],
        },
    ] satisfies CrossroadsService[],
} as const;
