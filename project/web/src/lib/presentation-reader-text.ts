import type { JsonValue } from './publication';
import type { RecordReference } from './presentation-value-formatting';

export type ReaderFact = {
    label: string;
    value: string;
};

export type ReaderReferenceGroup = {
    heading: string;
    key: string;
    references: RecordReference[];
};

export type ReaderRuleGroup = {
    heading: string;
    items: string[];
};

export type ReaderRule =
    | { kind: 'sentence'; text: string }
    | {
          collapsed: boolean;
          groups: ReaderRuleGroup[];
          itemCount: number;
          kind: 'set';
          lead: string;
      };

export type ReaderSection = {
    heading: string;
    paragraphs: string[];
    orderedSteps?: string[];
    facts: ReaderFact[];
    references: RecordReference[];
    referenceGroups?: ReaderReferenceGroup[];
};

const isObject = (value: JsonValue | undefined): value is Record<string, JsonValue> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const isReference = (value: JsonValue | undefined): value is RecordReference & Record<string, JsonValue> =>
    isObject(value) && typeof value.id === 'string' && typeof value.recordType === 'string';

const FORBIDDEN_READER_TEXT = [
    /\{\$Keywords\./u,
    /\{IP\}/u,
    /\bQuest Progress Incomplete\b/iu,
    /\b(?:MetaRank\d+|FNightshade|HBoss|CrystalGrasp|SuitHexAspect)\b/u,
    /\b(?:No Tooltip|Boon Hack)\b/iu,
    /\b(?:Drink Drop|Mana Drop Zeus|Health Restore|Reserve Mana|Meta Reward|Run Reward|Money Drop|Health Up Total|Extra Chance Athena)\b/u,
    /\bthe listed value\b/iu,
    /\b(?:While at the Random|inflict m on)\b/iu,
    /\bchance\(s\)/iu,
    /\+[0-9]+level\b/u,
];

export function cleanReaderText(value: string): string {
    const trimmed = value
        .replace(/^Quest Progress Incomplete\s+/i, '')
        .replaceAll('{$Keywords.AttackSet}', 'Attack')
        .replaceAll('{$Keywords.SpecialSet}', 'Special')
        .replaceAll('{$Keywords.CastSet}', 'Cast')
        .replaceAll('{$Keywords.SprintSet}', 'Sprint')
        .replaceAll('{$Keywords.OmegaSet}', 'Omega moves')
        .replaceAll('{$Keywords.Attack}', 'Attack')
        .replaceAll('{$Keywords.Omega}', 'Omega moves')
        .replaceAll('{$Keywords.Shells}', 'Shells')
        .replace(/Press \{IP\} on recipes/giu, 'Mark recipes')
        .replaceAll('{IP}', 'the mark control')
        .replace(/\bMana CrystalGrasp\b/g, 'Grasp')
        .replace(/\bCrystalGrasp\b/g, 'Grasp')
        .replace(/\bBlinding Sprint\b/g, 'Blinding Rush')
        .replace(/\bPlant FNightshade Seed\b/g, 'Nightshade Seed')
        .replace(/\bPlant FNightshade\b/g, 'Nightshade')
        .replace(/\bGLotus\b/g, 'Lotus')
        .replace(/\bMetaRank1 Arcana Cards?\b/g, 'inactive Arcana Card that costs 1 Grasp')
        .replace(/\bSuitHexAspect\b/g, 'Aspect of Selene')
        .replace(/\bMixer HBoss\b/g, 'Guardian Shadow')
        .replace(/\b(Earth|Water|Air|Fire|Aether) No Tooltip\b/g, '$1')
        .replace(/\bAll Elements Boon Hack\b/g, 'all five elements')
        .replace(/\bthe Random\b/g, "Fates' Whim")
        .replace(/\bPlant F/g, '')
        .replace(/\bAlt Run\b/g, 'alternate route')
        .replace(/\bthe next the listed value encounter\b/gi, 'the listed number of encounters')
        .replace(/\bthe listed value encounter\b/gi, 'the listed number of encounters')
        .replace(/\bHealth Down\b/g, 'maximum Life')
        .replace(/\ban Death Weapon\b/g, 'a damaging projectile')
        .replace(/\bCurse (Air|Aether|Earth|Fire|Water)\b/g, '$1')
        .replace(/\bMeta Reward\b/g, 'permanent resource reward')
        .replace(/\bRun Reward\b/g, 'in-run reward')
        .replace(/\bMoney Drop\b/g, 'Gold reward')
        .replace(/\bDrink Drop\b/g, 'drink')
        .replace(/\bMana Drop Zeus\b/g, 'Magick-restoring pickup')
        .replace(/\bHealth Up Total\b/g, 'maximum Life')
        .replace(/\bHealth Restore Alt effects\b/g, 'healing effects')
        .replace(/\bHealth Restore\b/g, 'Life')
        .replace(/\bHealth\b/g, 'Life')
        .replace(/\b(?:the next )?the listed value Location\(s\)/gi, 'the listed number of locations')
        .replace(/\bthe listed value regions?\b/gi, 'the listed number of regions')
        .replace(/\bthe listed value random\b/gi, 'the listed number of random')
        .replace(/\bthe listed value boons?\b/gi, 'the listed number of Boons')
        .replace(/\bthe listed value damage\b/gi, 'damage')
        .replace(/\+the listed value Gold\b/gi, 'an amount of Gold')
        .replace(/\+([0-9]+)level\b/g, '+$1 levels')
        .replace(/\+1 levels\b/g, '+1 level')
        .replace(/\b1 chance\(s\)/g, '1 chance')
        .replace(/\b1 time\(s\)/g, 'once')
        .replace(/\b([2-9][0-9]*) time\(s\)/g, '$1 times')
        .replace(/\byou Reserve Mana ([0-9]+) Magick\b/g, '$1 Magick is reserved')
        .replace(/\byou Reserve Mana Magick\b/g, 'part of your Magick is reserved')
        .replace(/\bReserve Mana until the next chamber\b/g, 'part of your Magick is reserved until the next chamber')
        .replace(/\byou Hold your Omega\b/g, 'you channel Omega moves')
        .replace(/\bYour Omega deal\b/g, 'Your Omega moves deal')
        .replace(/\bYour Omega also deal\b/g, 'Your Omega moves also deal')
        .replace(/\byour Omega deal\b/g, 'your Omega moves deal')
        .replace(/\bYour (Attack|Special|Cast|Sprint) deal\b/g, 'Your $1 deals')
        .replace(/\bYour (Attack|Special|Cast|Sprint) also deal\b/g, 'Your $1 also deals')
        .replace(/\bYour (Attack|Special|Cast|Sprint) create\b/g, 'Your $1 creates')
        .replace(/\bYour (Attack|Special|Cast|Sprint) also create\b/g, 'Your $1 also creates')
        .replace(/\bYour (Attack|Special|Cast|Sprint) inflict\b/g, 'Your $1 inflicts')
        .replace(/\bYour (Attack|Special|Cast|Sprint) have\b/g, 'Your $1 has')
        .replace(/\bYour (Attack|Special|Cast|Sprint) gain\b/g, 'Your $1 gains')
        .replace(/\bYour (Attack|Special|Cast|Sprint) expire\b/g, 'Your $1 expires')
        .replace(/\byour (Attack|Special|Cast|Sprint) have\b/g, 'your $1 has')
        .replace(/\byour Attack or Special deal\b/g, 'your Attack or Special deals')
        .replace(/^(Your (?:Attack|Special|Cast|Sprint) [^.]*?)\band deal\b/g, '$1and deals')
        .replace(/^(Your (?:Attack|Special|Cast|Sprint) [^.]*?)\band hit\b/g, '$1and hits')
        .replace(/^(Your (?:Attack|Special|Cast|Sprint) [^.]*?)\band damage\b/g, '$1and damages')
        .replace(/^(Your (?:Attack|Special|Cast|Sprint) [^.]*?)\band repeatedly deal\b/g, '$1and repeatedly deals')
        .replace(/^(Your (?:Attack|Special|Cast|Sprint) [^.]*?)\band immediately deal\b/g, '$1and immediately deals')
        .replace(/\bwhile using them\b/g, 'while using it')
        .replace(/^Afterward,/g, 'After its curse ends,')
        .replace(/\brequired core Boon\b/gi, 'Boon required by the build')
        .replace(/\bfirst core Boon\b/gi, "Boon for the build's main move")
        .replace(/\bcore Boon slots?\b/gi, 'main Boon slots')
        .replace(/\bcore slots?\b/gi, 'main Boon slots')
        .replace(/\bcore Boons\b/gi, 'main Boons')
        .replace(/\bcore Boon\b/gi, 'main Boon')
        .replace(/\bcore build\b/gi, 'required build pieces')
        .replace(/\bcore loadout\b/gi, 'main combat setup')
        .replace(/\bArcana package\b/gi, 'Arcana setup')
        .replace(/\bBoon package\b/gi, 'Boon combination')
        .replace(/\bThe recommended package already includes\b/gi, 'The recommended Boons already include')
        .replace(/\bprimary package\b/gi, 'first-choice combination')
        .replace(
            /Lower specialized ceiling than combo aspects/gi,
            'Less room for specialized combinations than combo-focused aspects'
        )
        .replace(/Lower specialized ceiling/gi, 'Less room for specialized combinations')
        .replace(/Shell routing is poor/gi, 'Shells are often left in unsafe positions')
        .replace(/Shell routing/gi, 'Shell retrieval paths')
        .replace(/\bkeep core cards first\b/gi, 'keep the cards that protect the main plan first')
        .replace(/\bpreferred core choice\b/gi, 'preferred first choice')
        .replace(/\bcore cards?\b/gi, 'cards that keep the build working')
        .replace(/\bcombat loop\b/gi, 'attack pattern')
        .replace(/\bLoadout\b/g, 'Setup')
        .replace(/\bloadout\b/g, 'setup')
        .replace(/\b(Reward|Boon|Survive|Pom|Evade|Gold|Fight|Gift) \1 \1\b/g, '$1, $1, $1')
        .replace(/\.\s*Currently:\s*the listed value\.?$/i, '.')
        .replace(/\s+/g, ' ')
        .trim();

    const special: Record<string, string> = {
        'While you have at least 5 Air, you can never deal less damage than the limit.':
            "While you have at least 5 Air, each hit deals at least the Boon's listed minimum damage.",
        'As long as multiple foes are in an encounter, automatically inflict m on 1 of them.':
            'While at least 2 foes remain, 1 is automatically Charmed and turns against the others.',
        'Your Omega Attack fires a Eos Aspect Shot that deals damage in an area around it every 2 seconds':
            'Your Omega Attack fires an Eos shot that damages its surroundings every 2 seconds.',
        "While at Fates' Whim, gain a random Hades blessing and most boons have +1 level":
            "At Fates' Whim, gain a random Hades blessing and give most Boons +1 level.",
        'Your Cast inflicts Weak, and damages foes while dragging them toward the center.':
            'Your Cast inflicts Weak and damages foes while dragging them toward the center.',
        'Your Cast inflicts Daze, and deals a burst of damage before they expire.':
            'Your Cast inflicts Daze and deals a burst of damage before it expires.',
        'In each encounter, drink appears in the area and grants Power when collected.':
            'A drink appears in each encounter and raises your Power when collected.',
        'In each encounter, an Magick-restoring pickup appears in the area and restores all Magick when used.':
            'A Magick-restoring pickup appears in each encounter and restores all Magick when used.',
        'Make 1 random boon become Heroic and give it level':
            "Make 1 random Boon Heroic and raise it by 1 to 4 levels, based on Bridal Glow's rarity.",
        'Any permanent resource reward and Gold reward are worth more, and you receive Gold, Life, and Bones now.':
            'Permanent resources and Gold are worth more. You also receive Gold, healing, and Bones immediately.',
        'Whenever you run out of Magick, part of your Magick is reserved until the next chamber to restore all Magick.':
            'Whenever you run out of Magick, restore it, then reserve part of it until the next chamber.',
        'Gain a barrier that stops 1 instance of damage in each chamber, but part of your Magick is reserved.':
            'Gain a barrier that blocks 1 hit in each chamber, but part of your Magick is reserved.',
        'Gain +1 Extra Chance Athena that replenishes in each chamber, but part of your Magick is reserved.':
            'Gain 1 Death Defiance that replenishes in each chamber, but part of your Magick is reserved.',
        'When first you fall to 0 Health in an encounter, become Invulnerable. Clear it in time for 30 Life.':
            'The first time you reach 0 Life in an encounter, become invulnerable. Clear the encounter in time to recover 30 Life.',
        'Restore 0.5% of your maximum Life now. Any healing effects are 25% stronger this night.':
            'Restore Life immediately. Healing effects are 25% stronger for the rest of the night.',
        'Your effects from the listed value and the listed value have a chance to fire the listed value times.':
            'Certain water effects can trigger more than once.',
        'After its curse ends, gain +1 Earth Water Air Fire Aether.': 'After its curse ends, gain +1 of every element.',
        'Successively Clear Any Two All-Random Chaos Trials': 'Clear any two all-random Chaos Trials in succession.',
        'Discover How to See Into the Pitch-Black Stone': 'Discover how to see into the Pitch-Black Stone.',
        'Gain All Familiar Bonds for Any Animal Familiar': 'Fully upgrade every bond for one Animal Familiar.',
        'Must be one of reward claimed for reward status for Close Companions.':
            'Claim the reward for Close Companions.',
    };
    if (special[trimmed]) return assertReaderText(special[trimmed]);

    const prerequisiteSummary = trimmed.match(
        /^The recommended Boons already include (.+), which can satisfy this Boon's prerequisites\.$/
    );
    if (prerequisiteSummary) {
        const names = [...new Set(prerequisiteSummary[1].split(',').map((name) => name.trim()))];
        return assertReaderText(
            `The recommended Boons already include ${names.join(', ')}, which can satisfy this Boon's prerequisites.`
        );
    }

    const words = trimmed.split(' ');
    if (words.length % 2 === 0) {
        const half = words.length / 2;
        if (words.slice(0, half).join(' ').toLocaleLowerCase() === words.slice(half).join(' ').toLocaleLowerCase()) {
            return assertReaderText(words.slice(0, half).join(' '));
        }
    }
    return assertReaderText(trimmed);
}

export function assertReaderText(value: string): string {
    const match = FORBIDDEN_READER_TEXT.find((pattern) => pattern.test(value));
    if (match) throw new Error(`Unresolved internal text cannot cross the publication boundary: ${value}`);
    return value;
}

export function readableRules(value: JsonValue | undefined): string[] {
    if (!value) return [];
    if (isReference(value)) return [];
    if (Array.isArray(value)) {
        return value.flatMap((item) => (typeof item === 'string' ? [cleanReaderText(item)] : readableRules(item)));
    }
    if (!isObject(value)) return typeof value === 'string' ? [cleanReaderText(value)] : [];
    if (Array.isArray(value.rules)) {
        return value.rules.flatMap((rule) => (typeof rule === 'string' ? [cleanReaderText(rule)] : []));
    }
    return [];
}

function splitRuleItems(value: string): string[] {
    const parts = value
        .replace(/[.]$/u, '')
        .split(/,\s+/u)
        .map((item) => item.trim())
        .filter(Boolean);
    const items: string[] = [];
    for (const part of parts) {
        if (/^variant\s+\d+$/iu.test(part) && items.length > 0) {
            items[items.length - 1] = `${items.at(-1)}, ${part}`;
            continue;
        }
        items.push(part.replace(/^(?:and|or)\s+/iu, ''));
    }
    return items;
}

function titleCaseLead(value: string): string {
    const cleaned = cleanReaderText(value).trim();
    return cleaned === '' ? cleaned : cleaned.charAt(0).toLocaleUpperCase() + cleaned.slice(1);
}

function structuredRuleCopy(lead: string): { heading: string; lead: string } {
    const special: Record<string, { heading: string; lead: string }> = {
        'Give at least 2 gifts to any one of': {
            heading: 'Characters',
            lead: 'Give at least 2 gifts to any one of these characters.',
        },
        'Requires at least 24 from resources gathered in total': {
            heading: 'Fish',
            lead: 'Catch at least 24 of these fish.',
        },
        'Requires at least 2 from boons recorded across nights': {
            heading: 'Boons',
            lead: 'Record at least 2 of these Boons across any number of nights.',
        },
        'Requires at least one from required rewards obtained': {
            heading: 'Rewards',
            lead: 'Obtain at least one of these rewards.',
        },
    };
    if (special[lead]) return special[lead];

    const headingPatterns: Array<[RegExp, string]> = [
        [/incantations?/iu, 'Incantations'],
        [/Familiar upgrades/iu, 'Familiar upgrades'],
        [/Familiars/iu, 'Familiars'],
        [/Arcana Cards?/iu, 'Arcana Cards'],
        [/boons?/iu, 'Boons'],
        [/weapons?/iu, 'Weapons and Aspects'],
        [/resources?/iu, 'Resources'],
        [/story events?/iu, 'Story events'],
        [/rewards?/iu, 'Rewards'],
        [/encounters?/iu, 'Encounters'],
        [/traits?/iu, 'Armored traits'],
        [/gods?/iu, 'Gods'],
    ];
    const heading = headingPatterns.find(([pattern]) => pattern.test(lead))?.[1] ?? 'Eligible entries';
    return { heading, lead: /[.!?]$/u.test(lead) ? lead : `${lead}.` };
}

function familiarUpgradeRule(rule: string): ReaderRule | undefined {
    const match = rule.match(/^Meet one of these conditions:\s*(.+)[.]$/iu);
    if (!match) return undefined;

    const groupPattern =
        /(?:^|,\s+or\s+)at least\s+(\d+)\s+from Familiar upgrades:\s*(.*?)(?=,\s+or\s+at least\s+\d+\s+from Familiar upgrades:|$)/giu;
    const matches = [...match[1].matchAll(groupPattern)];
    if (matches.length < 2) return undefined;

    const minimums = new Set(matches.map((entry) => Number(entry[1])));
    const groups = matches.flatMap((entry) => {
        const sourceItems = splitRuleItems(entry[2]);
        const familiar = sourceItems[0]?.split(/\s+/u)[0];
        if (!familiar || sourceItems.some((item) => !item.startsWith(`${familiar} `))) return [];

        const paths = new Map<string, Set<number>>();
        for (const item of sourceItems) {
            const withoutFamiliar = item.slice(familiar.length + 1);
            const rankMatch = withoutFamiliar.match(/^(.*?)(?:\s+rank\s+(\d+))?$/iu);
            if (!rankMatch) return [];
            const path = titleCaseLead(rankMatch[1]);
            const ranks = paths.get(path) ?? new Set<number>();
            ranks.add(rankMatch[2] ? Number(rankMatch[2]) : 1);
            paths.set(path, ranks);
        }

        return [
            {
                heading: familiar,
                items: [...paths].map(([path, ranks]) => {
                    const orderedRanks = [...ranks].sort((a, b) => a - b);
                    return orderedRanks.length === 3 && orderedRanks.join(',') === '1,2,3'
                        ? `${path} · Ranks 1–3`
                        : `${path} · ${orderedRanks.map((rank) => `Rank ${rank}`).join(', ')}`;
                }),
            },
        ];
    });
    if (groups.length !== matches.length || minimums.size !== 1) return undefined;

    const minimum = [...minimums][0];
    return {
        collapsed: false,
        groups,
        itemCount: groups.reduce((count, group) => count + group.items.length, 0),
        kind: 'set',
        lead: `Choose one Familiar and unlock any ${minimum} upgrades from its rank paths.`,
    };
}

function structuredRule(rule: string): ReaderRule {
    const familiarRule = familiarUpgradeRule(rule);
    if (familiarRule) return familiarRule;

    const colonIndex = rule.indexOf(':');
    if (colonIndex < 0) return { kind: 'sentence', text: rule };
    const lead = rule.slice(0, colonIndex).trim();
    const items = splitRuleItems(rule.slice(colonIndex + 1));
    if (lead === '' || items.length < 4) return { kind: 'sentence', text: rule };
    const copy = structuredRuleCopy(lead);

    return {
        collapsed: items.length > 18,
        groups: [{ heading: copy.heading, items }],
        itemCount: items.length,
        kind: 'set',
        lead: copy.lead,
    };
}

export function readerRules(value: JsonValue | undefined): ReaderRule[] {
    return readableRules(value).map(structuredRule);
}
