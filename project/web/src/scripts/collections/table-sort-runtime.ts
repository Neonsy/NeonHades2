const compareRows = (order: string, left: HTMLTableRowElement, right: HTMLTableRowElement): number => {
    const byName = (row: HTMLTableRowElement): string => row.dataset.sortName ?? '';
    const byValue = (row: HTMLTableRowElement): number => Number(row.dataset.sortValue ?? 0);
    const byIndex = (row: HTMLTableRowElement): number => Number(row.dataset.sortIndex ?? 0);

    if (order === 'alpha') return byName(left).localeCompare(byName(right));
    if (order === 'reverse-alpha') return byName(right).localeCompare(byName(left));
    if (order === 'low') return byValue(left) - byValue(right) || byName(left).localeCompare(byName(right));
    if (order === 'high') return byValue(right) - byValue(left) || byName(left).localeCompare(byName(right));
    return byIndex(left) - byIndex(right);
};

export const startCollectionTableSort = (root: ParentNode = document): (() => void) => {
    const removers = [...root.querySelectorAll<HTMLSelectElement>('[data-table-sort]')].map((control) => {
        const onChange = (): void => {
            const table = control.closest('.sortable-reference')?.querySelector<HTMLTableElement>('[data-sort-table]');
            const body = table?.tBodies.item(0);
            if (!body) return;
            const rows = [...body.rows];
            rows.sort((left, right) => compareRows(control.value, left, right));
            body.append(...rows);
        };
        control.addEventListener('change', onChange);
        return () => control.removeEventListener('change', onChange);
    });

    return () => removers.forEach((remove) => remove());
};
