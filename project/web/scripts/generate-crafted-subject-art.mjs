import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { hasPortraitPlan, portraitFromPlan } from './crafted-art/portrait-plans.mjs';

const arguments_ = process.argv.slice(2);
if (arguments_.length !== 0 && (arguments_.length !== 2 || arguments_[0] !== '--output')) {
    throw new Error('Usage: node scripts/generate-crafted-subject-art.mjs [--output <path>]');
}
const outputPath = resolve(arguments_[1] ?? 'public/art/symbols/record-icons.svg');
const committedPublication = resolve('src/content/publication.json');
const publicationRoots = [resolve('../data/.local/publication'), resolve('../data/.local/publication-review-final')];

const escapeXml = (value) =>
    String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

const hashString = (value) => {
    let hash = 0x811c9dc5;
    for (const character of value) {
        hash ^= character.codePointAt(0) ?? 0;
        hash = Math.imul(hash, 0x01000193);
    }
    return hash >>> 0;
};

const slugify = (value) =>
    value
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/gu, '')
        .toLocaleLowerCase()
        .replace(/['’]/gu, '')
        .replace(/[^a-z0-9]+/gu, '-')
        .replace(/^-+|-+$/gu, '');

const artworkKey = (record) => `${record.public.href}::${record.public.name}`;
const artworkId = (record) => {
    const readable = slugify(record.public.name).slice(0, 42) || 'subject';
    return `crafted-${readable}-${hashString(artworkKey(record)).toString(36)}`;
};

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

const resolvePublication = () => {
    const configured = process.env.NEONHADES2_PUBLICATION_PATH;
    if (configured) {
        const target = resolve(configured);
        const candidate = statSync(target).isDirectory() ? join(target, 'publication.json') : target;
        if (!existsSync(candidate)) throw new Error(`Publication file does not exist: ${candidate}`);
        return candidate;
    }

    if (existsSync(committedPublication)) return committedPublication;

    const candidates = publicationRoots
        .filter(existsSync)
        .flatMap((root) =>
            readdirSync(root)
                .sort((a, b) => b.localeCompare(a))
                .map((name) => join(root, name))
        )
        .filter((candidate) => statSync(candidate).isDirectory())
        .filter(
            (candidate) =>
                existsSync(join(candidate, 'publication.json')) &&
                existsSync(join(candidate, 'publication-report.json')) &&
                readJson(join(candidate, 'publication-report.json')).complete === true
        );

    if (candidates.length === 0) {
        throw new Error(
            'Artwork generation needs src/content/publication.json or a completed local data build. Run pnpm refresh:publication after generating the local data.'
        );
    }
    return join(candidates[0], 'publication.json');
};

const paletteFor = (signal, family) => {
    const divine = [
        [/aphrodite/u, ['#d75b75', '#f2a0b3', '#5f263d']],
        [/apollo/u, ['#f2bd57', '#fff0a2', '#8d4f25']],
        [/ares/u, ['#a94b3e', '#f07362', '#4c2023']],
        [/artemis/u, ['#74b99b', '#b8efd5', '#285f54']],
        [/athena/u, ['#d4d7ee', '#ffffff', '#68708e']],
        [/chaos/u, ['#8868f3', '#c3b4ff', '#33255e']],
        [/demeter/u, ['#8fc5e8', '#e6f7ff', '#436d8d']],
        [/dionysus/u, ['#a86ae8', '#e1a7ff', '#512b6d']],
        [/hephaestus/u, ['#e69c45', '#ffd08a', '#743c28']],
        [/hera/u, ['#63e6d2', '#b5fff2', '#286c70']],
        [/hermes/u, ['#f2bd57', '#fff2a8', '#71552a']],
        [/hestia/u, ['#d75b4e', '#ffad65', '#712c2a']],
        [/poseidon/u, ['#5aa6d8', '#9de7ef', '#28567f']],
        [/selene|moon/u, ['#d4d7ee', '#ffffff', '#615f8c']],
        [/zeus|lightning|electric|bolt/u, ['#f2bd57', '#fff6b7', '#5a62a8']],
    ];
    const match = divine.find(([pattern]) => pattern.test(signal));
    if (match) return match[1];
    const semantic = [
        [/ash|ember|fire|flame|burn|forge|bronze|ore/u, ['#e69c45', '#ffd08a', '#743c28']],
        [/psyche|shade|shadow|death|bone|night|moon|dream/u, ['#8868f3', '#c3b4ff', '#3b2a67']],
        [/fate|fabric|thread|silk|flower|seed|plant|garden|life/u, ['#63e6d2', '#b5fff2', '#286c70']],
        [/water|sea|river|fish|wave|brine/u, ['#5aa6d8', '#9de7ef', '#28567f']],
        [/heart|nectar|ambrosia|gift|love|bond/u, ['#d75b75', '#f7abc0', '#612b43']],
        [/gold|coin|wealth|sun|light|dawn/u, ['#f2bd57', '#ffe5a1', '#734b2a']],
        [/crystal|silver|armor|shield|frost|ice/u, ['#d4d7ee', '#ffffff', '#5b617a']],
    ];
    const semanticMatch = semantic.find(([pattern]) => pattern.test(signal));
    if (semanticMatch) return semanticMatch[1];
    const familyPalette = {
        boon: ['#63e6d2', '#b5fff2', '#286c70'],
        deity: ['#f2bd57', '#fff0a2', '#71552a'],
        incantation: ['#8868f3', '#c3b4ff', '#3b2a67'],
        weapon: ['#d4d7ee', '#ffffff', '#5b617a'],
        hammer: ['#e69c45', '#ffd08a', '#743c28'],
        resource: ['#74b99b', '#c2efd7', '#315f55'],
        arcana: ['#8868f3', '#c3b4ff', '#3b2a67'],
        prophecy: ['#d4d7ee', '#ffffff', '#5b617a'],
        achievement: ['#e69c45', '#ffe19a', '#7a3728'],
        keepsake: ['#d08a45', '#fff0b2', '#664029'],
        familiar: ['#74b99b', '#e4ffe8', '#315f55'],
        hex: ['#7250d6', '#f2eaff', '#302454'],
        fish: ['#5aa6d8', '#d8fbff', '#28567f'],
        tool: ['#8798c9', '#f3f5ff', '#3f4772'],
        exchange: ['#d08a45', '#fff0b2', '#664029'],
        oath: ['#b84f45', '#ffb0a0', '#4e2026'],
        region: ['#4f9fb7', '#d8fbff', '#24545f'],
        guide: ['#6d70b8', '#f0eeff', '#303052'],
        enemy: ['#a84750', '#ffd0c2', '#4a1e31'],
        portrait: ['#8868f3', '#f0eeff', '#3b2a67'],
        record: ['#63e6d2', '#d8fff7', '#286c70'],
    };
    return familyPalette[family] ?? ['#63e6d2', '#b5fff2', '#286c70'];
};

const recordFamily = (records) => {
    const types = new Set(records.map((record) => record.recordType));
    if ([...types].some((type) => type === 'mechanics/boon' || type === 'editorial/boon-rating')) return 'boon';
    if (types.has('mechanics/god')) return 'deity';
    if (types.has('mechanics/incantation')) return 'incantation';
    if (types.has('mechanics/hammer-upgrade')) return 'hammer';
    if ([...types].some((type) => type.includes('arcana'))) return 'arcana';
    if (types.has('mechanics/keepsake')) return 'keepsake';
    if ([...types].some((type) => type.includes('familiar'))) return 'familiar';
    if ([...types].some((type) => type.includes('hex'))) return 'hex';
    if ([...types].some((type) => type.includes('weapon') || type.includes('aspect'))) return 'weapon';
    if ([...types].some((type) => type.includes('relationship') || type.includes('encounter-friend'))) {
        return 'portrait';
    }
    if ([...types].some((type) => type.includes('resource') || type.includes('cultivation'))) return 'resource';
    if (types.has('mechanics/fish')) return 'fish';
    if (types.has('mechanics/gathering-tool')) return 'tool';
    if (types.has('mechanics/market-offer')) return 'exchange';
    if ([...types].some((type) => type.includes('prophecy'))) return 'prophecy';
    if ([...types].some((type) => type.includes('achievement'))) return 'achievement';
    if ([...types].some((type) => type.includes('oath') || type.includes('testament'))) return 'oath';
    if ([...types].some((type) => type.includes('region'))) return 'region';
    if (types.has('world-progression/enemy')) return 'enemy';
    if ([...types].some((type) => type.includes('narrative'))) return 'portrait';
    if ([...types].some((type) => type.includes('progression') || type.includes('opening-state'))) return 'guide';
    return 'record';
};

const signalFor = (records) =>
    records
        .flatMap((record) => [
            record.public.name,
            record.public.summary ?? '',
            ...record.fields.map((field) => `${field.publication ?? ''} ${JSON.stringify(field.value)}`),
        ])
        .join(' ')
        .toLocaleLowerCase();

const unmappedArtSubjects = [];
const manualPortraitNames = new Set(['Arachne', 'Chaos', 'Charon', 'Dora', 'Poseidon', 'Schelemeus', 'Zeus']);
const namedMotifOverrides = new Map([
    ['Arcana of the Ages', ['hourglass', 'book', 'moon']],
    ['Born to Win', ['crown', 'star', 'thread']],
    ['Elysian Glory', ['crown', 'sun', 'star']],
    ['Breadth of Knowledge', ['book', 'eye', 'thread']],
    ['Denizens of the Depths', ['gate', 'skull', 'thread']],
    ['Haunted by the Past', ['skull', 'hourglass', 'thread']],
    ['Improbable Outcomes', ['spiral', 'star', 'thread']],
    ['Natural Talent', ['flower', 'star', 'thread']],
    ['Soundest of Sleepers', ['moon', 'eye', 'thread']],
    ['The Unseen Sentinel', ['shield', 'eye', 'thread']],
    ['Unfinished Business', ['hourglass', 'thread', 'gate']],
    ['Witch of the Clouds', ['wind', 'staff', 'moon']],
    ['Witch of the Mountains', ['crystal', 'staff', 'moon']],
    ['Witch of the Outskirts', ['gate', 'staff', 'moon']],
    ['Witch of the Plains', ['sun', 'staff', 'moon']],
    ['Witch of the Woods', ['leaf', 'staff', 'moon']],
    ['Bared Fangs', ['beast', 'blade', 'moon']],
    ['Combined Might', ['ring', 'hand', 'star']],
    ['Power Beyond Legend', ['crown', 'star', 'flame']],
    ['The Argent Skull', ['skull', 'crystal', 'moon']],
    ['The Umbral Flames', ['flame', 'moon', 'skull']],
    ['Dreams of Respite', ['moon', 'cauldron', 'eye']],
    ['Original Sins', ['blade', 'spiral', 'thread']],
    ['Original Virtues', ['shield', 'star', 'thread']],
    ['Whims of Chaos', ['spiral', 'moon', 'star']],
    ['Chaos in Hell', ['spiral', 'flame', 'gate']],
    ["The Crow's Aspect", ['wing', 'beast', 'blade']],
    ["The Destroyer's Aspect", ['hammer', 'blade', 'flame']],
    ["The Grave's Aspect", ['skull', 'blade', 'moon']],
    ["The Jackal's Aspect", ['beast', 'moon', 'blade']],
    ["The Warrior's Aspect", ['blade', 'shield', 'crown']],
    ['Chaos Above', ['sun', 'spiral', 'wing']],
    ['Chaos Below', ['gate', 'spiral', 'skull']],
    ['Great Chaos Above', ['crown', 'spiral', 'sun']],
    ['Great Chaos Below', ['skull', 'spiral', 'crown']],
    ['Trial of Precarity', ['scales', 'thread', 'blade']],
    ['Trial of the Drifter', ['wind', 'path', 'thread']],
    ['Trial of the Jackal', ['beast', 'blade', 'thread']],
    ['Trial of Vengeance', ['blade', 'flame', 'thread']],
    ['Infinite Possibility', ['spiral', 'gate', 'thread']],
    ['Dreams of Terror', ['eye', 'skull', 'moon']],
    ['Melinoë, Find Us', ['hand', 'thread', 'moon']],
    ['Trial of Brawn', ['hammer', 'shield', 'thread']],
    ['Trial of Haste', ['wind', 'wing', 'thread']],
    ['Trial of the Fall', ['gate', 'blade', 'thread']],
    ['Trial of the Banshee', ['wind', 'skull', 'thread']],
    ['Trial of the Marauder', ['blade', 'coin', 'thread']],
    ['Trial of the Supreme', ['crown', 'shield', 'thread']],
    ['Trial of the Daemon', ['flame', 'spiral', 'thread']],
    ['Trial of the Maiden', ['moon', 'shield', 'thread']],
    ['Trial of Thunder', ['bolt', 'wind', 'thread']],
    ['Mandrake Seeds cultivation', ['hand', 'flower', 'cauldron']],
    ['Poppy Seeds cultivation', ['moon', 'flower', 'cauldron']],
    ['Wheat Seeds cultivation', ['sun', 'flower', 'cauldron']],
    ["Mercy, Night's Executioner", ['blade', 'heart', 'moon']],
    ['The Arms of Night', ['daggers', 'moon', 'blade']],
    ['So Mote It Be', ['flame', 'thread', 'ring']],
    ['The Invoker', ['hand', 'ring', 'flame']],
    ['Trial of Humility', ['scales', 'shield', 'thread']],
    ['Trial of Origin', ['spiral', 'gate', 'thread']],
    ['Beyond Familiar', ['gate', 'beast', 'heart']],
    ['Familiar Confidant', ['charm', 'beast', 'heart']],
    ['Bitter Tears', ['wave', 'moon', 'heart']],
    ['Wings of Freedom', ['wing', 'star', 'thread']],
    ['Close Companions', ['heart', 'beast', 'charm']],
    ['Den Mother', ['beast', 'heart', 'shield']],
    ['Denier of Suitors', ['shield', 'heart', 'blade']],
    ['Valued Customer', ['coin', 'charm', 'star']],
    ['Dreams of Victory', ['crown', 'moon', 'eye']],
    ['Visions of Victory', ['eye', 'crown', 'star']],
    ['Ambrosia exchange', ['star', 'vessel', 'charm']],
    ['Nectar exchange', ['vessel', 'heart', 'charm']],
    ['Olive Branch cultivation', ['leaf', 'flower', 'sun']],
    ['Plankton cultivation', ['wave', 'flower', 'moon']],
]);

const motifFor = (signal) => {
    const patterns = [
        [/lightning|electric|bolt|static|zeus/u, 'bolt'],
        [/sun|solar|dawn|light|apollo/u, 'sun'],
        [/moon|lunar|night|selene/u, 'moon'],
        [/heart|love|charm|aphrodite|relationship|gift/u, 'heart'],
        [/flame|fire|scorch|burn|hestia/u, 'flame'],
        [/wave|water|sea|surf|tide|poseidon/u, 'wave'],
        [/frost|freeze|cold|winter|demeter/u, 'frost'],
        [/critical|star|artemis|hunt/u, 'star'],
        [/shield|guard|armor|block|athena/u, 'shield'],
        [/doom|blood|cut|bleed|ares/u, 'blade'],
        [/forge|hammer|anvil|hephaestus/u, 'hammer'],
        [/speed|sprint|rush|hermes|swift/u, 'wing'],
        [/wine|feast|dionysus/u, 'grape'],
        [/chaos|spiral|entropy|void/u, 'spiral'],
        [/mirror|reflect|clarity/u, 'mirror'],
        [/scale|balance|weigh|rival/u, 'scales'],
        [/beckon|summon|call|reach|hand/u, 'hand'],
        [/cauldron|pool|spring|fountain|well/u, 'cauldron'],
        [/cast|circle|ring|orbit|bond/u, 'ring'],
        [/magick|mana|gain|restore|prime/u, 'vessel'],
        [/health|heal|life|recovery/u, 'leaf'],
        [/door|gate|surface|underworld|region|route/u, 'gate'],
        [/fate|prophecy|destin|possib/u, 'thread'],
        [/book|wisdom|arcana|card|memory|memories|historic/u, 'book'],
        [/insight|intuition|sense|observance|divination|revelation/u, 'eye'],
        [/skull|death|shade|dead/u, 'skull'],
        [/gold|coin|wealth|fortune|reward/u, 'coin'],
        [/fish|catch|seafood/u, 'fish'],
        [/garden|seed|harvest|flower|plant/u, 'flower'],
        [/time|chronos|temporal|hour/u, 'hourglass'],
        [/air|wind|fresh/u, 'wind'],
        [/dream|sleep|hypnos/u, 'eye'],
        [/beast|familiar|hound|cat|frog|raven/u, 'beast'],
        [/axe|cleave/u, 'axe'],
        [/staff|witch/u, 'staff'],
        [/torch/u, 'torch'],
        [/dagger|blade|knife/u, 'daggers'],
        [/coat|suit/u, 'coat'],
    ];
    return patterns.find(([pattern]) => pattern.test(signal))?.[1];
};

const motifCandidates = (record, records, family) => {
    if (family === 'portrait' || family === 'deity') return [];
    const name = record.public.name.toLocaleLowerCase();
    const namedOverride = namedMotifOverrides.get(record.public.name);
    if (namedOverride) return [...namedOverride];
    const signal = signalFor(records);
    const candidates = [];
    const add = (source, pattern, motif) => {
        if (pattern.test(source) && !candidates.includes(motif)) candidates.push(motif);
    };
    const vocabulary = [
        [/insight|intuition|sense|observance|divination|eye|reveal|track/u, 'eye'],
        [/reflect|mirror|clarity|re-attempt|repeat/u, 'mirror'],
        [/abyss|chaos|infinite|void|entropy/u, 'spiral'],
        [/fate|possib|unravel|bond|thread|destin/u, 'thread'],
        [/familiar|beast|spirit|morsel|cat|frog|hound|raven|polecat/u, 'beast'],
        [/alter|change|shuffle|fluctuat|dissolution|disintegrat|transform|random/u, 'spiral'],
        [/gold|fortune|rich|bount|trove|mercantile|offering|reward|wealth/u, 'coin'],
        [/ash|flame|fire|burn|rage|scorch|blaze/u, 'flame'],
        [/bone|death|dead|necro|exhum|husk|sorrow|shade|doom/u, 'skull'],
        [/wisdom|memory|craft|ballad|rhapsody|history|record|statistic|book/u, 'book'],
        [/blessing|favor|gift|keepsake|nectar|ambrosia|savor|sentimental|relationship/u, 'charm'],
        [/air|wind|rush|surge|quick|speed|sprint|swift/u, 'wind'],
        [/time|temporal|pause|chronos|slow/u, 'hourglass'],
        [/life|soil|garden|gaia|verdant|green|flourish|seed|plant|harvest|heal/u, 'flower'],
        [/water|river|briny|sea|fording|wave|ocean|tide/u, 'wave'],
        [/frozen|crystal|cold|winter|ice|freeze/u, 'frost'],
        [/moon|night|dark|star|lunar|selene/u, 'moon'],
        [/ward|protect|bravery|faith|solidarity|armor|guard|block|barrier/u, 'shield'],
        [/aspect|craftwork|arm|weapon|attack|special|damage|strike|slash|cut/u, 'blade'],
        [/beckon|summon|hand|influence|persuade|call|manifest/u, 'hand'],
        [/spring|fountain|well|pool|brew|cook|cauldron|restore/u, 'cauldron'],
        [/circle|rite|bond|cast|orbit|area/u, 'ring'],
        [/return|rise|path|permeat|intervention|door|gate|surface|underworld|route|chamber/u, 'gate'],
        [/clean|purif|vapor|extract|ore|gem|dust|resource/u, 'crystal'],
        [/rival|balance|oath|vow|testament|fear/u, 'scales'],
        [/rubbish|reagent|extraction|gather|tool|rod|pick|spade|shovel/u, 'tool'],
        [/magick|mana|prime|gain|reserve|restore all magick/u, 'vessel'],
        [/sun|solar|dawn|apollo|light/u, 'sun'],
        [/lightning|electric|bolt|static|zeus|storm/u, 'bolt'],
        [/love|heart|aphrodite|health|maximum life/u, 'heart'],
        [/forge|hammer|anvil|hephaestus|upgrade/u, 'hammer'],
        [/fish|catch|fishing/u, 'fish'],
        [/prophecy|quest|objective|achievement/u, 'thread'],
        [/elysian|glory|victory|triumph/u, 'crown'],
        [/elysian|glory|victory|triumph|clear/u, 'star'],
    ];
    for (const [pattern, motif] of vocabulary) add(name, pattern, motif);
    for (const [pattern, motif] of vocabulary) add(signal, pattern, motif);
    const direct = motifFor(signal);
    if (direct && !candidates.includes(direct)) candidates.push(direct);
    const familySupport = {
        boon: 'seal',
        deity: 'crown',
        incantation: 'torch',
        hammer: 'hammer',
        arcana: 'moon',
        keepsake: 'charm',
        hex: 'moon',
        weapon: 'blade',
        resource: 'crystal',
        prophecy: 'thread',
        achievement: 'star',
        oath: 'shield',
        region: 'gate',
        guide: 'path',
        enemy: 'skull',
        record: 'seal',
    };
    const support = familySupport[family] ?? 'seal';
    if (!candidates.includes(support)) candidates.push(support);
    if (candidates.length < 2) {
        unmappedArtSubjects.push(`${record.public.name} (${record.recordType})`);
    }
    return candidates.slice(0, 3);
};

const divineMotifFor = (signal) => {
    const divine = [
        [/zeus/u, 'bolt'],
        [/hera/u, 'peacock'],
        [/poseidon/u, 'wave'],
        [/apollo/u, 'sun'],
        [/artemis/u, 'star'],
        [/aphrodite/u, 'heart'],
        [/ares/u, 'blade'],
        [/demeter/u, 'frost'],
        [/hestia/u, 'flame'],
        [/hephaestus/u, 'hammer'],
        [/hermes/u, 'wing'],
        [/dionysus/u, 'grape'],
        [/athena/u, 'shield'],
        [/selene/u, 'moon'],
        [/chaos/u, 'spiral'],
    ];
    return divine.find(([pattern]) => pattern.test(signal))?.[1];
};

const motifs = {
    bolt: '<path class="accent-hi edge" d="M88 35 55 82h22l-9 43 39-56H84z"/><path class="paper fine" d="m87 48-19 28h18l-7 31"/>',
    sun: '<circle class="accent-hi edge" cx="80" cy="80" r="22"/><path class="accent fine" d="M80 38v16m0 52v16M38 80h16m52 0h16M50 50l12 12m36 36 12 12m0-60L98 62M62 98l-12 12"/><circle class="paper" cx="74" cy="72" r="6"/>',
    moon: '<path class="moon edge" d="M97 39c-28 8-40 39-24 62 10 15 28 21 45 13-18 20-51 16-65-9-17-31 4-68 44-66z"/><path class="accent fine" d="M47 102c18 14 38 17 61 8"/>',
    heart: '<path class="accent-hi edge" d="M80 119C34 88 37 51 60 45c12-3 20 4 20 16 1-12 9-19 21-16 23 6 26 43-21 74z"/><path class="paper fine" d="M54 65c5-10 14-12 23-5"/>',
    flame: '<path class="accent-hi edge" d="M81 30c29 31 37 55 23 76-13 20-44 23-57 3-14-22 1-44 20-64-2 18 4 29 17 34-7-16-8-32-3-49z"/><path class="paper edge" d="M78 77c13 12 14 23 4 34-12 5-21-3-18-14 2-7 6-14 14-20z"/>',
    wave: '<path class="accent-hi edge" d="M34 91c16-26 32-26 48 0 16-26 31-26 47 0-16 28-32 28-48 1-15 27-31 27-47-1z"/><path class="paper fine" d="M43 79c12-11 24-8 36 8m11-8c12-11 23-8 33 8"/>',
    frost: '<path class="moon edge" d="M80 34v92M40 57l80 46m0-46-80 46M64 38l16 16 16-16m-32 84 16-16 16 16M39 76l22 6-6 22m66-28-22 6 6 22"/>',
    star: '<path class="accent-hi edge" d="m80 31 14 31 34 4-25 24 7 35-30-17-31 17 7-35-25-24 35-4z"/><path class="paper fine" d="m80 50 8 19 21 3-16 14"/>',
    shield: '<path class="moon edge" d="m80 33 39 16-5 48c-11 18-22 28-34 35-13-7-25-18-35-35l-5-48z"/><path class="accent-hi edge" d="m80 52 21 10-4 28-17 19-17-19-4-28z"/>',
    blade: '<path class="accent-hi edge" d="m47 114 17-15 42-57 11 7-38 61-6 22z"/><path class="moon edge" d="m45 102 26 22-9 10-27-22z"/><path class="paper fine" d="m76 100 33-49"/>',
    hammer: '<path class="accent-hi edge" d="m44 50 56-10 15 22-13 20-30 2-5 51-18-2 8-53-19-12z"/><path class="paper fine" d="m54 57 43-7m-32 36-7 40"/>',
    wing: '<path class="moon edge" d="M78 70C51 42 29 49 24 71c18-5 32 1 43 17-19-4-31 3-37 22 24 0 43-10 58-30M87 70c28-28 50-21 55 1-19-5-33 1-44 17 19-4 32 3 38 22-24 0-44-10-59-30"/><path class="accent-hi edge" d="M72 65h17l-3 62H69z"/>',
    grape: '<path class="sage edge" d="M83 43c14-15 29-17 45-6-11 15-26 18-45 6z"/><path class="sage fine" d="M82 48c-5 16-4 32 4 48"/><circle class="accent-hi edge" cx="68" cy="72" r="14"/><circle class="accent edge" cx="91" cy="70" r="14"/><circle class="accent-hi edge" cx="80" cy="94" r="15"/><circle class="accent edge" cx="80" cy="117" r="13"/>',
    peacock:
        '<path class="accent-hi edge" d="M80 25c31 20 42 48 31 83-10 28-52 28-62 0-11-35 0-63 31-83z"/><path class="accent-deep edge" d="M80 48c18 14 23 32 14 52-6 14-22 14-28 0-9-20-4-38 14-52z"/><path class="paper edge" d="M58 85c11-17 33-17 44 0-11 17-33 17-44 0z"/><circle class="ink" cx="80" cy="85" r="8"/><path class="sage fine" d="M80 112v25m-18-10 18-15 18 15"/>',
    spiral: '<path class="accent-hi edge nofill" d="M117 58c-21-29-68-20-78 15-11 38 31 69 64 47 25-17 16-56-12-57-22-1-32 26-15 39 12 9 29 1 28-14"/><circle class="paper" cx="101" cy="87" r="5"/>',
    ring: '<circle class="accent-hi edge nofill" cx="80" cy="80" r="42"/><circle class="moon edge nofill" cx="80" cy="80" r="25"/><path class="paper fine" d="M36 80h88M80 36v88"/><circle class="accent" cx="80" cy="80" r="8"/>',
    vessel: '<path class="accent-hi edge" d="m47 63 67 2-9 53c-17 13-33 13-49 0z"/><path class="moon edge" d="M41 55h79l-6 14H47z"/><path class="paper fine" d="M57 86c15 8 30 8 46 0"/><path class="accent edge" d="M71 54c-8-15-5-27 10-36-1 11 4 18 15 21-9 3-17 8-25 15z"/>',
    leaf: '<path class="sage edge" d="M42 111c7-43 34-69 76-76-2 44-28 71-76 76z"/><path class="paper fine" d="m49 105 60-61M74 80l-25-2m42-15 4-24"/>',
    gate: '<path class="accent-hi edge nofill" d="M42 122V66c0-38 76-38 76 0v56M59 122V70c0-20 42-20 42 0v52"/><path class="moon fine" d="M35 123h90"/><circle class="paper" cx="91" cy="91" r="5"/>',
    thread: '<path class="accent-hi edge nofill" d="M33 111c24-5 30-29 15-47 19-20 39-14 45 4 7 22-22 32-13 54 12 29 48 3 43-27"/><circle class="paper edge" cx="48" cy="64" r="7"/><circle class="accent edge" cx="123" cy="94" r="7"/>',
    book: '<path class="moon edge" d="M27 55c20-9 38-7 53 7v65c-16-13-34-16-53-7zM133 55c-20-9-38-7-53 7v65c16-13 34-16 53-7z"/><path class="accent-hi edge nofill" d="M80 62v65M42 76c10-3 19-1 27 5m-27 18c10-3 19-1 27 5m49-28c-10-3-19-1-27 5m27 18c-10-3-19-1-27 5"/>',
    skull: '<path class="moon edge" d="M45 73c0-49 70-49 70 0 0 22-10 35-23 42v17H68v-17c-13-7-23-20-23-42z"/><circle class="ink" cx="66" cy="78" r="9"/><circle class="ink" cx="95" cy="78" r="9"/><path class="ink edge nofill" d="m72 108 8-9 8 9"/>',
    coin: '<circle class="accent-hi edge" cx="80" cy="80" r="44"/><circle class="ink edge nofill" cx="80" cy="80" r="31"/><path class="paper edge nofill" d="M68 57h24L68 103h24M59 80h42"/>',
    fish: '<path class="accent-hi edge" d="M40 81c19-30 51-31 76-4l20-19-2 45-19-16c-27 27-57 25-75-6z"/><circle class="ink" cx="64" cy="75" r="5"/><path class="paper fine" d="M81 61c8 9 8 18 0 28"/>',
    flower: '<circle class="accent-hi edge" cx="80" cy="79" r="14"/><path class="sage edge" d="M80 64c-17-31-40-19-31 4 6 14 17 18 31 11-8-23 9-39 27-28 15 10 7 30-12 32 25 12 20 35 1 38-16 3-24-11-18-30-9 26-34 25-39 7-5-17 10-27 31-20"/><path class="paper fine" d="M80 92v37"/>',
    mirror: '<path class="accent-deep edge" d="M44 34h72l12 17-8 61-40 25-40-25-8-61z"/><path class="moon edge" d="M51 46h58l7 12-8 45-28 19-28-19-8-45z"/><path class="paper fine" d="M59 55 99 95M54 77l27 27m14-47 14 14"/><path class="accent-hi edge" d="m71 130 9-11 10 11-10 19z"/>',
    scales: '<path class="accent-hi edge" d="M75 30h10v92H75z"/><path class="paper edge" d="M45 43h70v10H45z"/><path class="moon fine" d="m49 52-19 42m81-42 19 42"/><path class="accent-deep edge" d="M17 91h38c-3 18-10 27-19 27s-16-9-19-27zm88 0h38c-3 18-10 27-19 27s-16-9-19-27z"/><path class="accent-hi edge" d="M54 122h52l12 18H42z"/>',
    hand: '<path class="moon edge" d="M48 127c-8-13-9-27-2-42l7-33c2-9 15-7 14 3l-3 25 8-45c2-10 16-8 15 3l-4 40 9-38c3-10 17-6 14 5l-8 39 11-27c4-10 17-4 13 6l-17 42c-7 18-19 28-35 30z"/><path class="accent-hi fine" d="M61 91c15-9 30-8 44 4M74 116c10-3 19-8 27-17"/><circle class="paper edge" cx="52" cy="43" r="7"/>',
    cauldron:
        '<path class="accent-deep edge" d="m36 75 88 2-12 45c-20 18-44 18-64 0z"/><path class="accent-hi edge" d="M29 67h102l-7 16H36z"/><path class="paper fine" d="M48 94c22 10 43 10 65 0"/><path class="accent fine" d="M51 129 39 145m70-16 12 16"/><path class="moon edge" d="M58 59c-12-12-9-25 7-37-2 12 3 19 14 22-7 3-14 8-21 15zm36 0c-10-11-7-22 7-32-2 10 2 16 12 19-7 3-13 7-19 13z"/>',
    tool: '<path class="accent-hi edge" d="M35 45c17-19 35-22 53-10L69 55l41 52-17 17-43-51-23 10c-4-14-1-27 8-38z"/><path class="moon edge" d="m99 101 23 21-17 17-22-23z"/><path class="paper fine" d="m58 61 48 58"/>',
    hourglass:
        '<path class="moon edge" d="M45 34h70l-9 19c-7 15-16 24-26 27 11 5 20 15 27 30l8 18H45l8-18c7-15 16-25 27-30-10-3-19-12-26-27z"/><path class="accent-hi edge" d="M62 52h36c-5 11-11 17-18 20-7-3-13-9-18-20zm18 40c8 6 15 14 20 25H60c5-11 12-19 20-25z"/>',
    wind: '<path class="accent-hi edge nofill" d="M28 62h72c22 0 24-27 5-31-11-2-19 3-23 14M26 82h99c22 0 24 28 4 32-11 2-19-4-22-14M40 103h43"/><path class="paper fine" d="M36 71h57m-49 21h67"/>',
    eye: '<path class="moon edge" d="M28 80c25-35 79-35 104 0-25 35-79 35-104 0z"/><circle class="accent-hi edge" cx="80" cy="80" r="22"/><circle class="ink" cx="80" cy="80" r="9"/><circle class="paper" cx="72" cy="72" r="5"/>',
    beast: '<path class="accent-hi edge" d="M46 115 37 70l22-30 21 18 22-18 21 30-9 45-34 17z"/><path class="moon edge" d="m49 58 3-29 24 26m35 3-3-29-24 26"/><circle class="ink" cx="66" cy="79" r="6"/><circle class="ink" cx="95" cy="79" r="6"/><path class="paper edge nofill" d="m70 104 10 7 11-7"/>',
    axe: '<path class="accent-hi edge" d="M83 30c24 6 39 21 45 44-18 11-34 11-49 2-5 24-3 44 5 61H64c-8-24-8-48 0-71-13-15-10-28 7-40z"/><path class="moon fine" d="M76 52c15-1 28 5 39 17"/>',
    staff: '<path class="accent-hi edge" d="m72 128 8-91 18-8 8 17-13 14-8 69z"/><path class="moon edge" d="M82 36c-14-9-22-6-25 9 9-4 16-2 22 6 1-7 2-12 3-15z"/><circle class="paper" cx="88" cy="45" r="5"/>',
    torch: '<path class="accent edge" d="m69 77 21-2 11 55-30 2z"/><path class="accent-hi edge" d="M81 74c-27-22-12-48 11-61-3 15 3 24 17 29-5 17-14 28-28 32z"/><path class="paper edge" d="M90 56c-10-8-7-17 4-25-1 8 2 13 8 16-3 5-7 8-12 9z"/>',
    daggers:
        '<path class="moon edge" d="m40 112 35-70 13 7-32 73zM120 112 85 42l-13 7 32 73z"/><path class="accent-hi edge" d="m35 105 28 13-6 13-29-14zm90 0-28 13 6 13 29-14z"/>',
    coat: '<path class="accent-hi edge" d="m49 42 31 16 31-16 22 34-21 13 4 42H44l4-42-21-13z"/><path class="moon edge" d="m65 51 15 7 15-7-5 31-10 11-10-11z"/><path class="paper fine" d="M80 94v28"/>',
    crown: '<path class="accent-hi edge" d="m36 109 8-62 29 27 18-43 19 43 28-27 7 62z"/><path class="moon edge" d="M42 109h96l-7 20H49z"/><circle class="paper" cx="91" cy="91" r="7"/>',
    charm: '<path class="accent-hi edge nofill" d="M47 59c0-38 66-38 66 0 0 20-14 32-33 32S47 79 47 59z"/><path class="moon edge" d="m80 88 27 21-27 25-27-25z"/><circle class="paper" cx="80" cy="109" r="6"/>',
    crystal:
        '<path class="accent-hi edge" d="m80 27 39 34-17 67H58L41 61z"/><path class="moon fine" d="M80 27v101M41 61l39 22 39-22M58 128l22-45 22 45"/>',
    path: '<path class="accent-hi edge nofill" d="M28 122c14-43 38-55 58-29 18 23 36 4 46-38"/><circle class="moon edge" cx="30" cy="121" r="9"/><circle class="accent edge" cx="84" cy="92" r="9"/><circle class="paper edge" cx="132" cy="54" r="9"/>',
    seal: '<path class="accent-hi edge" d="m80 29 41 24v53l-41 25-41-25V53z"/><path class="moon edge nofill" d="m80 48 25 15v33l-25 15-25-15V63z"/><path class="paper fine" d="M58 96 103 64M58 64l45 32"/>',
};

const exactSubjectArtwork = (name) => {
    const normalized = name.toLocaleLowerCase();
    if (normalized === 'ashes') {
        return `<g stroke="#070910" stroke-linecap="round" stroke-linejoin="round">
            <path d="M34 42c23-25 72-28 97-2 15 16 18 43 7 64-13 26-42 43-73 38-25-4-43-21-46-43-3-21 4-41 15-57z" fill="#e9cf9b" opacity=".16" stroke="none"/>
            <path d="M33 96c8-29 26-51 50-61 19-8 39-7 56 1-16 3-30 10-39 20 20-4 36 0 49 13-18 0-32 5-42 14 18 2 30 10 37 24-22-6-42-4-58 8-18 13-37 15-53 6-13-7-13-17 0-25z" fill="#1c181a" stroke-width="5"/>
            <path d="M35 98c10-28 28-46 53-55-11 10-16 21-14 34 3 17 17 26 34 22 13-3 24-12 33-26-2 22-13 40-31 51-19 12-39 13-59 4-16-7-21-17-16-30z" fill="#5f5656" stroke-width="3"/>
            <path d="M49 102c8-17 18-30 32-39-6 14-5 25 2 34 9 11 24 12 40 4-10 13-21 21-34 25-17 5-32 1-40-8-5-5-5-10 0-16z" fill="#8f8580" stroke-width="2.5"/>
            <path d="M63 95c4-13 10-23 20-31-3 14 1 24 12 29 8 4 17 3 27-2-12 17-26 25-42 22-14-3-20-9-17-18z" fill="#c7beb0" stroke-width="2"/>
            <path d="M83 49c8-5 16-6 24-3m-17 12c8-3 15-2 22 2m-11 10c8-1 14 1 19 5" fill="none" stroke="#f4ead7" stroke-width="4"/>
            <path d="M42 91c-8-13-4-25 11-34-3 10 0 17 9 22-8 2-15 6-20 12z" fill="#d8c4aa" stroke-width="2.5"/>
            <path d="M42 54c-7-7-6-14 2-19 2 8 7 12 14 11-4 6-9 9-16 8z" fill="#756c68" stroke-width="2.5"/>
            <path d="M119 31c5-8 12-10 19-5-2 8-7 12-15 12zM133 50c7-5 14-4 19 3-5 7-11 9-18 5zM117 118c9-2 15 2 18 10-8 5-15 4-20-3z" fill="#2f2a2c" stroke-width="2"/>
            <circle cx="112" cy="39" r="4" fill="#d6c8b6" stroke-width="1.5"/><circle cx="144" cy="77" r="4" fill="#7d7370" stroke-width="1.5"/><circle cx="126" cy="92" r="3" fill="#ebe0cd" stroke-width="1.5"/>
            <path d="M31 117c22 18 53 23 79 9" fill="none" stroke="#d8c29d" stroke-width="3" opacity=".8"/>
        </g>`;
    }
    if (normalized === 'centaur heart') {
        return `<g stroke="#070910" stroke-linecap="round" stroke-linejoin="round">
            <path d="M80 143C31 114 18 80 30 52c10-23 39-28 51-7 14-21 43-15 51 10 10 31-9 63-52 88z" fill="#111723" stroke-width="7"/>
            <path d="M80 135C39 109 28 80 38 58c8-18 29-21 42-4 13-17 35-13 42 6 8 24-9 50-42 75z" fill="#35648b" stroke-width="4"/>
            <path d="M80 126C48 105 39 83 46 65c6-13 21-16 34-2 12-14 27-11 33 4 6 19-7 39-33 59z" fill="#6fa5d2" stroke-width="2.5"/>
            <path d="M49 60c8-15 24-16 32-2 7-11 19-13 27-4-20-5-39 1-56 17z" fill="#a8cdf0" stroke="none"/>
            <path d="m45 72 24-25-3 27 22-18-8 27 31-17-19 27 27 1-31 14 12 22-25-17-17 13 5-25-22 2 18-17z" fill="#d8222c" stroke-width="4"/>
            <path d="m52 70 13-13-2 18 17-12-7 22 24-13-15 21 22 1-24 10 8 15-17-11-10 8 4-18-15 1 13-12z" fill="#f23a3f" stroke-width="2"/>
            <path d="M51 78c17 9 35 16 53 20M63 61c1 14 5 26 12 37" fill="none" stroke="#8d0f1d" stroke-width="3"/>
            <circle cx="104" cy="62" r="9" fill="#f7f4e9" stroke-width="3"/>
            <path d="M35 101c10 20 24 32 42 39m37-41c-7 13-17 24-30 34" fill="none" stroke="#178bd0" stroke-width="3"/>
            <path d="M43 87c-3-13-1-23 6-31m65 32c3-12 2-21-4-29" fill="none" stroke="#d9eefb" stroke-width="2" opacity=".7"/>
            <path d="m39 45 14-10 17 3" fill="none" stroke="#1da7ef" stroke-width="3"/><path d="m114 41 10 12 2 17" fill="none" stroke="#7ac4ee" stroke-width="3"/>
        </g>`;
    }
    if (normalized === 'born gain') {
        return `<g stroke="#070910" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="80" cy="80" r="64" fill="#071526" stroke-width="5"/>
            <circle cx="80" cy="80" r="54" fill="#102145" stroke="#233d70" stroke-width="2.5"/>
            <path d="M78 25c17-13 33-12 46 4-18 0-29 8-34 24-5 12-13 20-25 23 9-15 13-32 13-51z" fill="#8b55ee" stroke-width="3"/>
            <path d="M121 44c21 4 31 17 29 37-11-14-24-18-39-12-13 5-24 4-34-2 18-5 33-13 44-23z" fill="#2cc9ce" stroke-width="3"/>
            <path d="M139 84c13 17 10 34-7 46 1-17-7-29-22-35-12-5-20-14-23-26 15 10 33 15 52 15z" fill="#7652df" stroke-width="3"/>
            <path d="M116 128c-5 21-19 31-39 28 15-10 19-23 14-39-4-13-2-24 5-34 3 19 10 34 20 45z" fill="#39d7c7" stroke-width="3"/>
            <path d="M73 143c-18 11-35 6-45-12 17 4 30-2 38-16 7-12 16-19 29-20-12 14-19 30-22 48z" fill="#8d54ed" stroke-width="3"/>
            <path d="M30 116C11 106 7 90 15 71c7 16 19 24 36 22 14-1 25 3 34 12-19-1-37 3-55 11z" fill="#31c9ca" stroke-width="3"/>
            <path d="M19 68c1-21 12-34 33-37-12 13-14 27-5 41 7 12 8 23 3 35-7-18-17-31-31-39z" fill="#7148d5" stroke-width="3"/>
            <path d="M45 32c15-15 32-17 49-6-17 5-26 16-27 33-1 14-7 24-17 31 5-19 3-38-5-58z" fill="#39d4c5" stroke-width="3"/>
            <path d="M84 30c12 2 22 7 29 15m22 13c7 10 10 20 9 31m-7 30c-8 9-17 15-28 18m-28 10c-12-1-22-6-31-14m-22-18c-6-10-9-21-8-32m8-29c8-9 17-15 28-18" fill="none" stroke="#c4a6ff" stroke-width="2" opacity=".65"/>
            <path d="m80 48 30 17v34l-30 18-30-18V65z" fill="#f3c65c" stroke-width="5"/>
            <path d="m80 56 22 13v26l-22 13-22-13V69z" fill="#fff0a6" stroke="#a56d2c" stroke-width="2.5"/>
            <circle cx="80" cy="82" r="16" fill="#19204b" stroke="#b4812e" stroke-width="3"/>
            <path d="m80 65 5 11 12 1-9 8 3 12-11-6-11 6 3-12-9-8 12-1z" fill="none" stroke="#f7d66d" stroke-width="3"/>
            <circle cx="80" cy="82" r="4" fill="#3dd8cf" stroke-width="1.5"/>
            <path d="M38 37c5 4 9 5 14 4M124 32c-4 5-4 10-1 15m25 57c-6 1-10 4-12 8m-34 36c-2-6-6-10-11-12m-57-4c3-5 3-10 1-15M12 69c6 0 10-2 13-7" fill="none" stroke="#5ce6dd" stroke-width="3"/>
        </g>`;
    }
    if (normalized === 'nova strike') {
        return `<g stroke="#070910" stroke-linecap="round" stroke-linejoin="round">
            <path d="M29 120c-16-34-9-72 19-91 29-20 70-14 90 13 20 27 17 66-8 89-27 24-79 20-101-11z" fill="#2c1f0d" stroke-width="5"/>
            <path d="M34 111c-10-25-4-54 16-70 22-18 56-17 77 3 19 19 22 50 7 72-18 25-55 32-83 17z" fill="#8d6119" stroke-width="3"/>
            <path d="M37 102c6-20 18-35 36-44-7 12-8 23-2 33 7 11 19 15 34 11-12 13-26 20-41 20-15 0-24-7-27-20z" fill="#e7be54" stroke-width="3"/>
            <path d="M55 44c-6-13 0-24 17-33-4 12-1 21 9 27-10-2-19 0-26 6z" fill="#f2a91f" stroke-width="2.5"/>
            <path d="M76 35c4-18 15-26 33-23-12 8-17 18-13 30-7-5-13-7-20-7z" fill="#ffcf4c" stroke-width="2.5"/>
            <path d="m56 50 58 12-11 54-58-12z" fill="#f3ead0" stroke-width="4"/>
            <path d="m62 57 45 9-8 42-45-9z" fill="#fff7de" stroke="#bd9e55" stroke-width="2"/>
            <path d="M66 93c6-24 18-33 36-28-13 6-18 15-15 28-8-6-15-6-21 0z" fill="#d7a637" stroke-width="3"/>
            <path d="M89 92c8-17 19-22 34-15-13 3-20 10-21 22-5-6-9-8-13-7z" fill="#f4c550" stroke-width="2.5"/>
            <path d="M51 113c15 9 31 13 49 10m-44-1c18 8 37 9 57 3" fill="none" stroke="#f8de83" stroke-width="3"/>
            <path d="M111 39c7-8 14-11 22-10-6 6-9 13-8 21m-83 7c-8 6-12 14-13 23m95 35c-4 8-10 14-18 18" fill="none" stroke="#d98e20" stroke-width="3"/>
            <circle cx="126" cy="25" r="4" fill="#f4bb33" stroke-width="1.5"/><circle cx="137" cy="44" r="3" fill="#f9d977" stroke-width="1.5"/>
        </g>`;
    }
    return undefined;
};

const frame = (family) => {
    if (family === 'boon' || family === 'deity') {
        return `<path class="shadow" d="m80 12 48 21 20 47-20 48-48 20-48-20-20-48 20-47z"/><path class="plate edge" d="m80 18 43 19 19 43-19 43-43 19-43-19-19-43 19-43z"/><path class="accent nofill edge" d="m80 29 35 15 16 36-16 36-35 15-35-15-16-36 16-36z"/>`;
    }
    if (family === 'incantation') {
        return '<path class="shadow" d="m22 47 58-34 60 35-8 81-52 21-53-22z"/><path class="plate edge" d="m20 42 60-31 58 33-10 79-48 20-49-20z"/><path class="accent fine" d="m35 51 45-25 43 25-8 61-35 15-36-15z"/>';
    }
    if (family === 'portrait') {
        return `<path class="shadow" d="M20 145c5-55 26-88 60-88s55 33 60 88z"/><path class="plate edge" d="M25 139c6-49 24-77 55-77s49 28 55 77z"/>`;
    }
    if (family === 'arcana' || family === 'prophecy' || family === 'achievement') {
        return '<g transform="rotate(-3 80 80)"><path class="shadow" d="M35 15h94v130H35z"/><path class="plate edge" d="M31 11h94v130H31z"/><path class="accent nofill edge" d="M41 22h74v108H41z"/></g>';
    }
    const shapes = {
        resource: 'M80 15 136 48l-8 72-48 27-48-27-8-72z',
        keepsake: 'M31 24h98l17 56-17 56H31L14 80z',
        familiar: 'M80 14c38 0 65 26 65 65 0 39-27 66-65 66S15 118 15 79c0-39 27-65 65-65z',
        region: 'M23 35 80 13l57 22 10 69-43 42H56l-43-42z',
        oath: 'M80 12 132 34l13 53-26 53-39 10-39-10-26-53 13-53z',
        guide: 'M25 24 80 33l55-9-7 115-48-10-48 10z',
        enemy: 'M80 12 134 36l11 50-24 49-41 14-41-14-24-49 11-50z',
        bond: 'M80 143C35 118 16 88 25 55 33 24 62 19 80 43c18-24 47-19 55 12 9 33-10 63-55 88z',
        record: 'M80 13 132 40l10 61-32 41H50l-32-41 10-61z',
    };
    const shape = shapes[family] ?? 'M37 17h86l22 36-9 78-56 17-56-17-9-78z';
    return `<path class="shadow" d="${shape}" transform="translate(4 5)"/><path class="plate edge" d="${shape}"/><path class="accent nofill edge" d="M80 28 122 49l7 52-49 31-49-31 7-52z"/>`;
};

const portrait = (name, signal, seed) => {
    const normalized = name.toLocaleLowerCase();
    if (normalized === 'chaos') {
        return `<path class="accent-deep edge" d="M31 139c4-55 20-93 49-112 30 19 46 57 49 112z"/><path class="ink edge" d="m80 20 38 35-8 60-30 26-31-26-8-60z"/><path class="accent-hi edge nofill" d="M45 73c17-25 53-25 70 0-17 26-53 26-70 0z"/><circle class="paper edge" cx="80" cy="73" r="15"/><circle class="ink" cx="80" cy="73" r="6"/><path class="accent fine" d="M44 104c22-12 48-12 72 0M80 20v28M52 34l14 21m42-21L94 55"/><circle class="accent-hi" cx="50" cy="31" r="5"/><circle class="paper" cx="111" cy="38" r="4"/>`;
    }
    if (normalized === 'dora') {
        return `<path class="moon edge" d="M38 137c2-45 12-76 31-92 4-4 7-13 11-27 4 14 8 23 12 27 19 16 29 47 30 92l-17-13-14 14-12-15-14 15-13-14z"/><path class="accent-hi edge nofill" d="M58 76c12-16 32-16 44 0-12 17-32 17-44 0z"/><circle class="ink" cx="80" cy="76" r="7"/><path class="paper fine" d="M61 102c13 7 26 7 39 0"/>`;
    }
    if (normalized === 'schelemeus') {
        return `<path class="accent-deep edge" d="M34 141c5-39 20-62 46-69 27 7 42 30 46 69z"/><path class="paper edge" d="M48 62c0-37 64-37 64 0 0 20-10 34-24 39v18H72v-18C58 96 48 82 48 62z"/><circle class="ink" cx="67" cy="65" r="8"/><circle class="ink" cx="93" cy="65" r="8"/><path class="ink edge nofill" d="m73 89 7-8 7 8m-22 25 15 12 15-12"/><path class="accent-hi edge" d="m47 107 15 7-12 26-16-7zm66 0-15 7 12 26 16-7z"/>`;
    }
    if (normalized === 'arachne') {
        return `<path class="accent-deep edge" d="M41 138c3-39 17-64 39-72 23 8 37 33 40 72z"/><circle class="skin edge" cx="80" cy="57" r="27"/><path class="ink edge" d="M51 62c-3-31 18-48 42-39 16 6 25 23 18 43L95 48 82 64 68 48z"/><path class="accent-hi edge nofill" d="M50 87 25 70m28 31-32 4m38 10-27 24m78-52 25-17m-28 31 32 4m-38 10 27 24"/><path class="paper fine" d="M68 56c4-3 8-3 12 0m4 0c4-3 8-3 12 0M72 76c5 3 10 3 15 0"/><path class="accent edge" d="m61 112 19-17 20 17-20 24z"/>`;
    }
    if (normalized === 'charon') {
        return `<path class="ink edge" d="M28 141c4-58 20-99 52-122 33 23 49 64 52 122z"/><path class="accent-deep edge" d="m48 74 12-34 20-13 21 13 12 34-14 41-19 13-20-13z"/><path class="paper edge" d="M58 74c1-31 43-31 44 0-1 23-9 36-22 42-13-6-21-19-22-42z"/><circle class="ink" cx="70" cy="76" r="7"/><circle class="ink" cx="91" cy="76" r="7"/><path class="ink edge nofill" d="m72 99 8-7 8 7"/><path class="accent-hi fine" d="M39 127c25 10 54 10 82 0"/>`;
    }
    if (normalized === 'zeus') {
        return `<path class="sky edge" d="M21 142c4-39 21-67 49-80 12-6 29-4 41 3 20 13 30 40 31 77z"/><path class="accent-deep edge" d="M25 137c5-24 17-43 35-56l20 17 22-18c19 13 30 32 34 57z"/><path class="moon edge" d="m30 114 29-35 18 17-16 42zm101 0-27-35-18 17 14 42z"/><path class="skin edge" d="M51 49c3-25 21-37 39-33 18 3 30 20 27 40l-7 30c-7 16-18 25-31 27-14-3-24-13-30-29z"/><path class="paper edge" d="M43 60c-5-26 9-48 34-52 26-4 46 15 46 43l-13-14-8 17-18-21-14 18-14-10z"/><path class="paper edge" d="M48 72c7 8 14 13 22 15l10-7 11 7c8-3 16-8 23-17l-5 31-29 26-30-26z"/><path class="moon edge" d="m48 70 18-9 12 7-10 10zm64-1-18-8-12 7 10 10z"/><path class="sky edge" d="M51 64c8-12 19-15 31-7-9 4-19 7-31 7zm58 0c-8-12-18-15-30-7 9 4 19 7 30 7z"/><circle class="paper" cx="68" cy="68" r="3.5"/><circle class="paper" cx="94" cy="68" r="3.5"/><path class="skin fine" d="m79 70-5 17 10 2"/><path class="ink edge nofill" d="M69 99c7 5 15 5 23 0"/><path class="accent-hi edge" d="m90 5-22 31h14l-7 29 31-43H91z"/><path class="paper fine" d="m88 17-11 16h12l-5 18"/><path class="accent-hi edge" d="m38 119 8-14 12 11-8 18zm85 0-8-14-12 11 8 18z"/><path class="sky fine" d="M58 130c15 5 31 5 47 0M53 136h55"/><circle class="accent-hi edge" cx="31" cy="127" r="7"/><circle class="accent-hi edge" cx="129" cy="127" r="7"/>`;
    }
    if (normalized === 'poseidon') {
        return `<g stroke="#070910" stroke-linecap="round" stroke-linejoin="round">
            <!-- dominant coral trident silhouette -->
            <path d="M31 25 38 151" fill="none" stroke="#973e4b" stroke-width="9"/>
            <path d="M31 25 36 151" fill="none" stroke="#e36a66" stroke-width="3"/>
            <path d="m31 8-15 32 14-7 2 24 8-24 13 7L43 8 36 24z" fill="#d9525d" stroke-width="5"/>
            <path d="M17 39 8 24l2 30 18 13m13-28 12-15-4 30-16 13" fill="#62a99d" stroke-width="5"/>
            <path d="M12 54c8-12 32-13 40 1l-6 15-14 8-14-8z" fill="#b3c7a8" stroke-width="4"/>
            <path d="m13 57 10 4-7 7m36-11-11 4 7 7" fill="none" stroke="#c69a52" stroke-width="3"/>
            <circle cx="32" cy="56" r="5" fill="#4cc8d0" stroke-width="2"/>

            <!-- unmistakable streaming sea-green hair -->
            <path d="M50 47C46 18 68 3 94 10c18 4 27 17 30 33 15 1 27 7 36 18-23-4-39 0-50 10 21-2 37 3 48 15-22-3-38 0-50 10 17 0 31 6 41 18-27-6-50-2-68 11-15-26-27-52-31-78z" fill="#073f49" stroke-width="5"/>
            <path d="M79 16c25 4 43 14 55 30-17-4-32-2-45 7 17-1 31 4 42 15-20-2-36 3-49 14z" fill="#17685f" stroke-width="3"/>
            <path d="M88 24c23 6 38 16 47 29-17-3-31 1-43 11 17-1 31 4 42 15-20-1-36 4-49 16z" fill="#2f9477" stroke-width="2.5"/>
            <path d="M101 18c9-9 18-11 28-7-2 9-9 14-20 15zm23 15c10-7 19-7 27-1-4 9-12 13-23 11z" fill="#d96262" stroke-width="3"/>

            <!-- broad, muscular god silhouette -->
            <path d="M42 151c1-31 13-51 34-61 13-6 31-6 45 0 22 10 34 30 36 61z" fill="#8f8068" stroke-width="5"/>
            <path d="M48 147c3-24 12-39 27-47 8 14 17 22 27 25 11-3 21-12 29-27 13 9 20 25 22 49z" fill="#756853" stroke-width="2.5"/>
            <path d="M67 121c10-6 20-6 30 1m4 0c11-7 22-7 33 0M99 113v34" fill="none" stroke="#453e34" stroke-width="3"/>
            <path d="M56 141c14-7 27-7 40 0m5 0c12-6 25-5 38 1" fill="none" stroke="#b8a780" stroke-width="2" opacity=".7"/>

            <!-- large mature face and full green beard -->
            <path d="M63 36c7-19 34-25 51-11 10 8 13 21 8 36l-7 23c-8 14-17 22-29 23-12-4-21-14-27-28l-5-23z" fill="#aa9572" stroke-width="5"/>
            <path d="M58 45c4-23 21-34 42-31 17 2 28 13 31 30-10-8-20-11-31-9-11-6-25-3-42 10z" fill="#0a4a50" stroke-width="5"/>
            <path d="M62 39c-3-12 7-18 18-11 7-11 18-9 23 1 11-7 21 1 15 13-9-5-18-4-26 2-9-6-19-7-30-5z" fill="#d17762" stroke-width="3"/>
            <path d="M64 55c8-7 17-8 25-2m27 1c-8-6-16-7-24-1" fill="none" stroke="#153b36" stroke-width="4"/>
            <path d="m66 59 13-4 8 5-9 7zm48 0-13-4-8 5 9 7z" fill="#d5dcc6" stroke-width="2"/>
            <circle cx="78" cy="60" r="2.8" fill="#071b1d" stroke="none"/><circle cx="102" cy="60" r="2.8" fill="#071b1d" stroke="none"/>
            <path d="m91 58-5 16 9 3" fill="none" stroke="#5c5143" stroke-width="2.5"/>
            <path d="M59 67c1 21 12 37 30 46 19-7 31-23 34-47-7 8-15 13-23 15l-11-7-10 7c-8-2-14-7-20-14z" fill="#0b514f" stroke-width="5"/>
            <path d="M64 73c6 10 13 17 22 21m31-21c-6 10-13 17-22 21" fill="none" stroke="#43a582" stroke-width="3"/>
            <path d="M77 87c8 5 17 5 25 0" fill="none" stroke="#d5c49c" stroke-width="2.5"/>

            <!-- shell breastplate, scale shoulder, jewelry, gripping arm -->
            <path d="M49 101c5-17 15-28 31-34l19 19-17 31-25 5z" fill="#268b91" stroke-width="4"/>
            <path d="M54 94c7-10 15-16 25-19l9 9-23 27z" fill="#70d0c9" stroke-width="2.5"/>
            <g fill="#d1a94d" stroke-width="1.8"><circle cx="58" cy="91" r="4"/><circle cx="67" cy="86" r="4"/><circle cx="76" cy="83" r="4"/><circle cx="54" cy="101" r="4"/><circle cx="64" cy="98" r="4"/></g>
            <path d="M74 84c8-8 16-11 24-8 8-3 17 0 25 8l9 22-15 18-19-7-20 7-15-18z" fill="#8d4568" stroke-width="4"/>
            <path d="M81 88c6-6 12-7 17-4 6-3 12-2 18 4l7 15-10 11-15-6-14 6-10-11z" fill="#da7580" stroke-width="2.5"/>
            <path d="M88 98c3-8 7-11 10-3 4-8 9-5 12 3-2 8-6 13-12 16-5-3-9-8-10-16z" fill="#f19a79" stroke-width="2"/>
            <path d="M124 96c11-10 23-7 27 5 3 9-1 20-11 31l-13 14-15-12 12-17z" fill="#9b886c" stroke-width="4"/>
            <path d="M128 106c6-6 13-5 16 1 2 5-1 11-7 17l-9 8-8-8z" fill="#b2a080" stroke-width="2.5"/>
            <path d="M119 130c8 1 15 5 20 13l-5 8h-23z" fill="#49364c" stroke-width="3"/>
            <path d="M44 129c7-7 15-6 23 2l-4 17-21 1z" fill="#553950" stroke-width="3"/>
            <g fill="#d0a753" stroke-width="1.5"><circle cx="47" cy="132" r="3"/><circle cx="55" cy="129" r="3"/><circle cx="63" cy="132" r="3"/><circle cx="121" cy="138" r="3"/><circle cx="128" cy="141" r="3"/></g>
        </g>`;
    }
    if (hasPortraitPlan(name)) return portraitFromPlan(name);
    const hairVariants = [
        'M51 62c-5-28 13-47 38-43 20 3 32 22 27 45L99 46 90 64 75 49 63 68z',
        'M48 60c2-32 26-47 50-37 17 7 26 24 22 42L99 50 88 64 75 51 61 69z',
        'M52 63c-9-25 6-47 31-48 25-1 42 20 36 47l-19-15-8 18-17-14-12 18z',
        'M48 64c0-32 19-49 44-44 21 4 33 24 27 48L99 49 87 65 74 50 61 70z',
    ];
    const ornament = /poseidon|sea/u.test(signal)
        ? '<path class="accent-hi edge nofill" d="M80 10v31M66 20l14-11 14 11"/>'
        : /aphrodite/u.test(signal)
          ? '<path class="accent-hi edge" d="M52 42c-8-18 12-29 28-8 16-21 36-10 28 8-8 18-19 26-28 32-10-6-21-14-28-32z"/>'
          : /ares/u.test(signal)
            ? '<path class="accent-hi edge" d="M48 43c5-28 18-40 32-40 15 0 27 12 33 40l-14-8-9 15-11-14-12 14-8-15z"/>'
            : /demeter|winter/u.test(signal)
              ? '<path class="moon edge nofill" d="M47 34c18-22 45-22 65 0M55 24l5 17m20-31v24m25-10-6 17"/>'
              : /hephaestus|forge/u.test(signal)
                ? '<path class="accent-hi edge" d="M47 38h66l-8 19H55z"/><path class="ink edge nofill" d="M58 42h18m8 0h18"/>'
                : /hermes/u.test(signal)
                  ? '<path class="accent-hi edge" d="m55 37-23-19 7 28 20 8zm50 0 23-19-7 28-20 8z"/>'
                  : /hestia/u.test(signal)
                    ? '<path class="accent-hi edge" d="M57 43c-8-21 5-34 20-45-1 13 5 21 17 26 10 8 11 20 4 33-13-13-26-18-41-14z"/>'
                    : /athena/u.test(signal)
                      ? '<path class="moon edge" d="M45 43c3-29 18-42 35-42s33 13 36 42l-19-7-17 14-17-14z"/><path class="accent-hi edge" d="M76 2h8l8 31H68z"/>'
                      : /dionysus/u.test(signal)
                        ? '<path class="sage edge" d="M45 36c12-23 29-27 37-8 10-19 27-15 35 8-22 11-48 11-72 0z"/><circle class="accent-hi edge" cx="58" cy="30" r="7"/><circle class="accent-hi edge" cx="102" cy="30" r="7"/>'
                        : /icarus/u.test(signal)
                          ? '<path class="moon edge" d="M50 36 24 17l11 34 23 12zm60 0 26-19-11 34-23 12z"/>'
                          : /heracles/u.test(signal)
                            ? '<path class="accent-hi edge" d="M45 52c-5-28 11-45 35-45s40 17 35 45l-17-12-18 15-18-15z"/><path class="ink edge nofill" d="M52 29 38 13m56 16 14-16"/>'
                            : /narcissus/u.test(signal)
                              ? '<path class="sage edge" d="M51 39c-8-18 11-30 29-10 18-20 37-8 29 10-20 7-39 7-58 0z"/><circle class="paper edge" cx="80" cy="24" r="8"/>'
                              : /odysseus/u.test(signal)
                                ? '<path class="accent-hi edge" d="M48 34h64l-5 14H53z"/><path class="paper fine" d="M57 26c15-8 31-8 47 0"/>'
                                : /zagreus/u.test(signal)
                                  ? '<path class="sage edge" d="M48 38c8-19 19-27 32-22 13-5 24 3 32 22-23 12-45 12-64 0z"/><path class="accent-hi edge" d="m94 16 18-10-7 20z"/>'
                                  : /hera|queen|crown/u.test(signal)
                                    ? '<path class="accent-hi edge" d="m58 33 6-22 16 14 16-14 7 22z"/>'
                                    : /ares|war|nemesis/u.test(signal)
                                      ? '<path class="accent-hi edge" d="M57 34c5-23 41-23 47 0l-9-4-5 11-11-9-10 10-6-11z"/>'
                                      : /witch|hecate|circe|medea/u.test(signal)
                                        ? '<path class="accent-hi edge" d="m45 34 35-29 35 29-21-5-14 11-14-11z"/>'
                                        : `<circle class="accent-hi edge" cx="80" cy="24" r="${6 + (seed % 5)}"/>`;
    return `<path class="accent edge" d="M37 140c5-45 20-70 43-73 24 3 39 28 43 73z"/><path class="skin edge" d="M57 48c6-23 40-25 47-1l-4 34c-5 14-12 22-21 25-10-4-17-13-21-26z"/><path class="ink edge" d="${hairVariants[seed % hairVariants.length]}"/>${ornament}<path class="ink fine" d="M66 69c4-3 8-3 12 0m6 0c4-3 8-3 12 0M72 92c6 3 11 3 16 0"/><path class="moon fine" d="M49 124c20 9 40 9 61 0"/>`;
};

const stagedMotifs = (family, selected) => {
    const [primary, secondary = 'seal', tertiary = 'star'] = selected;
    const lean = family === 'weapon' || family === 'hammer' || family === 'tool' ? -5 : 5;
    if (family === 'incantation') {
        return `<g transform="translate(21 24) scale(.72)">${motifs[primary]}</g><g transform="translate(91 93) scale(.34) rotate(${-lean} 80 80)">${motifs[secondary]}</g><path class="paper fine" d="M39 130c22 7 50 8 82 0"/><path class="accent-hi edge" d="m35 126 8 5-9 5-7-5zm89 0 9 5-9 5-8-5z"/>`;
    }
    if (family === 'boon') {
        return `<g transform="translate(24 18) scale(.68)">${motifs[primary]}</g><g transform="translate(88 86) scale(.42) rotate(${lean} 80 80)">${motifs[secondary]}</g><g transform="translate(21 103) scale(.2)">${motifs[tertiary]}</g><path class="paper edge" d="m35 125 47 8 44-10-7 13-38 8-39-7z"/><path class="accent-hi fine" d="M43 128c23 6 48 6 75-1"/>`;
    }
    if (family === 'arcana' || family === 'prophecy' || family === 'achievement') {
        return `<g transform="translate(17 20) scale(.76)">${motifs[primary]}</g><g transform="translate(93 97) scale(.28)">${motifs[secondary]}</g><circle class="rivet" cx="42" cy="121" r="3"/>`;
    }
    if (family === 'weapon' || family === 'hammer' || family === 'tool') {
        return `<g transform="translate(15 18) scale(.78) rotate(${lean} 80 80)">${motifs[primary]}</g><g transform="translate(96 94) scale(.27)">${motifs[secondary]}</g><path class="paper fine" d="m38 126 83-6"/>`;
    }
    if (family === 'oath' || family === 'region' || family === 'guide') {
        return `<g transform="translate(20 19) scale(.74)">${motifs[primary]}</g><g transform="translate(98 96) scale(.26)">${motifs[secondary]}</g><g transform="translate(27 102) scale(.2)">${motifs[tertiary]}</g>`;
    }
    return `<g transform="translate(18 18) scale(.76)">${motifs[primary]}</g><g transform="translate(96 96) scale(.27) rotate(${lean} 80 80)">${motifs[secondary]}</g>`;
};

const identityRune = (seed) => {
    const nodes = Array.from({ length: 7 }, (_, index) => {
        const value = (seed >>> ((index * 4) % 28)) & 0xf;
        const x = 47 + index * 11;
        const y = 134 - (value & 0x3) * 3;
        const radius = 1.8 + ((value >>> 2) & 0x1) * 1.2;
        const style = value & 0x8 ? 'accent-hi' : 'moon';
        return `<circle class="${style} edge" cx="${x}" cy="${y}" r="${radius}"/>`;
    });
    return `<path class="accent-deep edge" d="M40 139h80l-7 9H47z"/>${nodes.join('')}`;
};

const symbolFor = (record, records) => {
    const seed = hashString(artworkKey(record));
    const family = recordFamily(records);
    const signal = signalFor(records);
    const weaponMotifs = {
        'Moonstone Axe': ['axe', 'moon', 'blade'],
        'Sister Blades': ['daggers', 'blade', 'moon'],
        'The Sister Blades': ['daggers', 'blade', 'moon'],
        'Argent Skull': ['skull', 'flame', 'moon'],
        "Witch's Staff": ['staff', 'moon', 'crystal'],
        'Black Coat': ['coat', 'shield', 'bolt'],
        'The Black Coat': ['coat', 'shield', 'bolt'],
        'Umbral Flames': ['torch', 'flame', 'spiral'],
    };
    const selectedMotifs = weaponMotifs[record.public.name] ?? motifCandidates(record, records, family);
    const divineMotif = family === 'boon' || family === 'deity' ? divineMotifFor(signal) : undefined;
    if (divineMotif && !selectedMotifs.includes(divineMotif)) selectedMotifs.splice(1, 0, divineMotif);
    const [accent, accentHi, accentDeep] = paletteFor(signal, family);
    const central =
        family === 'portrait' || family === 'deity'
            ? portrait(record.public.name, signal, seed)
            : stagedMotifs(family, selectedMotifs);
    const exact = exactSubjectArtwork(record.public.name);
    const recordSpecificMark = family === 'enemy' ? identityRune(seed) : '';
    const body = exact
        ? exact
        : `${frame(family)}${central}${recordSpecificMark}<path class="etch" d="M31 132c17 7 33 8 49 2 17 7 34 6 51-3"/><circle class="rivet" cx="31" cy="31" r="3"/><circle class="rivet" cx="128" cy="126" r="2.5"/>`;
    return `<symbol id="${artworkId(record)}" viewBox="0 0 160 160"><title>${escapeXml(record.public.name)}</title><g style="--accent:${accent};--accent-hi:${accentHi};--accent-deep:${accentDeep}">${body}</g></symbol>`;
};

const collectionDefinitions = [
    ['achievements', 'achievement', ['star', 'crown', 'torch'], ['#e69c45', '#ffe19a', '#7a3728']],
    ['arcana', 'arcana', ['book', 'moon', 'eye'], ['#7555d9', '#e6dcff', '#2e2258']],
    ['aspects', 'weapon', ['blade', 'moon', 'thread'], ['#8798c9', '#f3f5ff', '#3f4772']],
    ['boons', 'boon', ['seal', 'bolt', 'charm'], ['#38bfae', '#d8fff7', '#23545d']],
    ['builds', 'weapon', ['blade', 'hammer', 'book'], ['#c46e45', '#ffd39d', '#5b2f36']],
    ['enemies', 'oath', ['skull', 'eye', 'shield'], ['#a84750', '#ffd0c2', '#4a1e31']],
    ['familiars', 'familiar', ['beast', 'heart', 'leaf'], ['#74b99b', '#e4ffe8', '#315f55']],
    ['hammers', 'hammer', ['hammer', 'tool', 'crystal'], ['#d87d36', '#ffe0a0', '#6f3828']],
    ['hexes', 'arcana', ['moon', 'star', 'thread'], ['#7250d6', '#f2eaff', '#302454']],
    ['incantations', 'incantation', ['cauldron', 'book', 'flame'], ['#a466dc', '#f0d3ff', '#4f2f68']],
    ['keepsakes', 'keepsake', ['charm', 'heart', 'seal'], ['#d08a45', '#fff0b2', '#664029']],
    ['oath', 'oath', ['shield', 'scales', 'flame'], ['#b84f45', '#ffb0a0', '#4e2026']],
    ['prophecies', 'prophecy', ['thread', 'eye', 'book'], ['#7180bc', '#f1f2ff', '#30385c']],
    ['regions', 'region', ['gate', 'path', 'torch'], ['#4f9fb7', '#d8fbff', '#24545f']],
    ['relationships', 'bond', ['heart', 'charm', 'thread'], ['#d75b75', '#ffe0e8', '#612b43']],
    ['resources', 'resource', ['crystal', 'coin', 'flower'], ['#4f9b79', '#e1ffe9', '#295542']],
    ['story', 'guide', ['book', 'path', 'thread'], ['#6d70b8', '#f0eeff', '#303052']],
    ['weapons', 'weapon', ['daggers', 'staff', 'axe'], ['#7d8db2', '#ffffff', '#39435e']],
];

const collectionSymbolFor = ([slug, family, selected, palette]) => {
    const [accent, accentHi, accentDeep] = palette;
    return `<symbol id="collection-${slug}" viewBox="0 0 160 160"><title>${escapeXml(slug)}</title><g style="--accent:${accent};--accent-hi:${accentHi};--accent-deep:${accentDeep}">${frame(family)}${stagedMotifs(family, selected)}<path class="etch" d="M31 132c17 7 33 8 49 2 17 7 34 6 51-3"/></g></symbol>`;
};

const collectionFingerprints = collectionDefinitions.map(
    ([slug, family, selected, palette]) => `${slug}:${family}:${selected[0]}:${palette.join(':')}`
);
if (
    new Set(collectionFingerprints.map((fingerprint) => fingerprint.split(':').slice(1).join(':'))).size !==
    collectionDefinitions.length
) {
    throw new Error('Collection artwork must not share the same frame, dominant motif, and palette.');
}

const publicationPath = resolvePublication();
const publication = readJson(publicationPath);
const published = publication.records.filter((record) => record.public && record.publication?.status === 'published');
const grouped = new Map();
for (const record of published) {
    const key = artworkKey(record);
    const records = grouped.get(key) ?? [];
    records.push(record);
    grouped.set(key, records);
}

const subjects = [...grouped.values()]
    .map((records) => ({ record: records[0], records }))
    .sort((left, right) => artworkKey(left.record).localeCompare(artworkKey(right.record)));
const ids = subjects.map(({ record }) => artworkId(record));
if (new Set(ids).size !== ids.length) throw new Error('Crafted artwork IDs are not unique.');
const missingPortraitPlans = [];
for (const { record, records } of subjects) {
    const family = recordFamily(records);
    if (family === 'portrait' || family === 'deity') {
        if (!manualPortraitNames.has(record.public.name) && !hasPortraitPlan(record.public.name)) {
            missingPortraitPlans.push(`${record.public.name} (${record.recordType})`);
        }
        continue;
    }
    motifCandidates(record, records, family);
}
if (missingPortraitPlans.length > 0) {
    throw new Error(`Missing explicit portrait plans:\n${[...new Set(missingPortraitPlans)].join('\n')}`);
}
if (unmappedArtSubjects.length > 0) {
    throw new Error(`Missing subject-specific art vocabulary:\n${[...new Set(unmappedArtSubjects)].join('\n')}`);
}

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" viewBox="0 0 160 160">
  <title>NeonHades2 record artwork</title>
  <desc>Identity-specific vector artwork for NeonHades2.</desc>
  <defs>
    <filter id="crafted-shadow" x="-35%" y="-35%" width="180%" height="190%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="4" result="blur"/>
      <feOffset in="blur" dx="3" dy="7" result="offset"/>
      <feFlood flood-color="#02030a" flood-opacity=".82" result="color"/>
      <feComposite in="color" in2="offset" operator="in" result="shadow"/>
      <feMerge><feMergeNode in="shadow"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <style>
      .edge{stroke:#070910;stroke-width:5;stroke-linecap:round;stroke-linejoin:round}.shadow{fill:#05060a;opacity:.9}.plate{fill:#1d2431;filter:url(#crafted-shadow)}.accent{fill:var(--accent);stroke:var(--accent)}.accent-hi{fill:var(--accent-hi);stroke:var(--accent-hi)}.accent-deep{fill:var(--accent-deep);stroke:var(--accent-deep)}.paper{fill:#f2eee5;stroke:#f2eee5}.moon{fill:#d4d7ee;stroke:#d4d7ee}.sky{fill:#5a6eaf;stroke:#5a6eaf}.sage{fill:#74b99b;stroke:#74b99b}.skin{fill:#8f5947;stroke:#8f5947}.ink{fill:#090b12;stroke:#090b12}.fine{fill:none;stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round}.nofill{fill:none}.etch{fill:none;stroke:var(--accent-hi);stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;opacity:.38}.rivet{fill:#f2eee5;stroke:#070910;stroke-width:2;opacity:.7}
    </style>
    ${subjects.map(({ record, records }) => symbolFor(record, records)).join('\n    ')}
    ${collectionDefinitions.map(collectionSymbolFor).join('\n    ')}
  </defs>
</svg>
`;

mkdirSync(dirname(outputPath), { recursive: true });
const optimizedSvg = svg.replace(/>\s+</gu, '><').trim();
writeFileSync(outputPath, optimizedSvg, 'utf8');
console.warn(
    JSON.stringify({
        output: outputPath,
        publication: publicationPath,
        publishedRecords: published.length,
        uniquePublicSubjects: subjects.length,
        symbols: ids.length + collectionDefinitions.length,
    })
);
