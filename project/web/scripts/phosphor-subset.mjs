import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const sourceRoot = path.resolve('src');
const generatedStylesheet = path.resolve('src/styles/phosphor-subset.css');
const sourceExtensions = new Set(['.astro', '.css', '.js', '.mjs', '.ts', '.tsx']);

const listSourceFiles = async (directory) => {
    const entries = await readdir(directory, { withFileTypes: true });
    const files = await Promise.all(
        entries.map(async (entry) => {
            const entryPath = path.join(directory, entry.name);
            if (entry.isDirectory()) return listSourceFiles(entryPath);
            if (entryPath === generatedStylesheet || !sourceExtensions.has(path.extname(entry.name))) return [];
            return [entryPath];
        })
    );
    return files.flat();
};

export const collectUsedPhosphorIcons = async () => {
    const names = new Set();
    for (const file of await listSourceFiles(sourceRoot)) {
        const source = await readFile(file, 'utf8');
        for (const match of source.matchAll(/\bph-[a-z0-9-]+\b/gu)) names.add(match[0]);
    }
    return [...names].sort();
};
