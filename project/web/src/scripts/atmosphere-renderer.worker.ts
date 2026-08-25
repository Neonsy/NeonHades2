import { createAtmosphereRenderer, type AtmospherePalette } from './atmosphere-renderer';

type InitMessage = {
    type: 'init';
    canvas: OffscreenCanvas;
    palette: AtmospherePalette;
    width: number;
    height: number;
    devicePixelRatio: number;
    reducedMotion: boolean;
};

type ResizeMessage = {
    type: 'resize';
    width: number;
    height: number;
    devicePixelRatio: number;
};

type ControlMessage = { type: 'start' | 'stop' | 'destroy' };
type AtmosphereMessage = InitMessage | ResizeMessage | ControlMessage;

let renderer: ReturnType<typeof createAtmosphereRenderer> | undefined;
let timer: ReturnType<typeof setTimeout> | undefined;
let elapsed = 0;
let previousFrame = 0;
const frameDuration = 1000 / 30;

const stop = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    previousFrame = 0;
};

const frame = () => {
    const now = performance.now();
    if (previousFrame > 0) elapsed += (now - previousFrame) / 1000;
    previousFrame = now;
    renderer?.render(elapsed);
    timer = setTimeout(frame, frameDuration);
};

const start = () => {
    if (timer !== undefined || !renderer) return;
    previousFrame = performance.now();
    timer = setTimeout(frame, frameDuration);
};

self.addEventListener('message', (event: MessageEvent<AtmosphereMessage>) => {
    const message = event.data;
    if (message.type === 'init') {
        renderer = createAtmosphereRenderer(message.canvas, message.palette);
        renderer.resize(message.width, message.height, message.devicePixelRatio);
        if (message.reducedMotion) {
            elapsed = 8.4;
            renderer.render(elapsed);
        } else {
            start();
        }
        return;
    }
    if (message.type === 'resize') {
        renderer?.resize(message.width, message.height, message.devicePixelRatio);
        renderer?.render(elapsed);
        return;
    }
    if (message.type === 'start') start();
    if (message.type === 'stop') stop();
    if (message.type === 'destroy') {
        stop();
        renderer?.destroy();
        renderer = undefined;
        self.close();
    }
});
