const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const compactViewport = window.matchMedia('(max-width: 760px)');

export const startBuildIndexRuntime = (): void => {
    if (reduceMotion.matches || compactViewport.matches) return;

    const lines = [...document.querySelectorAll<HTMLElement>('.weapon-line')];
    if (lines.length === 0) return;

    const observer = new IntersectionObserver(
        (entries) => {
            for (const entry of entries) {
                if (!entry.isIntersecting) continue;
                const line = entry.target as HTMLElement;
                observer.unobserve(line);
                line.animate(
                    [
                        { opacity: 0.95, translate: '0 6px' },
                        { opacity: 1, translate: 'none' },
                    ],
                    {
                        duration: 240,
                        easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
                    }
                );
            }
        },
        { rootMargin: '0px 0px -8% 0px' }
    );

    lines.forEach((line) => observer.observe(line));
    window.addEventListener('pagehide', () => observer.disconnect(), { once: true });
};
