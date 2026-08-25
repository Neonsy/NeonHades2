let pendingCancel: (() => void) | undefined;
let initialInlineScrollBehavior: string | null = null;
const initialScrollRestoration = history.scrollRestoration;

const fragmentId = (hash: string): string => {
    const encodedId = hash.startsWith('#') ? hash.slice(1) : hash;
    if (!encodedId) return '';

    try {
        return decodeURIComponent(encodedId);
    } catch {
        return encodedId;
    }
};

export const fragmentTarget = (hash: string): HTMLElement | null => document.getElementById(fragmentId(hash));

export const cancelFragmentScroll = (): void => pendingCancel?.();

export const captureInitialFragment = (): string => {
    history.scrollRestoration = 'manual';
    const hash = window.location.hash;
    if (!hash) return '';

    initialInlineScrollBehavior = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = 'auto';

    const url = new URL(window.location.href);
    url.hash = '';
    history.replaceState(history.state, '', url);
    return hash;
};

export const queueFragmentScroll = (hash = window.location.hash, afterScroll?: (scrolled: boolean) => void): void => {
    cancelFragmentScroll();
    let frame = 0;
    let cancelled = false;
    let scrolled = false;
    const inputEvents = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const;
    const complete = (): void => {
        cancelled = true;
        window.cancelAnimationFrame(frame);
        inputEvents.forEach((event) => window.removeEventListener(event, complete, true));
        if (pendingCancel === complete) pendingCancel = undefined;
        afterScroll?.(scrolled);
    };
    pendingCancel = complete;
    const id = fragmentId(hash);
    if (!id || !document.getElementById(id)) {
        complete();
        return;
    }

    inputEvents.forEach((event) => window.addEventListener(event, complete, { capture: true, passive: true }));
    window.scrollTo({ top: window.scrollY, behavior: 'instant' });
    let deadline: number | undefined;
    let previousLayout = '';
    let stableFrames = 0;
    document.dispatchEvent(new Event('balanced-grid:change'));

    const settle = (): void => {
        if (cancelled) return;

        const target = document.getElementById(id);
        if (!target || target.getClientRects().length === 0) {
            complete();
            return;
        }
        const pageReady = initialInlineScrollBehavior === null || document.readyState === 'complete';
        if (pageReady) deadline ??= performance.now() + 3000;

        const visibleGrids = [...document.querySelectorAll<HTMLElement>('[data-balanced-grid]')].filter(
            (grid) => grid.getClientRects().length > 0 && grid.getBoundingClientRect().width > 0
        );
        const gridsReady = visibleGrids.every(
            (grid) =>
                grid.hasAttribute('data-balanced-grid-columns') ||
                ![...grid.children].some((child) => child instanceof HTMLElement && child.getClientRects().length > 0)
        );
        const fontsReady = !document.fonts || document.fonts.status === 'loaded';
        const movingContent = document.getAnimations().some((animation) => {
            const element = animation.effect instanceof KeyframeEffect ? animation.effect.target : null;
            return (
                element instanceof Element &&
                element.closest('main') &&
                animation.playState === 'running' &&
                animation.effect?.getTiming().iterations !== Infinity
            );
        });
        const targetTop = target.getBoundingClientRect().top + window.scrollY;
        const layout = `${targetTop.toFixed(2)}:${document.documentElement.scrollHeight}`;
        stableFrames = gridsReady && fontsReady && !movingContent && layout === previousLayout ? stableFrames + 1 : 0;
        previousLayout = layout;

        if (pageReady && (stableFrames >= 3 || (deadline !== undefined && performance.now() >= deadline))) {
            const headerHeight = document.querySelector<HTMLElement>('.world-header')?.offsetHeight ?? 0;
            const inset = Math.max(Number.parseFloat(getComputedStyle(target).scrollMarginTop) || 0, headerHeight + 16);
            const instant =
                initialInlineScrollBehavior !== null || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            window.scrollTo({ top: targetTop - inset, behavior: instant ? 'instant' : 'smooth' });
            scrolled = true;
            complete();
            return;
        }
        frame = window.requestAnimationFrame(settle);
    };

    frame = window.requestAnimationFrame(settle);
};

window.addEventListener('pagehide', () => {
    cancelFragmentScroll();
    history.scrollRestoration = initialScrollRestoration;
});

export const restoreInitialFragment = (hash: string): void => {
    if (!hash) return;

    queueFragmentScroll(hash, (scrolled) => {
        if (scrolled) {
            const url = new URL(window.location.href);
            url.hash = hash;
            history.replaceState(history.state, '', url);
        }
        window.requestAnimationFrame(() => {
            if (initialInlineScrollBehavior !== null) {
                document.documentElement.style.scrollBehavior = initialInlineScrollBehavior;
                initialInlineScrollBehavior = null;
            }
        });
    });
};
