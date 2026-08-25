import { persistentAtom } from '@nanostores/persistent';
import { atom } from 'nanostores';

export const GUIDE_PROGRESS_STORAGE_KEY = 'neodes2-guide-progress';
export const GUIDE_PROGRESS_REVISION = 'guide-2026-08-29-state-sequence';

export type GuideProgressData = {
    schemaVersion: 1;
    contentRevision: string;
    completedChecks: Record<string, true>;
    lastVisitedChapterId: string | null;
};

type GuideProgressStorage = { kind: 'ready'; data: GuideProgressData } | { kind: 'invalid'; raw: string };

const initialData = (): GuideProgressData => ({
    schemaVersion: 1,
    contentRevision: GUIDE_PROGRESS_REVISION,
    completedChecks: {},
    lastVisitedChapterId: null,
});

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function decodeProgress(raw: string): GuideProgressStorage {
    try {
        const candidate: unknown = JSON.parse(raw);
        if (!isRecord(candidate) || candidate.schemaVersion !== 1 || !isRecord(candidate.completedChecks)) {
            return { kind: 'invalid', raw };
        }

        const completedChecks = Object.entries(candidate.completedChecks).reduce<Record<string, true>>(
            (checks, [id, complete]) => {
                if (complete === true) checks[id] = true;
                return checks;
            },
            {}
        );
        const lastVisitedChapterId =
            typeof candidate.lastVisitedChapterId === 'string' ? candidate.lastVisitedChapterId : null;

        return {
            kind: 'ready',
            data: {
                schemaVersion: 1,
                contentRevision:
                    typeof candidate.contentRevision === 'string' ? candidate.contentRevision : GUIDE_PROGRESS_REVISION,
                completedChecks,
                lastVisitedChapterId,
            },
        };
    } catch {
        return { kind: 'invalid', raw };
    }
}

function encodeProgress(value: GuideProgressStorage): string {
    return value.kind === 'invalid' ? value.raw : JSON.stringify(value.data);
}

export const $guideProgress = persistentAtom<GuideProgressStorage>(
    GUIDE_PROGRESS_STORAGE_KEY,
    { kind: 'ready', data: initialData() },
    { decode: decodeProgress, encode: encodeProgress }
);

export const $guideProgressIssue = atom(false);

export function readGuideProgress(): GuideProgressData | null {
    const value = $guideProgress.get();
    $guideProgressIssue.set(value.kind === 'invalid');
    return value.kind === 'ready' ? value.data : null;
}

export function setGuideCheck(id: string, complete: boolean): void {
    const current = readGuideProgress();
    if (!current) return;

    const completedChecks = { ...current.completedChecks };
    if (complete) completedChecks[id] = true;
    else {
        const { [id]: removedCheck, ...remainingChecks } = completedChecks;
        void removedCheck;
        $guideProgress.set({
            kind: 'ready',
            data: { ...current, contentRevision: GUIDE_PROGRESS_REVISION, completedChecks: remainingChecks },
        });
        return;
    }

    $guideProgress.set({
        kind: 'ready',
        data: { ...current, contentRevision: GUIDE_PROGRESS_REVISION, completedChecks },
    });
}

export function setLastVisitedChapter(id: string): void {
    const current = readGuideProgress();
    if (!current || current.lastVisitedChapterId === id) return;
    $guideProgress.set({ kind: 'ready', data: { ...current, lastVisitedChapterId: id } });
}

export function resetGuideProgress(): void {
    $guideProgress.set({ kind: 'ready', data: initialData() });
    $guideProgressIssue.set(false);
}
