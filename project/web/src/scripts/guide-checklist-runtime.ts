import {
    $guideProgress,
    readGuideProgress,
    resetGuideProgress,
    setGuideCheck,
    setLastVisitedChapter,
} from '../lib/guide-progress-store';

export const startGuideChecklist = (root: HTMLElement): (() => void) => {
    const warning = root.querySelector<HTMLElement>('[data-progress-warning]');
    const inputs = [...root.querySelectorAll<HTMLInputElement>('[data-progress-check]')];
    const completeCount = root.querySelector<HTMLElement>('[data-complete-count]');
    const chapterId = root.dataset.chapterId;

    const render = (): void => {
        const progress = readGuideProgress();
        const invalid = progress === null;
        if (warning) warning.hidden = !invalid;
        inputs.forEach((input) => {
            input.disabled = invalid;
            input.checked = progress?.completedChecks[input.dataset.progressCheck ?? ''] === true;
        });
        if (completeCount) completeCount.textContent = String(inputs.filter((input) => input.checked).length);
    };

    const inputRemovers = inputs.map((input) => {
        const onChange = (): void => {
            const id = input.dataset.progressCheck;
            if (id) setGuideCheck(id, input.checked);
        };
        input.addEventListener('change', onChange);
        return () => input.removeEventListener('change', onChange);
    });

    const reset = root.querySelector<HTMLButtonElement>('[data-reset-progress]');
    reset?.addEventListener('click', resetGuideProgress);
    if (chapterId) setLastVisitedChapter(chapterId);
    const stopSubscription = $guideProgress.subscribe(render);

    return () => {
        inputRemovers.forEach((remove) => remove());
        reset?.removeEventListener('click', resetGuideProgress);
        stopSubscription();
    };
};
