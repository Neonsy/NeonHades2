import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const outputRoot = path.join(projectRoot, 'dist');
const expectedRouteStyles = {
    home: { primary: 'pages/home.css', responsive: null },
    guide: { primary: 'theatre-pages/01-guide.css', responsive: null },
    knowledge: { primary: 'theatre-pages/02-knowledge.css', responsive: null },
    collection: { primary: 'theatre-pages/03-collections.css', responsive: '09-collection-responsive.css' },
    record: { primary: 'theatre-pages/05-records.css', responsive: '09-record-responsive.css' },
    builds: { primary: 'theatre-pages/06-builds.css', responsive: '09-builds-responsive.css' },
    'build-detail': { primary: 'theatre-pages/06-builds.css', responsive: '09-build-detail-responsive.css' },
    tiers: { primary: 'theatre-pages/07-tiers.css', responsive: '09-tiers-responsive.css' },
};
const routeStylesheetBudgets = {
    home: 60_000,
    guide: 115_000,
    knowledge: 75_000,
    collection: 125_000,
    record: 95_000,
    builds: 75_000,
    'build-detail': 136_000,
    tiers: 105_000,
};
const failures = [];
const htmlFiles = [];

const collectHtml = async (directory) => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
        const entryPath = path.join(directory, entry.name);
        if (entry.isDirectory()) await collectHtml(entryPath);
        else if (entry.name.endsWith('.html')) htmlFiles.push(entryPath);
    }
};

await collectHtml(outputRoot);

const routeAssetBySurface = new Map();
for (const htmlPath of htmlFiles) {
    const html = await readFile(htmlPath, 'utf8');
    const surface = html.match(/<body\b[^>]*\bdata-surface=(['"])(.*?)\1/iu)?.[2];
    const stylesheets = [...html.matchAll(/<link\b[^>]*\brel=(['"])stylesheet\1[^>]*\bhref=(['"])(.*?)\2/giu)].map(
        (match) => match[3]
    );

    if (!surface || !(surface in expectedRouteStyles)) {
        failures.push(`${path.relative(outputRoot, htmlPath)} has an unknown or missing surface.`);
        continue;
    }
    if (!/\bclass=(['"])[^'"]*\bph\b[^'"]*\1/iu.test(html)) {
        failures.push(
            `${path.relative(outputRoot, htmlPath)} loads the base icon subset without using a Phosphor icon.`
        );
    }
    if (stylesheets.length < 2 || new Set(stylesheets).size !== stylesheets.length) {
        failures.push(
            `${path.relative(outputRoot, htmlPath)} must load one base and one route stylesheet without duplicates; found ${stylesheets.length}.`
        );
        continue;
    }
    if (!stylesheets[0].includes('/_astro/base.')) {
        failures.push(`${path.relative(outputRoot, htmlPath)} does not load the base stylesheet first.`);
    }

    const routeAsset = stylesheets[1];
    const existingAsset = routeAssetBySurface.get(surface);
    if (existingAsset && existingAsset !== routeAsset) {
        failures.push(`${surface} pages emit more than one route stylesheet asset.`);
    } else {
        routeAssetBySurface.set(surface, routeAsset);
    }
}

for (const [surface, expectedStyles] of Object.entries(expectedRouteStyles)) {
    const routeSource = path.join(projectRoot, 'src', 'styles', 'routes', `${surface}.css`);
    const routeCss = await readFile(routeSource, 'utf8');
    const routeImports = [...routeCss.matchAll(/@import\s+['"]\.\.\/([^'"]+\.css)['"]/gu)].map((match) => match[1]);
    const responsiveImports = routeImports
        .filter((stylesheet) => stylesheet.startsWith('theatre-pages/09-'))
        .map((stylesheet) => stylesheet.slice('theatre-pages/'.length));
    const expectedResponsiveImports = expectedStyles.responsive ? [expectedStyles.responsive] : [];
    if (!routeImports.includes(expectedStyles.primary)) {
        failures.push(`${surface}.css must import ${expectedStyles.primary} as its primary route owner.`);
    }
    if (JSON.stringify(responsiveImports) !== JSON.stringify(expectedResponsiveImports)) {
        failures.push(
            `${surface}.css must import ${expectedStyles.responsive ?? 'no file'} from the split responsive layer.`
        );
    }

    const assetUrl = routeAssetBySurface.get(surface);
    if (!assetUrl) {
        failures.push(`No built route stylesheet was found for ${surface}.`);
        continue;
    }
    const assetPath = path.join(outputRoot, assetUrl.replace(/^\/+/, ''));
    const assetSize = (await stat(assetPath)).size;
    if (assetSize > routeStylesheetBudgets[surface]) {
        failures.push(
            `${surface} route CSS is ${assetSize.toLocaleString()} bytes; budget is ${routeStylesheetBudgets[surface].toLocaleString()} bytes.`
        );
    }
}

if (new Set(routeAssetBySurface.values()).size !== Object.keys(expectedRouteStyles).length) {
    failures.push('Every page surface must emit its own route stylesheet asset.');
}

const packageJson = JSON.parse(await readFile(path.join(projectRoot, 'package.json'), 'utf8'));
for (const dependency of ['gsap', 'motion']) {
    if (packageJson.dependencies?.[dependency] || packageJson.devDependencies?.[dependency]) {
        failures.push(`${dependency} must not be restored for interactions covered by the native animation runtime.`);
    }
}

if (failures.length > 0) {
    throw new Error(`Runtime asset audit failed:\n- ${failures.join('\n- ')}`);
}

console.warn(
    `Runtime asset audit passed for ${htmlFiles.length} pages across ${routeAssetBySurface.size} isolated route stylesheets.`
);
