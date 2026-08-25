const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const compactViewport = window.matchMedia('(max-width: 760px)');

export const startGuideMapRuntime = (): void => {
    if (reduceMotion.matches || compactViewport.matches) return;

    const milestones = [...document.querySelectorAll<HTMLElement>('.guide-map-milestone')];
    if (milestones.length === 0) return;

    const observer = new IntersectionObserver(
        (entries) => {
            for (const entry of entries) {
                if (!entry.isIntersecting) continue;
                const milestone = entry.target as HTMLElement;
                observer.unobserve(milestone);
                milestone.animate(
                    [
                        { opacity: 0.94, translate: '0 6px' },
                        { opacity: 1, translate: 'none' },
                    ],
                    {
                        duration: 260,
                        easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
                    }
                );
            }
        },
        { rootMargin: '0px 0px -8% 0px' }
    );

    milestones.forEach((milestone) => observer.observe(milestone));
    window.addEventListener('pagehide', () => observer.disconnect(), { once: true });
};
