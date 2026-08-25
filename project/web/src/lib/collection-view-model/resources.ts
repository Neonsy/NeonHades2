import {
    getFieldBySuffix,
    getRecord,
    getRecordName,
    isReaderFacingRecord,
    recordHref,
    type PublicationRecord,
} from '../publication';

type ResourceReference = { id: string; recordType: string };
type ExchangeAmount = { amount: number; resource: ResourceReference };
type MarketOffer = {
    availability: { category: string; refreshOncePerRun: boolean; rules: string[] };
    exchange: { costs: ExchangeAmount[]; receive: ExchangeAmount };
};
type FishCatch = { rarity: string; region: ResourceReference };
type FishSale = { amount: number; currency: ResourceReference };
type NamedDescription = { description: string; name: string };
type ToolCosts = { baseTool: string; costs: ExchangeAmount[]; level: number };
type CultivationGrowth = { growTimeMax: number; growTimeMin: number; rules: string[]; weight: number };
type CultivationOutput = {
    amount: number;
    bonusSeed: ResourceReference | null;
    output: ResourceReference;
    seed: ResourceReference;
};

const marketSectionCopy: Record<string, { title: string; intro: string }> = {
    'Market Screen Resources': {
        title: 'Buy permanent resources',
        intro: 'These Broker offers refresh once per night. Buy against a specific upgrade instead of emptying the shop by habit.',
    },
    'Market Screen Gifts': {
        title: 'Restock gifts',
        intro: 'Each gift offer refreshes once per night after its named Kinship rite is complete.',
    },
    'Market Screen Sell': {
        title: 'Sell spare materials for Bones',
        intro: 'Deathly Fortune opens these sales. Reserve anything needed by an unfinished incantation or upgrade before converting the remainder.',
    },
    'Market Screen Exchange': {
        title: 'Trade finished materials for Kudos',
        intro: 'Earthly Fortune opens these late exchanges only after every nonrepeatable incantation using the offered material is complete.',
    },
};
const marketCategoryOrder = [
    'Market Screen Resources',
    'Market Screen Gifts',
    'Market Screen Sell',
    'Market Screen Exchange',
] as const;

export function buildResourceCollectionModel(slug: string, publicationRecords: PublicationRecord[]) {
    const resourceName = (reference: ResourceReference) => {
        const referenced = getRecord(`${reference.recordType}:${reference.id}`);
        if (!referenced || !isReaderFacingRecord(referenced)) {
            throw new Error(`Reader-facing resource has no public name: ${reference.recordType}:${reference.id}`);
        }
        return getRecordName(referenced);
    };
    const titleCase = (value: string) => value.charAt(0).toLocaleUpperCase() + value.slice(1);

    if (slug !== 'resources') {
        return {
            runRewardRecords: [],
            fishRows: [],
            toolRows: [],
            cultivationRows: [],
            mysterySeedRows: [],
            marketSections: [],
            resourceName,
            titleCase,
        };
    }

    const exchangeSortKey = (amounts: ExchangeAmount[]) =>
        amounts.map(({ amount, resource }) => `${amount} ${resourceName(resource)}`).join(' + ');
    const runRewardRecords = publicationRecords
        .filter((record) => record.recordType === 'mechanics/run-reward' && isReaderFacingRecord(record))
        .sort((a, b) => getRecordName(a).localeCompare(getRecordName(b)));
    const fishRows = publicationRecords
        .filter((record) => record.recordType === 'mechanics/fish')
        .flatMap((record) => {
            const catchData = getFieldBySuffix(record, 'catch-location') as FishCatch | undefined;
            const sale = getFieldBySuffix(record, 'sale') as FishSale | undefined;
            return catchData && sale
                ? [
                      {
                          name: getRecordName(record),
                          href: recordHref(record),
                          region: resourceName(catchData.region),
                          rarity: catchData.rarity,
                          amount: sale.amount,
                          currency: resourceName(sale.currency),
                      },
                  ]
                : [];
        })
        .sort((a, b) => a.region.localeCompare(b.region) || a.amount - b.amount);
    const toolRows = [
        ...publicationRecords
            .filter((record) => record.recordType === 'mechanics/gathering-tool')
            .reduce((grouped, record) => {
                const copy = getFieldBySuffix(record, 'name-description') as NamedDescription | undefined;
                const costs = getFieldBySuffix(record, 'level-costs') as ToolCosts | undefined;
                if (!copy || !costs) return grouped;
                const row = grouped.get(costs.baseTool) ?? {
                    name: copy.name,
                    purpose: '',
                    craftCosts: [] as ExchangeAmount[],
                    upgradeCosts: [] as ExchangeAmount[],
                    upgradeEffect: '',
                    baseRecord: undefined as PublicationRecord | undefined,
                    upgradeRecord: undefined as PublicationRecord | undefined,
                };
                if (costs.level === 1) {
                    row.purpose = copy.description.replace('Seed Mystery', 'Mystery Seeds');
                    row.craftCosts = costs.costs;
                    row.baseRecord = record;
                } else {
                    row.upgradeCosts = costs.costs;
                    row.upgradeEffect = copy.description.charAt(0).toLocaleUpperCase() + copy.description.slice(1);
                    row.upgradeRecord = record;
                }
                grouped.set(costs.baseTool, row);
                return grouped;
            }, new Map<string, { name: string; purpose: string; craftCosts: ExchangeAmount[]; upgradeCosts: ExchangeAmount[]; upgradeEffect: string; baseRecord?: PublicationRecord; upgradeRecord?: PublicationRecord }>())
            .values(),
    ].sort((a, b) => a.name.localeCompare(b.name));
    const cultivationRows = publicationRecords
        .filter((record) => record.recordType === 'mechanics/cultivation')
        .flatMap((record) => {
            const growth = getFieldBySuffix(record, 'growth') as CultivationGrowth | undefined;
            const result = getFieldBySuffix(record, 'seed-output') as CultivationOutput | undefined;
            if (!growth || !result || result.seed.id === 'SeedMystery') return [];
            return [
                {
                    seed: resourceName(result.seed),
                    harvest: resourceName(result.output),
                    amount: result.amount,
                    growTime:
                        growth.growTimeMin === growth.growTimeMax
                            ? `${growth.growTimeMin}`
                            : `${growth.growTimeMin} to ${growth.growTimeMax}`,
                },
            ];
        })
        .sort((a, b) => a.seed.localeCompare(b.seed));
    const mysterySeedRows = publicationRecords
        .filter((record) => record.recordType === 'mechanics/cultivation')
        .flatMap((record) => {
            const growth = getFieldBySuffix(record, 'growth') as CultivationGrowth | undefined;
            const result = getFieldBySuffix(record, 'seed-output') as CultivationOutput | undefined;
            if (!growth || !result || result.seed.id !== 'SeedMystery') return [];
            return [
                {
                    harvest: resourceName(result.output),
                    bonusSeed: result.bonusSeed ? resourceName(result.bonusSeed) : '',
                    weight: growth.weight,
                    conditions: growth.rules,
                },
            ];
        })
        .sort((a, b) => b.weight - a.weight || a.harvest.localeCompare(b.harvest));
    const offersByCategory = publicationRecords
        .filter((record) => record.recordType === 'mechanics/market-offer')
        .reduce(
            (grouped, record) => {
                const offer = {
                    availability: getFieldBySuffix(record, 'availability'),
                    exchange: getFieldBySuffix(record, 'exchange'),
                } as MarketOffer;
                if (!offer.availability || !offer.exchange) return grouped;
                const rows = grouped[offer.availability.category] ?? [];
                rows.push(offer);
                grouped[offer.availability.category] = rows;
                return grouped;
            },
            {} as Record<string, MarketOffer[]>
        );
    const marketSections = marketCategoryOrder.flatMap((category) => {
        const offers = offersByCategory[category] ?? [];
        const copy = marketSectionCopy[category];
        if (!copy || offers.length === 0) return [];
        const sharedRules =
            offers[0]?.availability.rules.filter((rule) =>
                offers.every((offer) => offer.availability.rules.includes(rule))
            ) ?? [];
        return [
            {
                ...copy,
                category,
                sharedRules,
                rows: offers
                    .map((offer) => ({
                        costs: offer.exchange.costs,
                        receive: offer.exchange.receive,
                        conditions: offer.availability.rules.filter((rule) => !sharedRules.includes(rule)),
                    }))
                    .sort(
                        (a, b) =>
                            exchangeSortKey([a.receive]).localeCompare(exchangeSortKey([b.receive])) ||
                            exchangeSortKey(a.costs).localeCompare(exchangeSortKey(b.costs))
                    ),
                hasSpecificConditions: offers.some((offer) =>
                    offer.availability.rules.some((rule) => !sharedRules.includes(rule))
                ),
            },
        ];
    });

    return {
        runRewardRecords,
        fishRows,
        toolRows,
        cultivationRows,
        mysterySeedRows,
        marketSections,
        resourceName,
        titleCase,
    };
}
