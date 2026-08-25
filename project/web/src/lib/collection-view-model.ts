import { collectionGuides, collectionSlug } from '../content/knowledge';
import { getPublication, getRecordName, recordHref, type PublicationPage, type PublicationRecord } from './publication';
import { buildBoonCollectionModel } from './collection-view-model/boons';
import { buildResourceCollectionModel } from './collection-view-model/resources';
import { buildStoryCollectionModel } from './collection-view-model/story';

export function buildCollectionViewModel(page: PublicationPage, records: PublicationRecord[]) {
    const publication = getPublication();
    const slug = collectionSlug(page);
    const guide = collectionGuides[slug];
    if (!guide) throw new Error(`Knowledge collection has no reader-facing guide: ${slug}`);

    const sortedRecords = [...records].sort((a, b) => getRecordName(a).localeCompare(getRecordName(b)));
    const collectionHref = `/knowledge/${slug}/`;
    const indexedRecords = sortedRecords.filter(
        (record) =>
            record.public?.presentation === 'detail' &&
            recordHref(record) !== collectionHref &&
            (slug !== 'resources' || record.recordType === 'mechanics/resource')
    );
    const weaponRecords =
        slug === 'weapons' ? sortedRecords.filter((record) => record.recordType === 'mechanics/weapon') : [];

    return {
        publication,
        slug,
        guide,
        collectionHref,
        indexedRecords,
        virtualizeIndex: indexedRecords.length >= 40,
        weaponRecords,
        ...buildStoryCollectionModel(slug, collectionHref, sortedRecords, publication.records),
        ...buildBoonCollectionModel(slug, sortedRecords),
        ...buildResourceCollectionModel(slug, publication.records),
    };
}

export type CollectionViewModel = ReturnType<typeof buildCollectionViewModel>;
