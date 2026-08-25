import {
    captureInitialFragment,
    fragmentTarget,
    queueFragmentScroll,
    restoreInitialFragment,
} from './view-fragment-navigation';

type ExclusiveDetailsOptions = {
    groupSelector: string;
    itemMatchSelector: string;
    itemSelector: string;
    panelSelector: string;
};

type ExclusiveDetailsController = {
    cleanup: () => void;
    reveal: (hash: string, animate?: boolean) => void;
};

type DetailState = {
    intendedOpen: boolean;
    panel: HTMLElement | null;
};

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const keepViewportAnchorInPlace = async (
    anchor: HTMLElement,
    action: () => Promise<void>,
    isCurrent: () => boolean
): Promise<void> => {
    const anchorTop = anchor.getBoundingClientRect().top;
    let frame: number;
    let active = true;

    const correctPosition = (): void => {
        if (!active || !isCurrent()) return;
        const delta = anchor.getBoundingClientRect().top - anchorTop;
        if (Math.abs(delta) > 0.5) window.scrollTo({ top: window.scrollY + delta, behavior: 'instant' });
        frame = window.requestAnimationFrame(correctPosition);
    };

    frame = window.requestAnimationFrame(correctPosition);
    try {
        await action();
    } finally {
        active = false;
        window.cancelAnimationFrame(frame);
        if (isCurrent()) {
            const delta = anchor.getBoundingClientRect().top - anchorTop;
            if (Math.abs(delta) > 0.5) window.scrollTo({ top: window.scrollY + delta, behavior: 'instant' });
        }
    }
};

const startExclusiveDetails = (options: ExclusiveDetailsOptions): ExclusiveDetailsController => {
    const groups = [...document.querySelectorAll<HTMLElement>(options.groupSelector)];
    if (groups.length === 0) return { cleanup: () => undefined, reveal: () => undefined };

    const states = new Map<HTMLDetailsElement, DetailState>();
    const animations = new Map<HTMLDetailsElement, Animation>();
    const groupRequests = new Map<HTMLElement, number>();
    const removers: Array<() => void> = [];

    const settle = (detail: HTMLDetailsElement, shouldOpen: boolean): void => {
        const state = states.get(detail);
        animations.get(detail)?.cancel();
        animations.delete(detail);
        if (state) state.intendedOpen = shouldOpen;
        detail.dataset.disclosureState = shouldOpen ? 'open' : 'closed';
        detail.open = shouldOpen;
        state?.panel?.style.removeProperty('overflow');
    };

    const setOpen = async (detail: HTMLDetailsElement, shouldOpen: boolean, animate = true): Promise<void> => {
        const state = states.get(detail);
        if (!state || !state.panel) {
            settle(detail, shouldOpen);
            return;
        }
        if (state.intendedOpen === shouldOpen && detail.open === shouldOpen && !animations.has(detail)) return;

        const { panel } = state;
        const wasRendered = detail.open;
        const startHeight = wasRendered ? panel.getBoundingClientRect().height : 0;
        const startOpacity = wasRendered ? Number.parseFloat(getComputedStyle(panel).opacity) : 0;
        animations.get(detail)?.cancel();
        animations.delete(detail);
        state.intendedOpen = shouldOpen;
        detail.dataset.disclosureState = shouldOpen ? 'open' : 'closed';

        if (shouldOpen) detail.open = true;
        if (!animate || reduceMotion.matches) {
            settle(detail, shouldOpen);
            return;
        }

        panel.style.overflow = 'clip';
        const animation = panel.animate(
            [
                { height: `${startHeight}px`, opacity: startOpacity },
                { height: `${shouldOpen ? panel.getBoundingClientRect().height : 0}px`, opacity: shouldOpen ? 1 : 0 },
            ],
            {
                duration: shouldOpen ? 280 : 190,
                easing: shouldOpen ? 'cubic-bezier(0.16, 1, 0.3, 1)' : 'cubic-bezier(0.4, 0, 1, 1)',
                fill: 'both',
            }
        );
        animations.set(detail, animation);

        await animation.finished
            .then(() => {
                if (animations.get(detail) !== animation) return;
                animations.delete(detail);
                detail.open = shouldOpen;
                animation.cancel();
                panel.style.removeProperty('overflow');
            })
            .catch(() => undefined);
    };

    const openExclusively = async (
        detail: HTMLDetailsElement,
        animate = true,
        preserveAnchor = true
    ): Promise<void> => {
        const group = detail.closest<HTMLElement>(options.groupSelector);
        if (!group) {
            await setOpen(detail, true, animate);
            return;
        }

        const request = (groupRequests.get(group) ?? 0) + 1;
        groupRequests.set(group, request);
        const state = states.get(detail);
        if (state) state.intendedOpen = true;
        const isCurrent = (): boolean => groupRequests.get(group) === request;
        const siblings = [...group.querySelectorAll<HTMLDetailsElement>(options.itemSelector)].filter(
            (sibling) => sibling !== detail && (sibling.open || states.get(sibling)?.intendedOpen)
        );
        const transition = async (): Promise<void> => {
            await Promise.all(siblings.map((sibling) => setOpen(sibling, false, animate)));
            if (isCurrent()) await setOpen(detail, true, animate);
        };
        const anchor = detail.querySelector<HTMLElement>(':scope > summary');
        if (animate && preserveAnchor && siblings.length > 0 && anchor)
            await keepViewportAnchorInPlace(anchor, transition, isCurrent);
        else await transition();
        if (groupRequests.get(group) !== request) return;
    };

    groups.forEach((group) => {
        group.querySelectorAll<HTMLDetailsElement>(options.itemSelector).forEach((detail) => {
            const panel = detail.querySelector<HTMLElement>(options.panelSelector);
            states.set(detail, { intendedOpen: detail.open, panel });
            detail.dataset.accordionReady = '';
            detail.dataset.disclosureState = detail.open ? 'open' : 'closed';

            const summary = detail.querySelector<HTMLElement>(':scope > summary');
            const onClick = (event: MouseEvent): void => {
                event.preventDefault();
                const shouldOpen = !(states.get(detail)?.intendedOpen ?? detail.open);
                if (shouldOpen) void openExclusively(detail);
                else {
                    groupRequests.set(group, (groupRequests.get(group) ?? 0) + 1);
                    void setOpen(detail, false);
                }
            };
            summary?.addEventListener('click', onClick);
            removers.push(() => summary?.removeEventListener('click', onClick));
        });
    });

    const reveal = (hash: string, animate = true): void => {
        const detail = fragmentTarget(hash)?.closest<HTMLDetailsElement>(options.itemMatchSelector);
        if (detail) void openExclusively(detail, animate, false);
    };
    const cleanup = (): void => {
        removers.forEach((remove) => remove());
        states.forEach(({ intendedOpen }, detail) => settle(detail, intendedOpen));
    };
    return { cleanup, reveal };
};

const cleanUpOnPageHide = (cleanup: () => void): (() => void) => {
    window.addEventListener('pagehide', cleanup, { once: true });
    return cleanup;
};

export const startTierAccordions = (): ExclusiveDetailsController => {
    const controller = startExclusiveDetails({
        groupSelector: '.tier-bands',
        itemMatchSelector: '.tier-band',
        itemSelector: ':scope > .tier-band',
        panelSelector: ':scope > .tier-band-panel',
    });
    cleanUpOnPageHide(controller.cleanup);
    return controller;
};

export const startDivineAccordions = (): (() => void) => {
    if (!document.querySelector('.divine-houses')) return () => undefined;
    const initialFragment =
        !window.location.hash || fragmentTarget(window.location.hash)?.closest('[data-record-group]')
            ? captureInitialFragment()
            : '';
    const controller = startExclusiveDetails({
        groupSelector: '.divine-houses',
        itemMatchSelector: '[data-record-group]',
        itemSelector: ':scope > [data-record-group]',
        panelSelector: ':scope > .record-index',
    });
    controller.reveal(initialFragment, false);
    restoreInitialFragment(initialFragment);
    const links = [...document.querySelectorAll<HTMLAnchorElement>('.divine-index a')];
    const onJump = (event: MouseEvent): void => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        const link = event.currentTarget as HTMLAnchorElement;
        event.preventDefault();
        if (link.hash !== window.location.hash) history.pushState(null, '', link.href);
        queueFragmentScroll(link.hash);
    };
    const onHashChange = (): void => {
        if (fragmentTarget(window.location.hash)?.closest('[data-record-group]')) queueFragmentScroll();
    };
    links.forEach((link) => link.addEventListener('click', onJump));
    window.addEventListener('hashchange', onHashChange);
    return cleanUpOnPageHide(() => {
        controller.cleanup();
        links.forEach((link) => link.removeEventListener('click', onJump));
        window.removeEventListener('hashchange', onHashChange);
    });
};
