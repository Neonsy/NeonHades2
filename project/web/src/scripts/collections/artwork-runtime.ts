type ArtworkOffset = { x?: number; y?: number };
type ArtworkFit = {
    subjectScale: Readonly<Record<string, number>>;
    subjectOffset: Readonly<Record<string, ArtworkOffset>>;
};
type ArtworkMeasurement = {
    artwork: HTMLElement;
    height: number;
    left: number;
    top: number;
    width: number;
};

const supportsStoryCardMotion = window.matchMedia(
    '(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)'
);

const storySubjectScale: Readonly<Record<string, number>> = {
    zeus: 1.42,
    dora: 0.72,
    hermes: 1.38,
    icarus: 1.3,
    artemis: 1.34,
    athena: 1.2,
    echo: 0.9,
    selene: 1.9,
};

const storySubjectOffset: Readonly<Record<string, ArtworkOffset>> = {
    zeus: { x: 0.1 },
    hermes: { y: -0.065 },
    artemis: { y: -0.06 },
    selene: { x: 0.35 },
};

export const startCollectionArtwork = (root: ParentNode = document): (() => void) => {
    const cards = [...root.querySelectorAll<HTMLElement>('[data-visible-artwork]')];
    const storyCards = [...root.querySelectorAll<HTMLElement>('[data-story-card]')];
    if (cards.length === 0 && storyCards.length === 0) return () => undefined;

    const artworkFits = new Map<HTMLElement, ArtworkFit>();
    const pendingArtworkFits = new Set<HTMLElement>();
    const pendingVisibleArtwork = new Map<HTMLElement, ArtworkFit>();
    const imageLoadHandlers = new Map<HTMLImageElement, () => void>();
    const storyCardRemovers: Array<() => void> = [];
    let artworkFrame = 0;

    const flushArtworkFits = (): void => {
        artworkFrame = 0;
        const measurements = [...pendingArtworkFits].flatMap((artwork): ArtworkMeasurement[] => {
            const fit = artworkFits.get(artwork);
            pendingArtworkFits.delete(artwork);
            if (!fit) return [];

            const sourceWidth = Number(artwork.dataset.sourceWidth);
            const sourceHeight = Number(artwork.dataset.sourceHeight);
            const visibleX = Number(artwork.dataset.visibleX);
            const visibleY = Number(artwork.dataset.visibleY);
            const visibleWidth = Number(artwork.dataset.visibleWidth);
            const visibleHeight = Number(artwork.dataset.visibleHeight);
            const containerWidth = artwork.clientWidth;
            const containerHeight = artwork.clientHeight;
            if (
                !sourceWidth ||
                !sourceHeight ||
                !visibleWidth ||
                !visibleHeight ||
                !containerWidth ||
                !containerHeight
            ) {
                return [];
            }

            const baseScale = Math.min(
                Math.max((containerWidth * 0.92) / visibleWidth, (containerHeight * 0.86) / visibleHeight),
                (containerWidth * 1.18) / visibleWidth,
                (containerHeight * 1.08) / visibleHeight
            );
            const subject = artwork.dataset.subjectArtRaster ?? '';
            const scale = baseScale * (fit.subjectScale[subject] ?? 1);
            const offset = fit.subjectOffset[subject] ?? {};
            return [
                {
                    artwork,
                    width: sourceWidth * scale,
                    height: sourceHeight * scale,
                    left:
                        (containerWidth - visibleWidth * scale) / 2 -
                        visibleX * scale +
                        containerWidth * (offset.x ?? 0),
                    top: containerHeight - visibleHeight * scale - visibleY * scale + containerHeight * (offset.y ?? 0),
                },
            ];
        });

        measurements.forEach((measurement) => {
            measurement.artwork.style.setProperty('--story-art-width', `${measurement.width}px`);
            measurement.artwork.style.setProperty('--story-art-height', `${measurement.height}px`);
            measurement.artwork.style.setProperty('--story-art-left', `${measurement.left}px`);
            measurement.artwork.style.setProperty('--story-art-top', `${measurement.top}px`);
        });
    };

    const scheduleArtworkFit = (artwork: HTMLElement): void => {
        pendingArtworkFits.add(artwork);
        if (!artworkFrame) artworkFrame = window.requestAnimationFrame(flushArtworkFits);
    };

    const artworkResizeObserver = new ResizeObserver((entries) => {
        entries.forEach((entry) => scheduleArtworkFit(entry.target as HTMLElement));
    });

    const activateArtworkFit = (
        container: HTMLElement,
        subjectScale: Readonly<Record<string, number>> = {},
        subjectOffset: Readonly<Record<string, ArtworkOffset>> = {}
    ): void => {
        const artwork = container.querySelector<HTMLElement>('.subject-art[data-visible-width]');
        if (!artwork || artworkFits.has(artwork)) return;

        artworkFits.set(artwork, { subjectScale, subjectOffset });
        artworkResizeObserver.observe(artwork);
        artwork.querySelectorAll('img').forEach((image) => {
            if (image.complete) {
                scheduleArtworkFit(artwork);
                return;
            }
            const onLoad = (): void => scheduleArtworkFit(artwork);
            imageLoadHandlers.set(image, onLoad);
            image.addEventListener('load', onLoad, { once: true });
        });
    };

    const artworkVisibilityObserver = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                const container = entry.target as HTMLElement;
                const fit = pendingVisibleArtwork.get(container);
                if (!fit) return;
                artworkVisibilityObserver.unobserve(container);
                pendingVisibleArtwork.delete(container);
                activateArtworkFit(container, fit.subjectScale, fit.subjectOffset);
            });
        },
        { rootMargin: '20% 0px' }
    );

    const observeVisibleArtwork = (
        container: HTMLElement,
        subjectScale: Readonly<Record<string, number>> = {},
        subjectOffset: Readonly<Record<string, ArtworkOffset>> = {}
    ): void => {
        if (!container.querySelector('.subject-art[data-visible-width]')) return;
        pendingVisibleArtwork.set(container, { subjectScale, subjectOffset });
        artworkVisibilityObserver.observe(container);
    };

    cards.forEach((card) => observeVisibleArtwork(card));
    storyCards.forEach((card) => {
        observeVisibleArtwork(card, storySubjectScale, storySubjectOffset);

        const onPointerMove = (event: PointerEvent): void => {
            if (!supportsStoryCardMotion.matches) return;
            const bounds = card.getBoundingClientRect();
            const x = (event.clientX - bounds.left) / bounds.width - 0.5;
            const y = (event.clientY - bounds.top) / bounds.height - 0.5;
            card.style.setProperty('--story-card-tilt-x', `${(-y * 12).toFixed(2)}deg`);
            card.style.setProperty('--story-card-tilt-y', `${(x * 12).toFixed(2)}deg`);
        };
        const onPointerLeave = (): void => {
            card.style.removeProperty('--story-card-tilt-x');
            card.style.removeProperty('--story-card-tilt-y');
        };
        card.addEventListener('pointermove', onPointerMove);
        card.addEventListener('pointerleave', onPointerLeave);
        storyCardRemovers.push(() => {
            card.removeEventListener('pointermove', onPointerMove);
            card.removeEventListener('pointerleave', onPointerLeave);
            onPointerLeave();
        });
    });

    return () => {
        artworkVisibilityObserver.disconnect();
        artworkResizeObserver.disconnect();
        if (artworkFrame) window.cancelAnimationFrame(artworkFrame);
        imageLoadHandlers.forEach((onLoad, image) => image.removeEventListener('load', onLoad));
        storyCardRemovers.forEach((remove) => remove());
    };
};
