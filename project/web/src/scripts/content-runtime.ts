import { startBalancedGridLayout } from './balanced-grid';

const overflowFocusSelector = '.build-jump a, .tier-jump a, .resource-jump-nav a';

const startOverflowFocus = (): (() => void) => {
    if (!document.querySelector(overflowFocusSelector)) return () => undefined;

    const revealFocusedLink = (event: FocusEvent): void => {
        const link = event.target instanceof Element ? event.target.closest<HTMLElement>(overflowFocusSelector) : null;
        link?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' });
    };

    document.addEventListener('focusin', revealFocusedLink);
    return () => document.removeEventListener('focusin', revealFocusedLink);
};

const startIsolated = (label: string, start: () => void): void => {
    try {
        start();
    } catch (error) {
        console.error(`[NeonHades2] ${label} failed`, error);
    }
};

export const startContentRuntime = (): void => {
    let stopOverflowFocus = (): void => undefined;
    try {
        stopOverflowFocus = startOverflowFocus();
    } catch (error) {
        console.error('[NeonHades2] overflow focus failed', error);
    }
    startIsolated('balanced grid layout', startBalancedGridLayout);

    window.addEventListener('pagehide', stopOverflowFocus, { once: true });
};
