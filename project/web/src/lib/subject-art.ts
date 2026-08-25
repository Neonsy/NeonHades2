import type { PublicationRecord } from './publication';
import artworkManifest from '../content/artwork-production-manifest.json';

type CacheVersion = '' | `?v=${string}`;
type PublishedSubjectSource = `/art/${string}.webp${CacheVersion}`;
type CharacterRasterSource = `/art/characters/${string}.webp`;

export type SubjectArt = {
    kind: 'character' | 'material' | 'record';
    id: string;
    source:
        | '/art/symbols/materials.svg'
        | '/art/symbols/records.svg'
        | '/art/symbols/record-icons.svg'
        | CharacterRasterSource
        | PublishedSubjectSource;
    format?: 'raster';
    overlaySource?: CharacterRasterSource;
    tone: 'ember' | 'moon' | 'night' | 'thread' | 'violet';
    marks?: readonly string[];
};

const rasterSubject = (
    kind: SubjectArt['kind'],
    id: string,
    source: SubjectArt['source'],
    tone: SubjectArt['tone']
): SubjectArt => ({
    kind,
    id,
    source,
    format: 'raster',
    tone,
});

type ManifestDelivery = {
    id: string;
    kind: SubjectArt['kind'];
    tone: SubjectArt['tone'];
    media: 'webp';
    source: string;
    master: string;
};

type ManifestRecord = {
    canonicalAsset: string;
    publicName?: string;
    route: 'krita' | 'krita-review' | 'opencv-raster' | 'opencv-vtracer-inkscape';
    status: 'accepted' | 'pending';
    delivery?: ManifestDelivery;
};

const productionRecords = artworkManifest.records as Readonly<Record<string, ManifestRecord>>;
const acceptedBoonArtByPublicName = new Map<string, ManifestDelivery>();

for (const [recordKey, entry] of Object.entries(productionRecords)) {
    if (!recordKey.startsWith('mechanics/boon:')) continue;
    if (entry.status !== 'accepted' || !entry.publicName || !entry.delivery) continue;
    const existing = acceptedBoonArtByPublicName.get(entry.publicName);
    if (existing && existing.source !== entry.delivery.source) {
        throw new Error(`Accepted Boon artwork is ambiguous for ${entry.publicName}`);
    }
    acceptedBoonArtByPublicName.set(entry.publicName, entry.delivery);
}

const publishedSubjectSource = (recordKey: string, source: string): PublishedSubjectSource => {
    if (
        !/^\/art\/(?:arcana|boons|characters|encounters|familiars|hammers|hexes|incantations|keepsakes|oaths|regions|resources|rewards|tools|weapons)\/(?:[a-z0-9]+(?:-[a-z0-9]+)*\/)*[a-z0-9]+(?:-[a-z0-9]+)*\.webp$/u.test(
            source
        )
    ) {
        throw new Error(`Accepted artwork has an invalid delivery path for ${recordKey}: ${source}`);
    }
    return source as PublishedSubjectSource;
};

const productionRecordArt = (record: PublicationRecord): SubjectArt | null => {
    const entry = productionRecords[record.key];
    const delivery =
        entry?.status === 'accepted' && entry.delivery
            ? entry.delivery
            : record.recordType === 'editorial/boon-rating'
              ? acceptedBoonArtByPublicName.get(record.public?.name ?? '')
              : undefined;
    if (!delivery) return null;
    return rasterSubject(
        delivery.kind,
        delivery.id,
        publishedSubjectSource(record.key, delivery.source),
        delivery.tone
    );
};

const material = (id: string, tone: SubjectArt['tone']): SubjectArt => ({
    kind: 'material',
    id,
    source: '/art/symbols/materials.svg',
    tone,
});

const collectionArt = (slug: string, tone: SubjectArt['tone']): SubjectArt => ({
    kind: 'record',
    id: `collection-${slug}`,
    source: '/art/symbols/record-icons.svg',
    tone,
});

const hashArtworkKey = (value: string): number => {
    let hash = 0x811c9dc5;
    for (const character of value) {
        hash ^= character.codePointAt(0) ?? 0;
        hash = Math.imul(hash, 0x01000193);
    }
    return hash >>> 0;
};

const craftedRecordArt = (record: PublicationRecord): SubjectArt => {
    if (!record.public) throw new Error(`Reader-facing record has no public identity: ${record.key}`);
    const readable = record.public.name
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/gu, '')
        .toLocaleLowerCase()
        .replace(/['’]/gu, '')
        .replace(/[^a-z0-9]+/gu, '-')
        .replace(/^-+|-+$/gu, '')
        .slice(0, 42);
    const key = `${record.public.href}::${record.public.name}`;
    const id = `crafted-${readable || 'subject'}-${hashArtworkKey(key).toString(36)}`;
    const tones: Array<SubjectArt['tone']> = ['thread', 'violet', 'ember', 'moon', 'night'];
    return {
        kind: 'record',
        id,
        source: '/art/symbols/record-icons.svg',
        tone: tones[hashArtworkKey(record.public.name) % tones.length],
    };
};

const collectionArtBySlug: Readonly<Record<string, SubjectArt>> = {
    achievements: collectionArt('achievements', 'ember'),
    arcana: collectionArt('arcana', 'violet'),
    aspects: collectionArt('aspects', 'moon'),
    boons: collectionArt('boons', 'thread'),
    builds: collectionArt('builds', 'ember'),
    enemies: collectionArt('enemies', 'night'),
    familiars: collectionArt('familiars', 'thread'),
    hammers: collectionArt('hammers', 'ember'),
    hexes: collectionArt('hexes', 'violet'),
    incantations: collectionArt('incantations', 'violet'),
    keepsakes: collectionArt('keepsakes', 'ember'),
    oath: collectionArt('oath', 'night'),
    prophecies: collectionArt('prophecies', 'moon'),
    regions: collectionArt('regions', 'thread'),
    relationships: collectionArt('relationships', 'night'),
    resources: collectionArt('resources', 'thread'),
    story: collectionArt('story', 'violet'),
    weapons: collectionArt('weapons', 'moon'),
};

export const getCollectionSubjectArt = (slug: string): SubjectArt => {
    const normalized = slug.replace(/^tier-lists\//u, '');
    const subject = collectionArtBySlug[normalized];
    if (!subject) throw new Error(`Reader-facing collection has no authored artwork: ${slug}`);
    return subject;
};

const subjectArtByPublicName: Readonly<Record<string, SubjectArt>> = {
    Heracles: rasterSubject('character', 'heracles', '/art/characters/encounters/heracles.webp', 'ember'),
    Medea: rasterSubject('character', 'medea', '/art/characters/encounters/medea.webp', 'violet'),
    Eris: rasterSubject('character', 'eris', '/art/characters/relationships/eris.webp', 'ember'),
    Cerberus: rasterSubject('character', 'cerberus', '/art/characters/story/cerberus.webp', 'night'),
    Ashes: rasterSubject('material', 'ashes', '/art/resources/ashes.webp', 'moon'),
    Psyche: material('psyche', 'thread'),
    Silver: material('silver', 'moon'),
    Moly: material('moly', 'ember'),
    Nectar: material('nectar', 'ember'),
    Bones: material('bones', 'moon'),
    'Moon Dust': material('moon-dust', 'violet'),
    Nightshade: material('nightshade', 'violet'),
    Bronze: material('bronze', 'ember'),
    'Fate Fabric': rasterSubject('material', 'fate-fabric', '/art/resources/fate-fabric.webp', 'thread'),
    Pearl: material('pearl', 'moon'),
    Lotus: material('lotus', 'violet'),
    Cinder: material('cinder', 'ember'),
    Nightmare: material('nightmare', 'night'),
    Adamant: material('adamant', 'violet'),
    Ambrosia: material('ambrosia', 'ember'),
    'Bath Salts': material('bath-salts', 'moon'),
    Cattail: material('cattail', 'ember'),
    'Cattail Seeds': material('cattail-seeds', 'moon'),
    Chimaerid: material('chimaerid', 'ember'),
    Chiton: material('chiton', 'violet'),
    Chrab: material('chrab', 'ember'),
    Darkness: material('darkness', 'violet'),
    'Dream Vapors': material('dream-vapors', 'violet'),
    Driftwood: material('driftwood', 'ember'),
    'Ectoplasmic Draught': material('ectoplasmic-draught', 'thread'),
    Entropy: material('entropy', 'night'),
    Fangs: material('fangs', 'moon'),
    Feather: material('feather', 'moon'),
    Figment: material('figment', 'violet'),
    Flux: material('flux', 'violet'),
    Garlic: material('garlic', 'moon'),
    'Garlic Cloves': material('garlic-cloves', 'moon'),
    Gemstones: material('gemstones', 'ember'),
    Gigaros: material('gigaros', 'night'),
    Glassrock: material('glassrock', 'night'),
    Goldfish: material('goldfish', 'ember'),
    'Gold Crowns': material('gold-crowns', 'ember'),
    'Golden Apple': material('golden-apple', 'ember'),
    Gutterpop: material('gutterpop', 'violet'),
    'House Soot': material('house-soot', 'night'),
    Iris: material('iris', 'violet'),
    Iron: material('iron', 'night'),
    Jiffy: material('jiffy', 'night'),
    Kudos: material('kudos', 'thread'),
    Lamprey: material('lamprey', 'night'),
    Limestone: material('limestone', 'ember'),
    'Mandrake Root': material('mandrake-root', 'moon'),
    'Mandrake Seeds': material('mandrake-seeds', 'night'),
    Marble: material('marble', 'moon'),
    Mati: material('mati', 'violet'),
    Moper: material('moper', 'violet'),
    Moss: material('moss', 'thread'),
    Myrtle: material('myrtle', 'moon'),
    'Mystery Seeds': material('mystery-seeds', 'violet'),
    Neckbiter: material('neckbiter', 'night'),
    'Nightshade Seeds': material('nightshade-seeds', 'violet'),
    'Obol Points': material('obol-points', 'ember'),
    Olive: material('olive', 'thread'),
    'Olive Branch': material('olive-branch', 'ember'),
    'Origin Seeds': material('origin-seeds', 'night'),
    Pillartop: material('pillartop', 'moon'),
    Plankton: material('plankton', 'night'),
    Poppy: material('poppy', 'night'),
    'Poppy Seeds': material('poppy-seeds', 'moon'),
    Projelly: material('projelly', 'violet'),
    Ribeye: material('ribeye', 'night'),
    Rubbish: material('rubbish', 'night'),
    'Serpent Scales': material('serpent-scales', 'thread'),
    Shaderot: material('shaderot', 'thread'),
    Shadow: material('shadow', 'thread'),
    'Shiny Stars': material('shiny-stars', 'violet'),
    Shrimp: material('shrimp', 'thread'),
    'Snake-reed': material('snake-reed', 'thread'),
    Soby: material('soby', 'violet'),
    Soulbelly: material('soulbelly', 'night'),
    Squid: material('squid', 'night'),
    'Star Dust': material('star-dust', 'violet'),
    Stalkfin: material('stalkfin', 'night'),
    Starsailor: material('starsailor', 'violet'),
    Stormgullet: material('stormgullet', 'night'),
    Styxeon: material('styxeon', 'night'),
    Tearjerker: material('tearjerker', 'night'),
    Tears: material('tears', 'moon'),
    'Tears, Vaporized': material('vaporized-tears', 'violet'),
    Thalamus: material('thalamus', 'night'),
    'Twin Lures': material('twin-lures', 'violet'),
    'Void Lens': material('void-lens', 'night'),
    Voidskate: material('voidskate', 'night'),
    Wheat: material('wheat', 'ember'),
    'Wheat Seeds': material('wheat-seeds', 'ember'),
    "Witch's Delight": material('witchs-delight', 'thread'),
    Wool: material('wool', 'moon'),
    'Zodiac Sand': material('zodiac-sand', 'ember'),
    Zeel: material('zeel', 'thread'),
    Anguish: material('anguish', 'violet'),
    Chrestle: material('chrestle', 'violet'),
    'Boon of Hermes': material('boon-hermes', 'thread'),
    'Boon of Olympus': material('boon-olympus', 'ember'),
    'Centaur Heart': material('centaur-heart', 'night'),
    'Daedalus Hammer': material('daedalus-hammer', 'ember'),
    'Family Dispute': material('family-dispute', 'violet'),
    'Gift of the Moon': material('gift-moon', 'moon'),
    'Path of Stars': material('path-stars', 'moon'),
    'Pom of Power': material('pom-power', 'ember'),
    'Soul Tonic': material('soul-tonic', 'thread'),
    'Crescent Pick': material('crescent-pick', 'moon'),
    'Silver Spade': material('silver-spade', 'moon'),
    'Tablet of Peace': material('tablet-peace', 'thread'),
    'Rod of Fishing': material('fishing-rod', 'ember'),
    'Temper of Zeus': rasterSubject('record', 'temper-of-zeus', '/art/hexes/talents/temper-of-zeus.webp', 'moon'),
    'Nurture of Hera': rasterSubject('record', 'nurture-of-hera', '/art/hexes/talents/nurture-of-hera.webp', 'moon'),
    'Hearth of Hestia': rasterSubject('record', 'hearth-of-hestia', '/art/hexes/talents/hearth-of-hestia.webp', 'moon'),
    'Squall of Demeter': rasterSubject(
        'record',
        'squall-of-demeter',
        '/art/hexes/talents/squall-of-demeter.webp',
        'moon'
    ),
    'Allure of Aphrodite': rasterSubject(
        'record',
        'allure-of-aphrodite',
        '/art/hexes/talents/allure-of-aphrodite.webp',
        'moon'
    ),
    'Hand of Hephaestus': rasterSubject(
        'record',
        'hand-of-hephaestus',
        '/art/hexes/talents/hand-of-hephaestus.webp',
        'moon'
    ),
    'Pride of Poseidon': rasterSubject(
        'record',
        'pride-of-poseidon',
        '/art/hexes/talents/pride-of-poseidon.webp',
        'moon'
    ),
    'Lance of Ares': rasterSubject('record', 'lance-of-ares', '/art/hexes/talents/lance-of-ares.webp', 'moon'),
    'Shine of Apollo': rasterSubject('record', 'shine-of-apollo', '/art/hexes/talents/shine-of-apollo.webp', 'moon'),
    'Nova Strike': rasterSubject('record', 'nova-strike', '/art/boons/nova-strike.webp?v=20260825', 'ember'),
    'Born Gain': rasterSubject('record', 'born-gain', '/art/boons/born-gain.webp?v=20260825', 'violet'),
};

export const getSubjectArt = (publicName: string): SubjectArt | null => subjectArtByPublicName[publicName] ?? null;

export const requireSubjectArt = (publicName: string): SubjectArt => {
    const subject = getSubjectArt(publicName);
    if (!subject) throw new Error(`Reader-facing subject has no authored icon: ${publicName}`);
    return subject;
};

const authoredNameArt = (publicName: string): SubjectArt | null => {
    return getSubjectArt(publicName);
};

export const getRecordSubjectArt = (record: PublicationRecord): SubjectArt => {
    if (!record.public) throw new Error(`Reader-facing record has no public identity: ${record.key}`);

    const production = productionRecordArt(record);
    if (production) return production;

    if (record.recordType === 'mechanics/familiar' || record.recordType === 'editorial/familiar-rating') {
        throw new Error(`Accepted familiar portrait is missing from the production manifest: ${record.key}`);
    }

    const named = authoredNameArt(record.public.name);
    if (named) return named;

    return craftedRecordArt(record);
};
