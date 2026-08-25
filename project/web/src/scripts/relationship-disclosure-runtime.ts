const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

export const startRelationshipDisclosures = (): (() => void) => {
    const disclosures = [...document.querySelectorAll<HTMLDetailsElement>('.relationship-disclosure')];
    if (disclosures.length === 0) return () => undefined;

    const animations = new Map<HTMLDetailsElement, Animation>();
    const intendedStates = new Map<HTMLDetailsElement, boolean>();
    const removers: Array<() => void> = [];

    const settle = (disclosure: HTMLDetailsElement, shouldOpen: boolean): void => {
        const panel = disclosure.querySelector<HTMLElement>(':scope > .relationship-disclosure__panel');
        animations.get(disclosure)?.cancel();
        animations.delete(disclosure);
        intendedStates.set(disclosure, shouldOpen);
        disclosure.open = shouldOpen;
        panel?.style.removeProperty('overflow');
    };

    const setOpen = async (disclosure: HTMLDetailsElement, shouldOpen: boolean): Promise<void> => {
        const panel = disclosure.querySelector<HTMLElement>(':scope > .relationship-disclosure__panel');
        if (!panel) {
            settle(disclosure, shouldOpen);
            return;
        }

        const intendedOpen = intendedStates.get(disclosure) ?? disclosure.open;
        if (intendedOpen === shouldOpen && !animations.has(disclosure)) return;

        const wasRendered = disclosure.open;
        const startHeight = wasRendered ? panel.getBoundingClientRect().height : 0;
        const startOpacity = wasRendered ? Number.parseFloat(getComputedStyle(panel).opacity) : 0;
        animations.get(disclosure)?.cancel();
        animations.delete(disclosure);
        intendedStates.set(disclosure, shouldOpen);

        if (shouldOpen) disclosure.open = true;
        if (reduceMotion.matches) {
            settle(disclosure, shouldOpen);
            return;
        }

        panel.style.overflow = 'clip';
        const animation = panel.animate(
            [
                { height: `${startHeight}px`, opacity: startOpacity },
                { height: `${shouldOpen ? panel.scrollHeight : 0}px`, opacity: shouldOpen ? 1 : 0 },
            ],
            {
                duration: shouldOpen ? 280 : 190,
                easing: shouldOpen ? 'cubic-bezier(0.16, 1, 0.3, 1)' : 'cubic-bezier(0.4, 0, 1, 1)',
                fill: 'both',
            }
        );
        animations.set(disclosure, animation);

        await animation.finished
            .then(() => {
                if (animations.get(disclosure) !== animation) return;
                settle(disclosure, shouldOpen);
            })
            .catch(() => undefined);
    };

    disclosures.forEach((disclosure) => {
        intendedStates.set(disclosure, disclosure.open);
        const summary = disclosure.querySelector<HTMLElement>(':scope > summary');
        const toggle = (): void => void setOpen(disclosure, !(intendedStates.get(disclosure) ?? disclosure.open));
        const onClick = (event: MouseEvent): void => {
            event.preventDefault();
            toggle();
        };
        const onKeyDown = (event: KeyboardEvent): void => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            toggle();
        };
        summary?.addEventListener('click', onClick);
        summary?.addEventListener('keydown', onKeyDown);
        removers.push(() => {
            summary?.removeEventListener('click', onClick);
            summary?.removeEventListener('keydown', onKeyDown);
        });
    });

    const cleanup = (): void => {
        removers.forEach((remove) => remove());
        intendedStates.forEach((shouldOpen, disclosure) => settle(disclosure, shouldOpen));
    };
    window.addEventListener('pagehide', cleanup, { once: true });
    return cleanup;
};
