import type { VirtualRecordIndex } from './record-index-virtualizer';

export const startCollectionFilter = (root: ParentNode, virtualIndexes: VirtualRecordIndex[]): (() => void) => {
    const filter = root.querySelector<HTMLInputElement>('#collection-filter');
    if (!filter) return () => undefined;

    const groups = [...root.querySelectorAll<HTMLDetailsElement>('[data-record-group]')];
    const groupLinks = [...root.querySelectorAll<HTMLAnchorElement>('.divine-index a')];
    const status = root.querySelector<HTMLElement>('#collection-status');

    const onInput = (): void => {
        const query = filter.value.toLocaleLowerCase().trim();
        if (query) virtualIndexes.forEach((index) => index.disable());
        const rows = [...root.querySelectorAll<HTMLElement>('[data-record-row]')];

        let hasMatch = false;
        rows.forEach((row) => {
            const matches = !query || row.dataset.filter?.includes(query);
            row.hidden = !matches;
            if (!matches) return;

            hasMatch = true;
            row.style.removeProperty('opacity');
            if (!row.hasAttribute('data-balanced-grid-justified-item')) row.style.removeProperty('transform');
            row.style.removeProperty('translate');
            row.style.removeProperty('rotate');
            row.style.removeProperty('scale');
            row.style.removeProperty('visibility');
        });
        groups.forEach((group) => {
            const groupHasMatch = [...group.querySelectorAll<HTMLElement>('[data-record-row]')].some(
                (row) => !row.hidden
            );
            group.hidden = !groupHasMatch;
            if (query && groupHasMatch) group.open = true;
        });
        groupLinks.forEach((link) => {
            link.hidden = groups.some((group) => `#${group.id}` === link.hash && group.hidden);
        });
        if (status) {
            status.textContent = !query
                ? ''
                : hasMatch
                  ? `Showing matches for ${filter.value.trim()}`
                  : `No matches for ${filter.value.trim()}`;
        }

        document.dispatchEvent(new Event('balanced-grid:change'));
        if (!query) virtualIndexes.forEach((index) => index.enable());
    };

    filter.addEventListener('input', onInput);
    return () => filter.removeEventListener('input', onInput);
};
