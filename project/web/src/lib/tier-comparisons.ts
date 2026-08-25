export const publicTierOrder = ['S', 'A', 'B', 'C'] as const;

export type PublicTierRating = (typeof publicTierOrder)[number];

type RankedTier = Partial<Record<PublicTierRating, readonly string[]>>;

/**
 * Damage-focused placements for categories where beginner safety ratings or
 * aspect-guide frequency do not represent peak performance.
 * Array order is editorial: the first entry is the strongest within its tier.
 */
export const strongestRankings: Readonly<Record<string, RankedTier>> = {
    arcana: {
        S: ['StatusVulnerability', 'LastStand', 'CastBuff', 'MaxHealthPerRoom', 'TradeOff'],
        A: [
            'BonusHealth',
            'BonusDodge',
            'SprintShield',
            'ChanneledCast',
            'HealthRegen',
            'ChanneledBlock',
            'DoorReroll',
            'StartingGold',
            'CastCount',
        ],
        B: [
            'MagicCrit',
            'ScreenReroll',
            'MetaToRunUpgrade',
            'LowHealthBonus',
            'SorceryRegenUpgrade',
            'BonusRarity',
            'ManaOverTime',
            'EpicRarityBoost',
            'CardDraw',
        ],
        C: ['RarityBoost', 'LowManaDamageBonus'],
    },
    aspects: {
        S: [
            'LobCloseAttackAspect',
            'AxeArmCastAspect',
            'StaffClearCastAspect',
            'TorchSprintRecallAspect',
            'BaseStaffAspect',
        ],
        A: [
            'StaffRaiseDeadAspect',
            'AxeRallyAspect',
            'LobImpulseAspect',
            'AxePerfectCriticalAspect',
            'SuitHexAspect',
            'StaffSelfHitAspect',
            'DaggerTripleAspect',
        ],
        B: [
            'TorchDetonateAspect',
            'SuitMarkCritAspect',
            'SuitComboAspect',
            'LobGunAspect',
            'DaggerBlockAspect',
            'LobAmmoBoostAspect',
            'BaseSuitAspect',
            'AxeRecoveryAspect',
            'DaggerBackstabAspect',
            'TorchSpecialDurationAspect',
        ],
        C: ['DaggerHomingThrowAspect', 'TorchAutofireAspect'],
    },
    familiars: {
        S: ['CatFamiliar'],
        A: ['PolecatFamiliar', 'FrogFamiliar', 'HoundFamiliar'],
        B: ['RavenFamiliar'],
    },
    hexes: {
        S: ['Laser', 'MoonBeam'],
        A: ['Meteor', 'TimeSlow', 'Transform'],
        B: ['Polymorph', 'Leap', 'Potion', 'Summon'],
    },
    keepsakes: {
        S: [
            'HadesAndPersephoneKeepsake',
            'GoldifyKeepsake',
            'LowHealthCritKeepsake',
            'AthenaEncounterKeepsake',
            'BlockDeathKeepsake',
        ],
        A: [
            'ReincarnationKeepsake',
            'TimedBuffKeepsake',
            'TempHammerKeepsake',
            'RandomBlessingKeepsake',
            'RarifyKeepsake',
            'FountainRarityKeepsake',
        ],
        B: [
            'ForceHephaestusBoonKeepsake',
            'ForceZeusBoonKeepsake',
            'ForceHeraBoonKeepsake',
            'ForceDemeterBoonKeepsake',
            'ForceAphroditeBoonKeepsake',
            'ForceHestiaBoonKeepsake',
            'ForceAresBoonKeepsake',
            'ForcePoseidonBoonKeepsake',
            'ForceApolloBoonKeepsake',
        ],
        C: [
            'SpellTalentKeepsake',
            'DamagedDamageBoostKeepsake',
            'SkipEncounterKeepsake',
            'DoorHealReserveKeepsake',
            'BossPreDamageKeepsake',
            'ManaOverTimeRefundKeepsake',
            'DecayingBoostKeepsake',
            'UnpickedBoonKeepsake',
            'ArmorGainKeepsake',
            'BossMetaUpgradeKeepsake',
            'DeathVengeanceKeepsake',
            'BonusMoneyKeepsake',
            'EscalatingKeepsake',
        ],
    },
    weapons: {
        S: ['WeaponLob', 'WeaponAxe', 'WeaponStaffSwing'],
        A: ['WeaponDagger', 'WeaponTorch'],
        B: ['WeaponSuit'],
    },
};

export const strongestPlacementFor = (
    tierSlug: string,
    subjectId: string
): { rating: PublicTierRating; order: number } | undefined => {
    const rankings = strongestRankings[tierSlug];
    if (!rankings) return undefined;
    for (const rating of publicTierOrder) {
        const order = rankings[rating]?.indexOf(subjectId) ?? -1;
        if (order !== -1) return { rating, order };
    }
    return undefined;
};

export const hasExplicitStrongestRanking = (tierSlug: string): boolean => tierSlug in strongestRankings;
