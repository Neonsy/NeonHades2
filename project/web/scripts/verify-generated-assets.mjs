import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { execFile as execFileCallback } from 'node:child_process';

const execFile = promisify(execFileCallback);
const temporaryRoot = await mkdtemp(join(tmpdir(), 'neonhades2-generated-'));

const generatedFiles = [
    {
        generated: join(temporaryRoot, 'record-icons.svg'),
        tracked: resolve('public/art/symbols/record-icons.svg'),
    },
    {
        generated: join(temporaryRoot, 'icons', 'apple-touch-icon.png'),
        tracked: resolve('public/apple-touch-icon.png'),
    },
    {
        generated: join(temporaryRoot, 'icons', 'icon-192.png'),
        tracked: resolve('public/icon-192.png'),
    },
    {
        generated: join(temporaryRoot, 'icons', 'icon-512.png'),
        tracked: resolve('public/icon-512.png'),
    },
    {
        generated: join(temporaryRoot, 'public-asset-metadata.json'),
        tracked: resolve('src/content/public-asset-metadata.json'),
    },
];

const assertMatches = async ({ generated, tracked }) => {
    const [generatedContent, trackedContent] = await Promise.all([readFile(generated), readFile(tracked)]);
    if (!generatedContent.equals(trackedContent)) {
        throw new Error(`Generated output is stale: ${tracked}. Run the matching generator to refresh it.`);
    }
};

try {
    await execFile(process.execPath, [
        'scripts/generate-crafted-subject-art.mjs',
        '--output',
        join(temporaryRoot, 'record-icons.svg'),
    ]);
    await execFile(process.execPath, [
        'scripts/generate-seo-images.mjs',
        '--output-directory',
        join(temporaryRoot, 'icons'),
    ]);
    await execFile(process.execPath, [
        'scripts/artwork/build-public-asset-metadata.mjs',
        join(temporaryRoot, 'public-asset-metadata.json'),
    ]);
    await Promise.all(generatedFiles.map(assertMatches));
    console.warn(`Verified ${generatedFiles.length} committed generated assets without rewriting them.`);
} finally {
    await rm(temporaryRoot, { force: true, recursive: true });
}
