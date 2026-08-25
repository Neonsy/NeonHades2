import { captureInitialFragment, queueFragmentScroll, restoreInitialFragment } from './view-fragment-navigation';

type SearchDocument = {
    name: string;
    typeLabel: string;
    context: string;
    href: string;
    terms: string[];
    spoilerLevel: string;
    art: {
        kind: 'character' | 'material' | 'record';
        id: string;
        source: string;
        format?: 'raster';
        overlaySource?: string;
        tone: 'ember' | 'moon' | 'night' | 'thread' | 'violet';
    } | null;
};

const input = document.querySelector<HTMLInputElement>('#knowledge-query, #home-query');
const initialSearchFragment =
    input?.id === 'knowledge-query' && window.location.hash === '#search' ? captureInitialFragment() : '';
const homeResponse = document.querySelector<HTMLElement>('.home-search-response');
const results = document.querySelector<HTMLOListElement>('#search-results');
const status = document.querySelector<HTMLElement>('#search-status');
const data = document.querySelector<HTMLScriptElement>('#search-data');
const documents = JSON.parse(data?.textContent ?? '[]') as SearchDocument[];
const ignoredSearchWords = new Set([
    'a',
    'an',
    'are',
    'can',
    'do',
    'does',
    'for',
    'how',
    'i',
    'is',
    'my',
    'of',
    'the',
    'to',
    'what',
    'when',
    'where',
    'which',
    'why',
]);

function normalize(value: string): string {
    return value
        .toLocaleLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

function renderSearch(): void {
    if (!input || !results || !status) return;
    const query = normalize(input.value);
    if (homeResponse) homeResponse.hidden = !query;
    if (!query) {
        results.hidden = true;
        results.replaceChildren();
        status.textContent = 'Search the complete guide.';
        return;
    }

    const queryWords = query.split(' ').filter(Boolean);
    const meaningfulWords = queryWords.filter((word) => !ignoredSearchWords.has(word));
    const words = meaningfulWords.length > 0 ? meaningfulWords : queryWords;
    const matches = documents
        .map((document) => {
            const name = normalize(document.name);
            const terms = document.terms.map(normalize);
            const haystack = normalize([document.name, document.typeLabel, ...document.terms].join(' '));
            if (!words.every((word) => haystack.includes(word))) return { document, score: -1 };

            const strongestTermCoverage = Math.max(
                0,
                ...terms.map((term) => words.filter((word) => term.includes(word)).length)
            );
            const score =
                (name === query ? 1000 : 0) +
                (name.startsWith(query) ? 300 : 0) +
                (name.includes(query) ? 200 : 0) +
                (terms.some((term) => term === query) ? 180 : 0) +
                (terms.some((term) => term.includes(query)) ? 120 : 0) +
                words.filter((word) => name.includes(word)).length * 30 +
                strongestTermCoverage * 12 +
                words.length;
            return { document, score };
        })
        .filter((match) => match.score >= 0)
        .sort((a, b) => b.score - a.score || a.document.name.localeCompare(b.document.name))
        .slice(0, homeResponse ? 5 : 18);

    results.replaceChildren(
        ...matches.map(({ document: result }) => {
            const item = document.createElement('li');
            const link = document.createElement('a');
            if (result.art) {
                const art = document.createElement('span');
                art.className = `subject-art subject-art--${result.art.kind} subject-art--inline subject-art--${result.art.tone}`;
                art.ariaHidden = 'true';
                if (result.art.format === 'raster') {
                    art.classList.add('subject-art--raster');
                    art.dataset.subjectArtRaster = result.art.id;
                    const core = document.createElement('img');
                    core.className = 'subject-art__raster-core';
                    core.src = result.art.source;
                    core.alt = '';
                    core.decoding = 'async';
                    art.append(core);
                    if (result.art.overlaySource) {
                        const effects = document.createElement('img');
                        effects.className = 'subject-art__raster-effects';
                        effects.src = result.art.overlaySource;
                        effects.alt = '';
                        effects.decoding = 'async';
                        art.append(effects);
                    }
                } else {
                    art.dataset.subjectArt = result.art.id;
                    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                    svg.setAttribute('viewBox', result.art.kind === 'character' ? '0 0 320 420' : '0 0 160 160');
                    const baseId = result.art.id.startsWith('boon-')
                        ? 'boon-scroll'
                        : result.art.id === 'arcana'
                          ? 'tarot-frame'
                          : result.art.id === 'keepsake'
                            ? 'charm-loop'
                            : null;
                    if (baseId) {
                        const base = document.createElementNS('http://www.w3.org/2000/svg', 'use');
                        base.setAttribute('href', `/art/symbols/records.svg#${baseId}`);
                        svg.append(base);
                    }
                    const symbol = document.createElementNS('http://www.w3.org/2000/svg', 'use');
                    symbol.setAttribute('href', `${result.art.source}#${result.art.id}`);
                    svg.append(symbol);
                    art.append(svg);
                }
                link.append(art);
            }
            const name = document.createElement('strong');
            const meta = document.createElement('span');
            link.href = result.href;
            name.textContent = result.name;
            meta.textContent = result.typeLabel;
            const copy = document.createElement('span');
            copy.className = 'search-result-copy';
            const context = document.createElement('span');
            context.className = 'search-result-context';
            context.textContent = result.context.length > 160 ? `${result.context.slice(0, 157)}…` : result.context;
            copy.append(name, context);
            link.append(copy, meta);
            item.append(link);
            return item;
        })
    );
    const groups = Map.groupBy(Array.from(results.children), (_item, index) => matches[index].document.typeLabel);
    if (!homeResponse)
        results.replaceChildren(
            ...[...groups].map(([category, items]) => {
                const group = document.createElement('li');
                group.className = 'search-result-group';
                const heading = document.createElement('h3');
                heading.textContent = category;
                const list = document.createElement('ol');
                list.append(...items);
                group.append(heading, list);
                return group;
            })
        );
    results.hidden = false;
    status.textContent = matches.length
        ? `Showing the closest matches for "${input.value.trim()}".`
        : 'No result. Try a shorter official name, familiar term, or system.';
}

if (input) input.value = new URLSearchParams(window.location.search).get('q') ?? '';
renderSearch();
input?.addEventListener('input', () => {
    if (homeResponse) {
        renderSearch();
        return;
    }
    const url = new URL(window.location.href);
    if (input.value.trim()) url.searchParams.set('q', input.value.trim());
    else url.searchParams.delete('q');
    window.history.replaceState(window.history.state, '', url);
    renderSearch();
});

input?.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && homeResponse) homeResponse.hidden = true;
    if (event.key === 'ArrowDown' && !results?.hidden) {
        event.preventDefault();
        results?.querySelector<HTMLAnchorElement>('a')?.focus();
    }
});
input?.addEventListener('focus', () => {
    if (homeResponse && input.value.trim()) renderSearch();
});

const focusSearchFromHash = (scroll = true): void => {
    let requestedByShortcut = false;
    try {
        requestedByShortcut = window.sessionStorage.getItem('neodes2-focus-search') === 'true';
        window.sessionStorage.removeItem('neodes2-focus-search');
    } catch {
        /* Search remains usable when browser storage is blocked. */
    }
    if (window.location.hash !== '#search' && !requestedByShortcut && !(!scroll && initialSearchFragment)) return;

    input?.focus({ preventScroll: true });
    if (scroll) queueFragmentScroll('#search');
};
focusSearchFromHash(!initialSearchFragment);
restoreInitialFragment(initialSearchFragment);
window.addEventListener('pageshow', (event) => {
    if (event.persisted) focusSearchFromHash();
});
window.addEventListener('hashchange', () => focusSearchFromHash());
