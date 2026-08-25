import {
    measureElement,
    observeWindowOffset,
    observeWindowRect,
    Virtualizer,
    windowScroll,
} from '@tanstack/virtual-core';

export type VirtualRecordIndex = {
    disable: () => void;
    enable: () => void;
};

const createVirtualRecordIndex = (viewport: HTMLElement): VirtualRecordIndex | null => {
    const list = viewport.querySelector<HTMLOListElement>('[data-record-index]');
    if (!list || list.dataset.balancedGridLayout === 'justified') return null;

    const sourceRows = [...list.querySelectorAll<HTMLElement>(':scope > [data-record-row]')];
    let virtualizer: Virtualizer<Window, HTMLElement> | undefined;
    let unmount: (() => void) | undefined;

    const clearRowPlacement = (row: HTMLElement): void => {
        row.removeAttribute('data-index');
        row.removeAttribute('aria-posinset');
        row.removeAttribute('aria-setsize');
        row.style.removeProperty('position');
        row.style.removeProperty('inset');
        row.style.removeProperty('width');
        row.style.removeProperty('transform');
    };

    const render = (instance: Virtualizer<Window, HTMLElement>): void => {
        if (virtualizer !== instance) return;
        const fragment = document.createDocumentFragment();
        list.style.height = `${instance.getTotalSize()}px`;
        instance.getVirtualItems().forEach((item) => {
            const row = sourceRows[item.index];
            if (!row) return;
            row.dataset.index = String(item.index);
            row.setAttribute('aria-posinset', String(item.index + 1));
            row.setAttribute('aria-setsize', String(sourceRows.length));
            row.style.position = 'absolute';
            row.style.inset = '0 auto auto 0';
            row.style.width = '100%';
            row.style.transform = `translateY(${item.start - instance.options.scrollMargin}px)`;
            fragment.append(row);
        });
        list.replaceChildren(fragment);
        window.requestAnimationFrame(() => {
            list.querySelectorAll<HTMLElement>(':scope > [data-index]').forEach((row) => instance.measureElement(row));
        });
    };

    const disable = (): void => {
        unmount?.();
        unmount = undefined;
        virtualizer = undefined;
        viewport.classList.remove('is-virtualized');
        list.style.removeProperty('height');
        sourceRows.forEach(clearRowPlacement);
        list.replaceChildren(...sourceRows);
    };

    const enable = (): void => {
        if (virtualizer) return;
        viewport.classList.add('is-virtualized');
        const scrollMargin = list.getBoundingClientRect().top + window.scrollY;
        virtualizer = new Virtualizer<Window, HTMLElement>({
            count: sourceRows.length,
            estimateSize: () => 124,
            gap: 12,
            getScrollElement: () => window,
            getItemKey: (index) => sourceRows[index]?.querySelector('a')?.getAttribute('href') ?? index,
            measureElement,
            observeElementOffset: observeWindowOffset,
            observeElementRect: observeWindowRect,
            onChange: render,
            overscan: 6,
            scrollMargin,
            scrollToFn: windowScroll,
        });
        unmount = virtualizer._didMount();
        virtualizer._willUpdate();
        render(virtualizer);
    };

    enable();
    return { disable, enable };
};

export const startCollectionRecordIndexes = (root: ParentNode = document): VirtualRecordIndex[] =>
    [...root.querySelectorAll<HTMLElement>('[data-virtual-record-index]')].flatMap((viewport) => {
        const controller = createVirtualRecordIndex(viewport);
        return controller ? [controller] : [];
    });
