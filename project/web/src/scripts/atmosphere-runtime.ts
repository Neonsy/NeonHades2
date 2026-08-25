import type { AtmosphereRenderer } from './atmosphere-renderer';

type RGB = [number, number, number];
type WorldPalette = {
    primary: RGB;
    secondary: RGB;
    energy: number;
};

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const compactViewport = window.matchMedia('(max-width: 760px)');

const palettes: Record<string, WorldPalette> = {
    home: { primary: [0.13, 0.72, 0.65], secondary: [0.48, 0.3, 0.82], energy: 0.94 },
    guide: { primary: [0.12, 0.61, 0.56], secondary: [0.34, 0.24, 0.72], energy: 0.76 },
    knowledge: { primary: [0.46, 0.32, 0.86], secondary: [0.1, 0.59, 0.54], energy: 0.78 },
    collection: { primary: [0.09, 0.56, 0.49], secondary: [0.22, 0.31, 0.72], energy: 0.74 },
    record: { primary: [0.27, 0.22, 0.66], secondary: [0.13, 0.53, 0.48], energy: 0.68 },
    builds: { primary: [0.72, 0.39, 0.12], secondary: [0.1, 0.55, 0.49], energy: 0.82 },
    'build-detail': { primary: [0.62, 0.31, 0.1], secondary: [0.28, 0.22, 0.72], energy: 0.78 },
    tiers: { primary: [0.73, 0.4, 0.12], secondary: [0.39, 0.24, 0.78], energy: 0.8 },
};

export const startAtmosphereRuntime = async (): Promise<void> => {
    const atmosphere = document.querySelector<HTMLElement>('[data-world-atmosphere]');
    if (!atmosphere) return;
    const updateAmbientVisibility = (): void => {
        atmosphere.toggleAttribute('data-paused', document.hidden);
    };
    updateAmbientVisibility();
    document.addEventListener('visibilitychange', updateAmbientVisibility);
    window.addEventListener(
        'pagehide',
        () => document.removeEventListener('visibilitychange', updateAmbientVisibility),
        { once: true }
    );
    const host = document.querySelector<HTMLElement>('[data-world-shader]');
    const connection = navigator as Navigator & { connection?: { saveData?: boolean } };
    const supportsAtmosphere =
        !compactViewport.matches &&
        window.matchMedia('(min-width: 1100px)').matches &&
        navigator.hardwareConcurrency >= 8 &&
        !connection.connection?.saveData;
    if (!host || !supportsAtmosphere) return;

    const surface = host.dataset.worldShader ?? document.body.dataset.surface?.split(' ')[0] ?? 'knowledge';
    const palette = palettes[surface] ?? palettes.knowledge;
    const canvas = document.createElement('canvas');
    canvas.dataset.worldShaderCanvas = surface;
    host.appendChild(canvas);

    let worker: Worker | undefined;
    let renderer: AtmosphereRenderer | undefined;
    let animationFrame = 0;
    let elapsed = 0;
    let previousFrame = 0;
    const frameDuration = 1000 / 30;

    const resize = (): void => {
        const width = Math.max(host.clientWidth, 1);
        const height = Math.max(host.clientHeight, 1);
        if (worker) {
            worker.postMessage({ type: 'resize', width, height, devicePixelRatio: window.devicePixelRatio });
        } else {
            renderer?.resize(width, height, window.devicePixelRatio);
            renderer?.render(elapsed);
        }
    };

    const frame = (now: number): void => {
        if (previousFrame === 0) previousFrame = now;
        if (now - previousFrame >= frameDuration) {
            elapsed += (now - previousFrame) / 1000;
            previousFrame = now;
            renderer?.render(elapsed);
        }
        animationFrame = window.requestAnimationFrame(frame);
    };

    const start = (): void => {
        if (worker) {
            worker.postMessage({ type: 'start' });
        } else if (!animationFrame && renderer) {
            previousFrame = 0;
            animationFrame = window.requestAnimationFrame(frame);
        }
    };
    const stop = (): void => {
        if (worker) worker.postMessage({ type: 'stop' });
        if (animationFrame) window.cancelAnimationFrame(animationFrame);
        animationFrame = 0;
        previousFrame = 0;
    };

    const supportsWorkerRenderer = 'transferControlToOffscreen' in canvas && 'Worker' in window;
    if (supportsWorkerRenderer) {
        const offscreenCanvas = canvas.transferControlToOffscreen();
        worker = new Worker(new URL('./atmosphere-renderer.worker.ts', import.meta.url), { type: 'module' });
        worker.postMessage(
            {
                type: 'init',
                canvas: offscreenCanvas,
                palette,
                width: Math.max(host.clientWidth, 1),
                height: Math.max(host.clientHeight, 1),
                devicePixelRatio: window.devicePixelRatio,
                reducedMotion: reduceMotion.matches,
            },
            [offscreenCanvas]
        );
    } else {
        const { createAtmosphereRenderer } = await import('./atmosphere-renderer');
        renderer = createAtmosphereRenderer(canvas, palette);
        renderer.resize(Math.max(host.clientWidth, 1), Math.max(host.clientHeight, 1), window.devicePixelRatio);
        if (reduceMotion.matches) {
            elapsed = 8.4;
            renderer.render(elapsed);
        } else {
            start();
        }
    }

    window.addEventListener('resize', resize, { passive: true });
    const updatePlayback = (): void => {
        if (document.hidden || reduceMotion.matches) stop();
        else start();
    };
    document.addEventListener('visibilitychange', updatePlayback);
    reduceMotion.addEventListener('change', updatePlayback);
    updatePlayback();
    window.addEventListener(
        'pagehide',
        () => {
            document.removeEventListener('visibilitychange', updatePlayback);
            reduceMotion.removeEventListener('change', updatePlayback);
            stop();
            window.removeEventListener('resize', resize);
            worker?.postMessage({ type: 'destroy' });
            worker?.terminate();
            renderer?.destroy();
            canvas.remove();
        },
        { once: true }
    );
};
