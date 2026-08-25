const categoryByRecordType = new Map([
    ['mechanics/arcana-card', 'arcana'],
    ['editorial/arcana-rating', 'arcana'],
    ['mechanics/boon', 'boons'],
    ['editorial/boon-rating', 'boons'],
    ['mechanics/encounter-aid', 'encounters'],
    ['mechanics/familiar', 'familiars'],
    ['editorial/familiar-rating', 'familiars'],
    ['mechanics/gathering-tool', 'tools'],
    ['mechanics/god', 'characters'],
    ['mechanics/hammer-upgrade', 'hammers'],
    ['mechanics/hex', 'hexes'],
    ['editorial/hex-rating', 'hexes'],
    ['mechanics/incantation', 'incantations'],
    ['mechanics/keepsake', 'keepsakes'],
    ['mechanics/resource', 'resources'],
    ['mechanics/fish', 'resources'],
    ['mechanics/run-reward', 'resources'],
    ['mechanics/weapon', 'weapons'],
    ['mechanics/weapon-aspect', 'weapons'],
    ['editorial/weapon-guide', 'weapons'],
    ['editorial/aspect-guide', 'weapons'],
    ['world-progression/encounter-friend', 'characters'],
    ['world-progression/narrative-milestone', 'characters'],
    ['world-progression/relationship', 'characters'],
    ['world-progression/oath-condition', 'oaths'],
    ['world-progression/enemy', 'characters/enemies'],
    ['world-progression/region', 'regions'],
]);

export const publicArtCategory = (recordType) => {
    const category = categoryByRecordType.get(recordType);
    if (!category) throw new Error(`No public art category is defined for ${recordType}`);
    return category;
};

export const publicArtRoute = (recordType, id, media) => `/art/${publicArtCategory(recordType)}/${id}.${media}`;
