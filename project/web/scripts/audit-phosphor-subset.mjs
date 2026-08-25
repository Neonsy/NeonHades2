import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { collectUsedPhosphorIcons } from './phosphor-subset.mjs';

const manifestPath = path.resolve('scripts/phosphor-subset.generated.json');
const fontPath = path.resolve('public/fonts/phosphor-regular-subset.woff2');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const usedIcons = await collectUsedPhosphorIcons();

if (JSON.stringify(usedIcons) !== JSON.stringify(manifest.icons)) {
    throw new Error('Phosphor icon usage changed. Run `pnpm generate:phosphor-icons` and commit the generated files.');
}
await access(fontPath);
console.warn(`Phosphor subset matches ${usedIcons.length} used icon classes.`);
