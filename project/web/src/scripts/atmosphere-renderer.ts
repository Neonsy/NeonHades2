export type AtmospherePalette = {
    primary: [number, number, number];
    secondary: [number, number, number];
    energy: number;
};

type RenderSurface = HTMLCanvasElement | OffscreenCanvas;

const vertexSource = `#version 300 es
    precision highp float;
    out vec2 vTextureCoord;

    void main(void) {
        vec2 position = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
        vTextureCoord = vec2(position.x, 1.0 - position.y);
        gl_Position = vec4(position * 2.0 - 1.0, 0.0, 1.0);
    }
`;

const fragmentSource = `#version 300 es
    precision highp float;
    in vec2 vTextureCoord;
    out vec4 finalColor;
    uniform sampler2D uTexture;
    uniform float uTime;
    uniform vec2 uResolution;
    uniform vec3 uPrimary;
    uniform vec3 uSecondary;
    uniform float uEnergy;
    float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }
    float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
    }
    float fbm(vec2 p) {
        float value = 0.0;
        float amplitude = 0.55;
        for (int i = 0; i < 5; i++) {
            value += amplitude * noise(p);
            p = mat2(1.68, 1.18, -1.18, 1.68) * p;
            amplitude *= 0.46;
        }
        return value;
    }
    void main(void) {
        vec2 uv = vTextureCoord;
        float aspect = uResolution.x / max(uResolution.y, 1.0);
        vec2 p = vec2((uv.x - 0.5) * aspect, uv.y - 0.5);
        float t = uTime * 0.045;
        float smokeA = fbm(p * 2.15 + vec2(t, -t * 0.72));
        float smokeB = fbm(p * 3.8 + vec2(-t * 0.58, t * 0.86));
        vec2 well = p - vec2(aspect * 0.27, 0.28);
        float cauldron = exp(-dot(well, well) * 5.2);
        float breath = 0.74 + 0.26 * sin(uTime * 0.72 + smokeB * 4.0);
        float veil = smoothstep(0.22, 0.92, smokeA) * (0.5 + smokeB * 0.5);
        vec3 color = mix(uSecondary, uPrimary, smoothstep(0.28, 0.78, smokeA + cauldron * 0.18));
        color += uPrimary * cauldron * breath * 0.52;
        float alpha = (0.075 + veil * 0.17 + cauldron * breath * 0.12) * uEnergy;
        finalColor = vec4(color * alpha, alpha);
    }
`;

const compileShader = (gl: WebGL2RenderingContext, type: number, source: string) => {
    const shader = gl.createShader(type);
    if (!shader) throw new Error('Unable to create atmosphere shader.');
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const message = gl.getShaderInfoLog(shader) ?? 'Unknown shader compile error.';
        gl.deleteShader(shader);
        throw new Error(message);
    }
    return shader;
};

const createProgram = (gl: WebGL2RenderingContext) => {
    const vertex = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
    const fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
    const program = gl.createProgram();
    if (!program) throw new Error('Unable to create atmosphere shader program.');
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        const message = gl.getProgramInfoLog(program) ?? 'Unknown shader link error.';
        gl.deleteProgram(program);
        throw new Error(message);
    }
    return program;
};

export const createAtmosphereRenderer = (canvas: RenderSurface, palette: AtmospherePalette) => {
    const gl = canvas.getContext('webgl2', {
        alpha: true,
        antialias: false,
        depth: false,
        desynchronized: true,
        powerPreference: 'low-power',
        premultipliedAlpha: true,
        preserveDrawingBuffer: false,
        stencil: false,
    }) as WebGL2RenderingContext | null;
    if (!gl) throw new Error('WebGL2 is unavailable.');

    const program = createProgram(gl);
    const vertexArray = gl.createVertexArray();
    if (!vertexArray) throw new Error('Unable to create atmosphere vertex array.');
    const uniforms = {
        time: gl.getUniformLocation(program, 'uTime'),
        resolution: gl.getUniformLocation(program, 'uResolution'),
        primary: gl.getUniformLocation(program, 'uPrimary'),
        secondary: gl.getUniformLocation(program, 'uSecondary'),
        energy: gl.getUniformLocation(program, 'uEnergy'),
    };
    let cssWidth = 1;
    let cssHeight = 1;

    gl.useProgram(program);
    gl.bindVertexArray(vertexArray);
    gl.uniform3fv(uniforms.primary, palette.primary);
    gl.uniform3fv(uniforms.secondary, palette.secondary);
    gl.uniform1f(uniforms.energy, palette.energy);

    const resize = (width: number, height: number, devicePixelRatio: number) => {
        cssWidth = Math.max(width, 1);
        cssHeight = Math.max(height, 1);
        // This is a soft background, not content: keep 4K screens within the same pixel budget.
        const renderScale = Math.min(
            Math.min(devicePixelRatio, 1.25) * 0.68,
            Math.sqrt((1280 * 720) / (cssWidth * cssHeight))
        );
        canvas.width = Math.max(Math.round(cssWidth * renderScale), 1);
        canvas.height = Math.max(Math.round(cssHeight * renderScale), 1);
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.uniform2f(uniforms.resolution, cssWidth, cssHeight);
    };

    const render = (time: number) => {
        gl.uniform1f(uniforms.time, time);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const destroy = () => {
        gl.bindVertexArray(null);
        gl.deleteVertexArray(vertexArray);
        gl.deleteProgram(program);
        gl.getExtension('WEBGL_lose_context')?.loseContext();
    };

    return { resize, render, destroy };
};

export type AtmosphereRenderer = ReturnType<typeof createAtmosphereRenderer>;
