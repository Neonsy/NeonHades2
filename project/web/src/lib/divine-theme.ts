import { getFieldBySuffix, getRecord, getRecordName, type PublicationRecord } from './publication';

export type DivineTheme = {
    name: string;
    slug: string;
    accent: string;
    accentSoft: string;
    accentDeep: string;
};

const themes: Record<string, Omit<DivineTheme, 'name'>> = {
    Aphrodite: { slug: 'aphrodite', accent: '#ff76bd', accentSoft: '#ffb4d9', accentDeep: '#4a1738' },
    Apollo: { slug: 'apollo', accent: '#fff14c', accentSoft: '#ffcc62', accentDeep: '#493a08' },
    Ares: { slug: 'ares', accent: '#f25765', accentSoft: '#ff9aa3', accentDeep: '#48131b' },
    Artemis: { slug: 'artemis', accent: '#68d391', accentSoft: '#a7ebbd', accentDeep: '#123a27' },
    Athena: { slug: 'athena', accent: '#b7d4ff', accentSoft: '#e3edff', accentDeep: '#1c3155' },
    Chaos: { slug: 'chaos', accent: '#c07aff', accentSoft: '#deb7ff', accentDeep: '#321550' },
    Demeter: { slug: 'demeter', accent: '#8ee9ff', accentSoft: '#c5f5ff', accentDeep: '#123d4b' },
    Dionysus: { slug: 'dionysus', accent: '#b37aff', accentSoft: '#d7b8ff', accentDeep: '#2e1950' },
    Hephaestus: { slug: 'hephaestus', accent: '#f29d49', accentSoft: '#ffc27e', accentDeep: '#4a2610' },
    Hera: { slug: 'hera', accent: '#8ba8ff', accentSoft: '#bdcaff', accentDeep: '#1d2a58' },
    Hermes: { slug: 'hermes', accent: '#ffad45', accentSoft: '#ffd08a', accentDeep: '#4c2d0b' },
    Hestia: { slug: 'hestia', accent: '#ff784f', accentSoft: '#ffb18f', accentDeep: '#4a1d12' },
    Poseidon: { slug: 'poseidon', accent: '#51c7ff', accentSoft: '#9ce1ff', accentDeep: '#103951' },
    Selene: { slug: 'selene', accent: '#9bc7ff', accentSoft: '#d3e6ff', accentDeep: '#203458' },
    Zeus: { slug: 'zeus', accent: '#ffe45e', accentSoft: '#fff0a3', accentDeep: '#473b0d' },
};

type RecordReference = { id: string; recordType: string };

const isReference = (value: unknown): value is RecordReference =>
    typeof value === 'object' && value !== null && 'id' in value && 'recordType' in value;

function godNameFor(record: PublicationRecord): string | null {
    if (record.recordType === 'mechanics/god') return getRecordName(record);

    if (record.recordType === 'mechanics/boon') {
        const value = getFieldBySuffix(record, 'god');
        const reference = Array.isArray(value) ? value.find(isReference) : isReference(value) ? value : undefined;
        if (!reference) return null;
        const god = getRecord(`${reference.recordType}:${reference.id}`);
        return god?.public ? getRecordName(god) : null;
    }

    const publicName = getRecordName(record);
    return themes[publicName] ? publicName : null;
}

export function getDivineTheme(record: PublicationRecord): DivineTheme | null {
    const name = godNameFor(record);
    if (!name) return null;
    const theme = themes[name];
    return theme ? { name, ...theme } : null;
}

export function getDivineThemeByName(name: string): DivineTheme | null {
    const theme = themes[name];
    return theme ? { name, ...theme } : null;
}

export function divineThemeStyle(theme: DivineTheme): string {
    return `--domain-accent:${theme.accent};--domain-accent-soft:${theme.accentSoft};--domain-accent-deep:${theme.accentDeep}`;
}
