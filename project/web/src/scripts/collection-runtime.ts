import { startCollectionArtwork } from './collections/artwork-runtime';
import { startCollectionFilter } from './collections/filter-runtime';
import { startCollectionRecordIndexes } from './collections/record-index-virtualizer';
import { startCollectionTableSort } from './collections/table-sort-runtime';
import { startDivineAccordions } from './exclusive-details-runtime';

type Cleanup = () => void;

const startIsolated = <T>(label: string, start: () => T, fallback: T): T => {
    try {
        return start();
    } catch (error) {
        console.error(`[NeonHades2] ${label} failed`, error);
        return fallback;
    }
};

export const startCollectionRuntime = (root: ParentNode = document): void => {
    const recordIndexes = startIsolated('collection record index', () => startCollectionRecordIndexes(root), []);
    const cleanups: Cleanup[] = [
        startIsolated(
            'collection artwork',
            () => startCollectionArtwork(root),
            () => undefined
        ),
        startIsolated(
            'collection filter',
            () => startCollectionFilter(root, recordIndexes),
            () => undefined
        ),
        startIsolated(
            'collection table sort',
            () => startCollectionTableSort(root),
            () => undefined
        ),
        startIsolated('divine accordions', startDivineAccordions, () => undefined),
    ];

    window.addEventListener(
        'pagehide',
        () => {
            cleanups.forEach((cleanup) => cleanup());
            recordIndexes.forEach((index) => index.disable());
        },
        { once: true }
    );
};
