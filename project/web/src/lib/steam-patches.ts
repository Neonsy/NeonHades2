const steamPatches = {
    '24556151': {
        name: 'Post-Launch Patch 2 – Hotfix 5',
        releasedOn: '2026-07-28',
        url: 'https://steamcommunity.com/games/1145350/announcements/detail/667245252276389492',
    },
} as const;

export function getSteamPatch(buildId: string) {
    const patch = steamPatches[buildId as keyof typeof steamPatches];

    if (!patch) {
        throw new Error(`No Steam patch metadata is configured for build ${buildId}.`);
    }

    return patch;
}
