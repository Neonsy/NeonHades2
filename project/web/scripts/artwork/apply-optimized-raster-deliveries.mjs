import { copyFileSync, readdirSync, unlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';

const publicRoot = resolve('public');
const characterRoot = resolve(publicRoot, 'art/characters');
const files = (directory) =>
    readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const path = join(directory, entry.name);
        return entry.isDirectory() ? files(path) : [path];
    });

const optimizedFiles = files(characterRoot).filter((path) => path.endsWith('.webp.optimized.webp'));
for (const optimizedPath of optimizedFiles) {
    const outputPath = optimizedPath.replace(/\.optimized\.webp$/u, '');
    if (!outputPath.startsWith(`${characterRoot}\\`)) {
        throw new Error(`Refusing to replace an asset outside public characters: ${outputPath}`);
    }
    copyFileSync(optimizedPath, outputPath);
    unlinkSync(optimizedPath);
}

console.warn(JSON.stringify({ applied: optimizedFiles.length }));
