import type { GuideChapter } from './guide';

export type GuideProgressCheck = {
    id: string;
    label: string;
    required: boolean;
};

const checkIdsByChapter: Record<string, readonly string[]> = {
    'before-the-first-night': ['start-first-night', 'use-core-actions', 'use-cast-safely', 'recognize-life-and-magick'],
    'the-first-night': ['finish-opening-night', 'understand-apollo-choice', 'return-with-permanent-progress'],
    'first-return': ['speak-to-everyone', 'check-cauldron-and-altar', 'fit-arcana-to-grasp', 'test-next-sequence'],
    'second-night': ['finish-second-night', 'reserve-first-moly', 'fund-sorceress', 'keep-staff-sequence'],
    'second-return': [
        'process-second-return-dialogue',
        'resolve-nights-craftwork',
        'resolve-crescent-pick',
        'name-next-material',
    ],
    'first-permanent-choices': ['activate-sorceress', 'fund-persistence', 'fund-grasp-plan', 'assign-rare-resources'],
    'productive-night-loop': ['explain-loadout', 'choose-room-reward', 'advance-permanent-target'],
    'tools-incantations-fated-list': [
        'activate-resource-detection',
        'unlock-gathering-tools',
        'open-broker-and-garden',
        'advance-fated-list',
        'understand-fish-selling',
    ],
    'guardian-preparation': ['identify-run-ending-encounter', 'change-one-cause', 'align-first-clear-loadout'],
    'first-clear-build': [
        'choose-primary-damage-move',
        'set-magick-policy',
        'protect-main-failure',
        'assign-keepsake-jobs',
        'remove-rare-boon-dependency',
    ],
    'first-route-clear': [
        'record-route-clear',
        'process-post-clear-talks',
        'review-new-objectives',
        'choose-next-route',
    ],
    'open-the-surface': ['open-surface', 'identify-surface-damage', 'resolve-fateful-bond', 'assign-route-purposes'],
    'gods-and-field-allies': [
        'resolve-olympian-gates',
        'locate-field-allies',
        'evaluate-encounter-aid',
        'pair-missing-encounter',
    ],
    'weapons-and-aspects': ['unlock-weapons', 'open-aspects', 'choose-nightmare-aspect', 'plan-each-weapon-family'],
    'complete-loadout': [
        'finish-arcana-plan',
        'set-keepsake-switches',
        'assign-familiar-and-hex',
        'keep-loadout-flexible',
    ],
    'advanced-boon-planning': [
        'separate-core-and-support',
        'understand-rare-prerequisites',
        'set-reroll-stop',
        'keep-fallback-build',
    ],
    'advance-both-routes': ['collect-gigaros', 'brew-disintegration', 'defeat-typhon'],
    'true-ending': ['reach-credits', 'record-true-ending', 'open-post-ending'],
    'rescue-the-fates': ['play-fates-epilogue', 'record-epilogue', 'claim-epilogue-prophecy'],
    'fear-testaments-nightmare': [
        'justify-fear',
        'match-testament-route',
        'assign-nightmare',
        'stabilize-high-fear-build',
    ],
    'trials-bounties-ranks': ['finish-pitch-black-trials', 'resolve-testaments', 'finish-finite-combat-systems'],
    'relationship-cleanup': [
        'resolve-relationship-gates',
        'assign-reserved-gifts',
        'pair-field-encounters',
        'stop-wasted-gifts',
    ],
    'fated-list-cleanup': ['resolve-prophecy-gates', 'group-discovery-runs', 'stop-blind-story-clears'],
    'exhaustive-completion': ['finish-finite-objectives', 'name-repeatable-activities', 'remove-unknown-blockers'],
};

export function getChapterProgressChecks(chapter: GuideChapter): GuideProgressCheck[] {
    const ids = checkIdsByChapter[chapter.id];
    if (!ids || ids.length !== chapter.exit.length) {
        throw new Error(`Guide chapter has no complete progress-check contract: ${chapter.id}`);
    }

    return chapter.exit.map((label, index) => ({
        id: `${chapter.id}/${ids[index]}`,
        label,
        required: true,
    }));
}

export function getAllProgressCheckIds(chapters: GuideChapter[]): string[] {
    const ids = chapters.flatMap((chapter) => getChapterProgressChecks(chapter).map((check) => check.id));
    if (new Set(ids).size !== ids.length) {
        throw new Error('Guide progress-check identifiers must be unique.');
    }
    return ids;
}
