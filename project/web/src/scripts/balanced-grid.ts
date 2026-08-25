const parseCssLength = (value: string, rootFontSize: number): number => {
    const normalized = value.trim().toLowerCase();
    const amount = Number.parseFloat(normalized);
    if (!Number.isFinite(amount)) return 0;
    if (normalized.endsWith('rem')) return amount * rootFontSize;
    if (normalized.endsWith('px')) return amount;
    return amount;
};

const gridItems = (grid: HTMLElement): HTMLElement[] => {
    const itemSelector = grid.dataset.balancedGridItems;
    return Array.from(grid.children).filter(
        (child): child is HTMLElement => child instanceof HTMLElement && (!itemSelector || child.matches(itemSelector))
    );
};

const visibleGridItems = (grid: HTMLElement): HTMLElement[] =>
    gridItems(grid).filter((item) => !item.hidden && getComputedStyle(item).display !== 'none');

const chooseColumnCount = (
    itemCount: number,
    naturalColumns: number,
    maximumColumns: number,
    containerWidth: number,
    gap: number,
    minimumItemWidth: number
): { centerOrphan: boolean; columns: number } => {
    if (naturalColumns <= 1 || itemCount <= 2 || itemCount % naturalColumns !== 1) {
        return { centerOrphan: false, columns: naturalColumns };
    }

    for (let expandedColumns = naturalColumns + 1; expandedColumns <= maximumColumns; expandedColumns += 1) {
        if (itemCount % expandedColumns === 1) continue;
        const expandedItemWidth = (containerWidth - Math.max(0, expandedColumns - 1) * gap) / expandedColumns;
        if (expandedItemWidth >= minimumItemWidth) {
            return { centerOrphan: false, columns: expandedColumns };
        }
    }

    for (let columns = naturalColumns - 1; columns >= 2; columns -= 1) {
        if (itemCount % columns !== 1) return { centerOrphan: false, columns };
    }

    return { centerOrphan: true, columns: naturalColumns };
};

export const startBalancedGridLayout = (): void => {
    const grids = Array.from(document.querySelectorAll<HTMLElement>('[data-balanced-grid]'));
    if (grids.length === 0) return;

    const rootFontSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
    const pending = new Set<HTMLElement>(grids);
    let frame = 0;

    const clearIndependentColumns = (grid: HTMLElement, items: HTMLElement[]) => {
        delete grid.dataset.balancedGridIndependent;
        delete grid.dataset.balancedGridIndependentGap;
        delete grid.dataset.balancedGridMasonry;
        grid.style.removeProperty('height');
        grid.style.removeProperty('position');
        grid.style.removeProperty('align-items');
        grid.style.removeProperty('grid-auto-rows');
        grid.style.removeProperty('row-gap');
        items.forEach((item) => {
            const wasMasonryItem = item.hasAttribute('data-balanced-grid-masonry-item');
            item.removeAttribute('data-balanced-grid-independent-item');
            item.removeAttribute('data-balanced-grid-masonry-item');
            item.style.removeProperty('position');
            item.style.removeProperty('top');
            item.style.removeProperty('left');
            item.style.removeProperty('content-visibility');
            item.style.removeProperty('grid-column');
            item.style.removeProperty('grid-row');
            item.style.removeProperty('height');
            item.style.removeProperty('justify-self');
            item.style.removeProperty('width');
            if (wasMasonryItem) item.style.removeProperty('transform');
        });
    };

    const clearJustifiedLayout = (grid: HTMLElement, items: HTMLElement[]) => {
        delete grid.dataset.balancedGridRows;
        items.forEach((item) => {
            item.removeAttribute('data-balanced-grid-justified-item');
            item.removeAttribute('data-balanced-grid-row');
            item.removeAttribute('data-balanced-grid-row-start');
            item.removeAttribute('data-balanced-grid-row-end');
            item.style.removeProperty('align-self');
            item.style.removeProperty('flex-basis');
            item.style.removeProperty('margin-inline');
            item.style.removeProperty('width');
        });
    };

    const applyIndependentColumns = (
        grid: HTMLElement,
        items: HTMLElement[],
        columns: number,
        rowGap: number,
        itemWidth: number
    ) => {
        const allItems = gridItems(grid);
        clearJustifiedLayout(grid, allItems);
        delete grid.dataset.balancedGridOrphan;
        grid.style.removeProperty('--balanced-grid-item-width');
        grid.dataset.balancedGridIndependent = '';
        grid.dataset.balancedGridIndependentGap = `${rowGap}`;
        grid.style.gridTemplateColumns = `repeat(${columns}, minmax(0, 1fr))`;
        grid.style.removeProperty('grid-auto-rows');
        grid.style.removeProperty('row-gap');
        grid.style.alignItems = 'start';

        allItems.forEach((item) => {
            item.removeAttribute('data-balanced-grid-independent-item');
            item.style.removeProperty('grid-column');
            item.style.removeProperty('grid-row');
            item.style.removeProperty('justify-self');
            item.style.removeProperty('width');
        });

        const centeredOrphans = new Set<HTMLElement>();
        let segment: HTMLElement[] = [];
        const markSegmentOrphan = () => {
            const orphan = segment.length % columns === 1 ? segment.at(-1) : undefined;
            if (orphan) centeredOrphans.add(orphan);
            segment = [];
        };

        items.forEach((item) => {
            if (item.dataset.balancedGridSpan === 'all') {
                markSegmentOrphan();
            } else {
                segment.push(item);
            }
        });
        markSegmentOrphan();

        const itemHeights = new Map(items.map((item) => [item, item.getBoundingClientRect().height]));
        const columnEnds = Array.from({ length: columns }, () => 0);
        let columnCursor = 0;

        grid.style.gridAutoRows = '1px';
        grid.style.rowGap = '0px';

        items.forEach((item) => {
            const spansAllColumns = item.dataset.balancedGridSpan === 'all';
            const centeredOrphan = centeredOrphans.has(item);
            const height = itemHeights.get(item) ?? 0;
            const rowSpan = Math.max(1, Math.ceil(height));
            item.setAttribute('data-balanced-grid-independent-item', '');

            if (spansAllColumns || centeredOrphan) {
                const previousEnd = Math.max(...columnEnds);
                const rowStart = Math.ceil(previousEnd === 0 ? 0 : previousEnd + rowGap);
                item.style.gridColumn = '1 / -1';
                item.style.gridRow = `${rowStart + 1} / span ${rowSpan}`;
                if (centeredOrphan) {
                    item.style.justifySelf = 'center';
                    item.style.width = `${itemWidth}px`;
                }
                columnEnds.fill(rowStart + rowSpan);
                columnCursor = 0;
                return;
            }

            const column = columnCursor % columns;
            const previousEnd = columnEnds[column];
            const rowStart = Math.ceil(previousEnd === 0 ? 0 : previousEnd + rowGap);
            item.style.gridColumn = `${column + 1}`;
            item.style.gridRow = `${rowStart + 1} / span ${rowSpan}`;
            columnEnds[column] = rowStart + rowSpan;
            columnCursor += 1;
        });
    };

    const distributeWidths = (
        weights: number[],
        availableWidth: number,
        minimumWidth: number,
        maximumWidth: number
    ): number[] => {
        const weightTotal = weights.reduce((total, weight) => total + weight, 0);
        const widths = weights.map((weight) =>
            Math.min(maximumWidth, Math.max(minimumWidth, (availableWidth * weight) / weightTotal))
        );

        for (let pass = 0; pass < weights.length * 2; pass += 1) {
            const delta = availableWidth - widths.reduce((total, width) => total + width, 0);
            if (Math.abs(delta) < 0.5) break;
            const candidates = widths
                .map((width, index) => ({ index, width }))
                .filter(({ width }) => (delta > 0 ? width < maximumWidth - 0.5 : width > minimumWidth + 0.5));
            if (candidates.length === 0) break;
            const adjustment = delta / candidates.length;
            candidates.forEach(({ index }) => {
                widths[index] = Math.min(maximumWidth, Math.max(minimumWidth, widths[index] + adjustment));
            });
        }

        const remainder = availableWidth - widths.reduce((total, width) => total + width, 0);
        if (widths.length > 0) widths[widths.length - 1] += remainder;
        return widths;
    };

    const applyRowWidths = (row: HTMLElement[], widths: number[]): void => {
        row.forEach((item, index) => {
            item.style.flexBasis = `${widths[index]}px`;
            item.style.width = `${widths[index]}px`;
        });
    };

    const measureRow = (row: HTMLElement[], widths: number[]) => {
        applyRowWidths(row, widths);
        const heights = row.map((item) => Math.max(1, item.getBoundingClientRect().height));
        const averageHeight = heights.reduce((total, height) => total + height, 0) / heights.length;
        const averageWidth = widths.reduce((total, width) => total + width, 0) / widths.length;
        const heightRange = Math.max(...heights) - Math.min(...heights);
        const heightDeviation = heights.reduce((total, height) => total + Math.abs(height - averageHeight), 0);
        const widthDeviation = widths.reduce((total, width) => total + Math.abs(width - averageWidth), 0);
        return {
            heights,
            score: heightRange * 1000 + heightDeviation * 10 + widthDeviation / 10,
            widths: [...widths],
        };
    };

    const tightenRowWidths = (
        row: HTMLElement[],
        rowWidth: number,
        minimumWidth: number,
        maximumWidth: number
    ): number[] => {
        const equalWidth = rowWidth / row.length;
        const boundedMinimum = Math.max(minimumWidth, equalWidth * 0.72);
        const boundedMaximum = Math.min(maximumWidth, equalWidth * 1.28);
        const equalMeasurement = measureRow(
            row,
            row.map(() => equalWidth)
        );
        let best = equalMeasurement;

        for (const power of [1.4, 1.8, 2.2, 2.6]) {
            const candidateWidths = distributeWidths(
                best.heights.map((height) => height ** power),
                rowWidth,
                boundedMinimum,
                boundedMaximum
            );
            const candidate = measureRow(row, candidateWidths);
            if (candidate.score < best.score) best = candidate;
        }

        for (let pass = 0; pass < row.length * 2; pass += 1) {
            const tallest = Math.max(...best.heights);
            const shortest = Math.min(...best.heights);
            if (tallest - shortest <= 12) break;

            const receivers = best.heights
                .map((height, index) => ({ height, index }))
                .filter(({ height }) => height >= tallest - 1);
            const donors = best.heights
                .map((height, index) => ({ height, index }))
                .filter(({ height }) => height <= shortest + 1);
            let next = best;

            receivers.forEach(({ index: receiver }) => {
                donors.forEach(({ index: donor }) => {
                    if (receiver === donor) return;
                    const available = Math.min(
                        boundedMaximum - best.widths[receiver],
                        best.widths[donor] - boundedMinimum
                    );
                    for (let delta = 8; delta <= available + 0.5; delta += 8) {
                        const candidateWidths = [...best.widths];
                        candidateWidths[receiver] += delta;
                        candidateWidths[donor] -= delta;
                        const candidate = measureRow(row, candidateWidths);
                        if (candidate.score < next.score) next = candidate;
                    }
                });
            });

            if (next === best) break;
            best = next;
        }

        applyRowWidths(row, best.widths);
        return best.widths;
    };

    const justifyRows = (
        grid: HTMLElement,
        items: HTMLElement[],
        columns: number,
        contentWidth: number,
        gap: number,
        minimumItemWidth: number,
        equalItemWidth: number
    ) => {
        grid.style.removeProperty('grid-template-columns');
        delete grid.dataset.balancedGridOrphan;
        grid.style.removeProperty('--balanced-grid-item-width');

        const allItems = gridItems(grid);
        clearIndependentColumns(grid, allItems);
        const alignRows = grid.dataset.balancedGridAlign === 'row';
        grid.style.alignItems = alignRows ? 'stretch' : 'flex-start';
        allItems.forEach((item) => {
            if (items.includes(item)) return;
            item.removeAttribute('data-balanced-grid-justified-item');
            item.removeAttribute('data-balanced-grid-row');
            item.removeAttribute('data-balanced-grid-row-start');
            item.removeAttribute('data-balanced-grid-row-end');
            item.style.removeProperty('align-self');
            item.style.removeProperty('flex-basis');
            item.style.removeProperty('margin-inline');
            item.style.removeProperty('width');
        });

        const rows = Array.from({ length: Math.ceil(items.length / columns) }, (_, rowIndex) =>
            items.slice(rowIndex * columns, (rowIndex + 1) * columns)
        );
        grid.dataset.balancedGridRows = `${rows.length}`;

        items.forEach((item, index) => {
            item.setAttribute('data-balanced-grid-justified-item', '');
            item.dataset.balancedGridRow = `${Math.floor(index / columns) + 1}`;
            item.style.alignSelf = 'flex-start';
            item.style.flexBasis = `${equalItemWidth}px`;
            item.style.width = `${equalItemWidth}px`;
        });

        rows.forEach((row) => {
            row[0]?.setAttribute('data-balanced-grid-row-start', '');
            row.at(-1)?.setAttribute('data-balanced-grid-row-end', '');
            const rowWidth = contentWidth - Math.max(0, row.length - 1) * gap;
            if (row.length === 1) {
                const singletonWidth = columns === 1 ? rowWidth : Math.min(rowWidth, minimumItemWidth * 1.35);
                row[0].style.flexBasis = `${singletonWidth}px`;
                row[0].style.marginInline = 'auto';
                row[0].style.width = `${singletonWidth}px`;
                row[0].style.removeProperty('align-self');
                return;
            }

            const boundedMinimum = Math.min(minimumItemWidth, rowWidth / row.length);
            const maximumShare = row.length === 2 ? 0.62 : row.length === 3 ? 0.48 : 0.4;
            const boundedMaximum = Math.max(boundedMinimum, rowWidth * maximumShare);
            let widths = row.map(() => rowWidth / row.length);
            if (grid.dataset.balancedGridBalance === 'tight') {
                widths = tightenRowWidths(row, rowWidth, boundedMinimum, boundedMaximum);
            } else if (grid.dataset.balancedGridBalance !== 'equal') {
                let bestWidths = [...widths];
                let bestRaggedness = Number.POSITIVE_INFINITY;
                for (let pass = 0; pass < 4; pass += 1) {
                    applyRowWidths(row, widths);
                    const heights = row.map((item) => Math.max(1, item.getBoundingClientRect().height));
                    const averageHeight = heights.reduce((total, height) => total + height, 0) / heights.length;
                    const raggedness =
                        (Math.max(...heights) - Math.min(...heights)) * heights.length +
                        heights.reduce((total, height) => total + Math.abs(height - averageHeight), 0);
                    if (raggedness < bestRaggedness) {
                        bestRaggedness = raggedness;
                        bestWidths = [...widths];
                    }
                    const contentWeights = heights.map((height, index) => widths[index] * height);
                    widths = distributeWidths(contentWeights, rowWidth, boundedMinimum, boundedMaximum);
                }
                widths = bestWidths;
            }
            row.forEach((item, index) => {
                item.style.flexBasis = `${widths[index]}px`;
                item.style.removeProperty('margin-inline');
                item.style.width = `${widths[index]}px`;
                item.style.alignSelf = alignRows ? 'stretch' : 'flex-start';
            });
        });
    };

    const update = () => {
        frame = 0;
        const measurements = Array.from(pending, (grid) => {
            const items = visibleGridItems(grid);
            const justified = grid.dataset.balancedGridLayout === 'justified';
            const independent = grid.dataset.balancedGridLayout === 'independent';
            const style = getComputedStyle(grid);
            const width = grid.getBoundingClientRect().width;
            const gap = Number.parseFloat(style.columnGap) || 0;
            const rowGap = Number.parseFloat(grid.dataset.balancedGridIndependentGap ?? style.rowGap) || 0;
            const borderLeft = Number.parseFloat(style.borderLeftWidth) || 0;
            const borderRight = Number.parseFloat(style.borderRightWidth) || 0;
            const paddingLeft = Number.parseFloat(style.paddingLeft) || 0;
            const paddingRight = Number.parseFloat(style.paddingRight) || 0;
            const contentWidth = Math.max(0, width - borderLeft - borderRight - paddingLeft - paddingRight);
            const minimumItemWidth = Math.max(1, parseCssLength(grid.dataset.balancedGridMin ?? '16rem', rootFontSize));
            const configuredMaximum = Number.parseInt(grid.dataset.balancedGridMax ?? `${items.length}`, 10);
            const maximumColumns = Math.max(
                1,
                Math.min(items.length, Number.isFinite(configuredMaximum) ? configuredMaximum : items.length)
            );
            const naturalColumns = Math.max(
                1,
                Math.min(maximumColumns, Math.floor((contentWidth + gap) / (minimumItemWidth + gap)))
            );
            const decision = chooseColumnCount(
                items.length,
                naturalColumns,
                maximumColumns,
                contentWidth,
                gap,
                minimumItemWidth
            );
            return {
                ...decision,
                contentWidth,
                gap,
                grid,
                itemCount: items.length,
                items,
                itemWidth: (contentWidth - Math.max(0, decision.columns - 1) * gap) / decision.columns,
                justified,
                independent,
                minimumItemWidth,
                rowGap,
                width,
            };
        });
        pending.clear();

        measurements.forEach(
            ({
                centerOrphan,
                columns,
                contentWidth,
                gap,
                grid,
                itemCount,
                items,
                itemWidth,
                justified,
                independent,
                minimumItemWidth,
                rowGap,
                width,
            }) => {
                if (width === 0) return;
                if (itemCount === 0) {
                    clearIndependentColumns(grid, gridItems(grid));
                    clearJustifiedLayout(grid, gridItems(grid));
                    return;
                }
                const nextColumns = `${columns}`;
                grid.dataset.balancedGridColumns = nextColumns;

                grid.querySelector('[data-balanced-grid-orphan-item]')?.removeAttribute(
                    'data-balanced-grid-orphan-item'
                );
                if (independent && columns > 1) {
                    applyIndependentColumns(grid, items, columns, rowGap, itemWidth);
                } else if (justified) {
                    justifyRows(grid, items, columns, contentWidth, gap, minimumItemWidth, itemWidth);
                } else if (centerOrphan) {
                    clearIndependentColumns(grid, gridItems(grid));
                    clearJustifiedLayout(grid, gridItems(grid));
                    grid.style.gridTemplateColumns = `repeat(${columns}, minmax(0, 1fr))`;
                    grid.dataset.balancedGridOrphan = 'center';
                    grid.style.setProperty('--balanced-grid-item-width', `${itemWidth}px`);
                    items.at(-1)?.setAttribute('data-balanced-grid-orphan-item', '');
                } else {
                    clearIndependentColumns(grid, gridItems(grid));
                    clearJustifiedLayout(grid, gridItems(grid));
                    grid.style.gridTemplateColumns = `repeat(${columns}, minmax(0, 1fr))`;
                    delete grid.dataset.balancedGridOrphan;
                    grid.style.removeProperty('--balanced-grid-item-width');
                }
            }
        );
    };

    const schedule = (grid: HTMLElement) => {
        pending.add(grid);
        if (!frame) frame = window.requestAnimationFrame(update);
    };
    const scheduleAll = () => grids.forEach(schedule);

    const resizeObserver = new ResizeObserver((entries) => {
        entries.forEach((entry) => {
            const target = entry.target as HTMLElement;
            const grid = target.matches('[data-balanced-grid]')
                ? target
                : target.closest<HTMLElement>('[data-balanced-grid]');
            if (grid) schedule(grid);
        });
    });
    const mutationObserver = new MutationObserver((entries) => {
        entries.forEach((entry) => {
            const target = entry.target as HTMLElement;
            const grid = target.matches('[data-balanced-grid]')
                ? target
                : target.closest<HTMLElement>('[data-balanced-grid]');
            if (grid) schedule(grid);
            target.querySelectorAll<HTMLElement>('[data-balanced-grid]').forEach(schedule);
        });
    });

    grids.forEach((grid) => {
        resizeObserver.observe(grid);
        if (grid.dataset.balancedGridLayout === 'independent') {
            gridItems(grid).forEach((item) => resizeObserver.observe(item));
        }
    });
    mutationObserver.observe(document.body, {
        attributeFilter: ['class', 'hidden', 'open'],
        attributes: true,
        childList: true,
        subtree: true,
    });
    window.addEventListener('resize', scheduleAll, { passive: true });
    document.addEventListener('balanced-grid:change', scheduleAll);
    void document.fonts?.ready.then(scheduleAll);
    scheduleAll();

    window.addEventListener(
        'pagehide',
        () => {
            if (frame) window.cancelAnimationFrame(frame);
            window.removeEventListener('resize', scheduleAll);
            document.removeEventListener('balanced-grid:change', scheduleAll);
            resizeObserver.disconnect();
            mutationObserver.disconnect();
        },
        { once: true }
    );
};
