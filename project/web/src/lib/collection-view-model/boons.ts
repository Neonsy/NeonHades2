import { getDivineTheme } from '../divine-theme';
import { getFieldBySuffix, type PublicationRecord } from '../publication';

type RecordReference = { id: string; recordType: string };

const isRecordReference = (value: unknown): value is RecordReference =>
    typeof value === 'object' && value !== null && 'id' in value && 'recordType' in value;

const boonGodKey = (record: PublicationRecord): string | null => {
    const value = getFieldBySuffix(record, 'god');
    const reference = Array.isArray(value)
        ? value.find(isRecordReference)
        : isRecordReference(value)
          ? value
          : undefined;
    return reference ? `${reference.recordType}:${reference.id}` : null;
};

export function buildBoonCollectionModel(slug: string, sortedRecords: PublicationRecord[]) {
    if (slug !== 'boons') {
        return { divineGroups: [], sharedBoonRecords: [], legendaryBoons: [], duoBoons: [] };
    }

    const godRecords = sortedRecords.filter((record) => record.recordType === 'mechanics/god');
    const boonRecords = sortedRecords.filter((record) => record.recordType === 'mechanics/boon');
    const legendaryBoons = boonRecords.filter((record) => getFieldBySuffix<string>(record, 'kind') === 'legendary');
    const duoBoons = boonRecords.filter((record) => getFieldBySuffix<string>(record, 'kind') === 'duo');
    const divineGroups = godRecords.map((god) => {
        const theme = getDivineTheme(god);
        if (!theme) throw new Error(`God record has no authored visual domain: ${god.key}`);
        return { god, theme, boons: boonRecords.filter((boon) => boonGodKey(boon) === god.key) };
    });
    const groupedBoonKeys = new Set(divineGroups.flatMap((group) => group.boons.map((boon) => boon.key)));
    const sharedBoonRecords = sortedRecords.filter(
        (record) =>
            record.recordType !== 'mechanics/god' &&
            (record.recordType !== 'mechanics/boon' || !groupedBoonKeys.has(record.key))
    );

    return { divineGroups, sharedBoonRecords, legendaryBoons, duoBoons };
}
