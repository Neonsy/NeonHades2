import { readFileSync, readdirSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';

const root = resolve('dist');
const sourceStyles = readdirSync(resolve('src/styles/ui-refinement'))
    .sort()
    .map((file) => readFileSync(resolve('src/styles/ui-refinement', file), 'utf8'))
    .join('\n');
const failures = [];

const files = (directory) =>
    readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const path = join(directory, entry.name);
        return entry.isDirectory() ? files(path) : extname(path) === '.html' ? [path] : [];
    });

const attribute = (tag, name) =>
    tag
        .match(new RegExp(`\\s${name}(?:=(?:"([^"]*)"|'([^']*)'|([^\\s>]+)))?`, 'iu'))
        ?.slice(1)
        .find(Boolean);

const normalizedWords = (value) =>
    value
        .replaceAll(/&(?:amp|apos|gt|lt|quot);/gu, ' ')
        .replaceAll(/[^\p{L}\p{N}]+/gu, ' ')
        .trim()
        .toLocaleLowerCase('en');

for (const file of files(root)) {
    const html = readFileSync(file, 'utf8');
    const route = relative(root, file).replaceAll('\\', '/');
    const tags = html.match(/<[^!][^>]*>/gu) ?? [];

    for (const tag of tags) {
        const name = tag.match(/^<\/?([a-z0-9-]+)/iu)?.[1]?.toLowerCase();
        if (!name || tag.startsWith('</')) continue;
        const tabindex = attribute(tag, 'tabindex');
        if (tabindex && Number(tabindex) > 0) failures.push(`${route}: positive tabindex ${tabindex}`);
        if (name === 'a' && !/\shref=/iu.test(tag)) failures.push(`${route}: anchor without href`);
        if (name === 'button' && !/\stype=/iu.test(tag)) failures.push(`${route}: button without explicit type`);

        const role = attribute(tag, 'role')?.toLowerCase();
        const customInteractive = ['button', 'checkbox', 'link', 'radio', 'switch', 'tab'].includes(role ?? '');
        const nativeInteractive = ['a', 'button', 'input', 'select', 'summary', 'textarea'].includes(name);
        if (customInteractive && !nativeInteractive && tabindex !== '0') {
            failures.push(`${route}: custom ${role} is not keyboard-focusable`);
        }
    }

    for (const match of html.matchAll(/<(a|button|summary)\b([^>]*)>([\s\S]*?)<\/\1>/giu)) {
        const [, name, attributes, contents] = match;
        const openingTag = `<${name}${attributes}>`;
        const accessibleName = attribute(openingTag, 'aria-label');
        if (!accessibleName) continue;

        const visibleContents = contents
            .replaceAll(/<([a-z0-9-]+)\b[^>]*\saria-hidden=(?:"true"|'true'|true)[^>]*>[\s\S]*?<\/\1>/giu, ' ')
            .replaceAll(/<[^>]+>/gu, ' ');
        const visibleLabel = normalizedWords(visibleContents);
        if (!visibleLabel) continue;
        if (!normalizedWords(accessibleName).includes(visibleLabel)) {
            failures.push(`${route}: visible label is not contained in the ${name} accessible name`);
        }
    }
}

for (const required of [
    ":where(a[href], button, input, select, textarea, summary, [tabindex]:not([tabindex='-1'])):focus-visible",
    ":is(a[href], button, input, select, textarea, summary, [role='button']):active",
    '.world-header :is(.world-wordmark, .world-primary-nav a, .world-search, .world-menu-toggle):focus-visible',
]) {
    if (!sourceStyles.includes(required)) failures.push(`focus-state stylesheet is missing: ${required}`);
}

if (failures.length > 0) {
    console.error(`Keyboard interaction audit failed with ${failures.length} issue(s):`);
    failures.forEach((failure) => console.error(`- ${failure}`));
    process.exitCode = 1;
} else {
    console.warn(JSON.stringify({ keyboardInteractionAudit: 'passed', pages: files(root).length }));
}
