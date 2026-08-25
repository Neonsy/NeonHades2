import type { SpoilerLevel } from "../contract/index.js";

export type EditorialRating = "S" | "A" | "B" | "C" | "D";

export type CombatFocus =
  "attack" | "cast" | "hex" | "omega" | "special" | "sprint";

export type BoonPrioritySlot = Exclude<CombatFocus, "hex">;

export type BuildGoal = "safest" | "strongest";

export interface EditorialReference {
  readonly recordType: string;
  readonly id: string;
}

export interface EditorialContext {
  readonly steamBuildId: string;
  readonly executableVersion: string;
  readonly packageVersion: string;
  readonly reader: "new-player";
  readonly progressionStage: string;
  readonly route: "any" | "underworld" | "surface";
  readonly aspectId?: string;
}

export interface ProgressionStageSource {
  readonly id: string;
  readonly order: number;
  readonly title: string;
  readonly endpoint:
    | "first-route-clear"
    | "main-story"
    | "true-ending"
    | "practical-postgame"
    | "exhaustive-completion";
  readonly spoilerLevel: SpoilerLevel;
  readonly readerKnowledge: readonly string[];
  readonly nextObjective: string;
  readonly reason: string;
  readonly actionSequence: readonly string[];
  readonly purchaseUpgradePriorities: readonly string[];
  readonly resourcePolicy: readonly string[];
  readonly loadoutReferences: readonly EditorialReference[];
  readonly priorityReferences: readonly ProgressionPriority[];
  readonly boonEncounterPriorities: readonly string[];
  readonly parallelObjectiveReferences: readonly EditorialReference[];
  readonly routeLateGame: readonly string[];
  readonly completionChecklist: readonly string[];
  readonly completionReferences: readonly EditorialReference[];
  readonly fallback: string;
}

export interface AspectBuildPlan {
  readonly focuses: readonly CombatFocus[];
  /** Rank all five core slots for this plan's stated goal. */
  readonly boonPriorityOrder: readonly BoonPrioritySlot[];
  readonly strengths: readonly string[];
  readonly weaknesses: readonly string[];
  readonly combatSequence: readonly string[];
  readonly arcanaIds: readonly string[];
  /** The first core Boon for each slot is the preferred package. The first array item also selects the opening god keepsake. */
  readonly primaryBoonIds: readonly string[];
  readonly fallbackBoonIds: readonly string[];
  readonly boonReasons: Readonly<Record<string, string>>;
  readonly familiarId: string;
  readonly hexId: string;
  readonly contextRatings: Readonly<
    Record<"consistency" | "speed" | "safety" | "high-fear", EditorialRating>
  >;
  readonly bossConsideration: string;
  readonly routeConsideration: string;
}

export interface AspectProfile extends AspectBuildPlan {
  readonly aspectId: string;
  readonly beginnerDifficulty: 1 | 2 | 3 | 4 | 5;
  readonly rankOneEvaluation: string;
  readonly maximumRankEvaluation: string;
  readonly safest: AspectBuildPlan;
}

export interface EditorialJudgment {
  readonly recommendation: string;
  readonly reason: string;
  readonly limitation: string;
  readonly prerequisiteReferences: readonly EditorialReference[];
  readonly fallback: string;
  readonly verificationNotes: string;
}

export interface ProgressionStageRecord extends EditorialJudgment {
  readonly recordType: "editorial/progression-stage";
  readonly id: string;
  readonly order: number;
  readonly title: string;
  readonly endpoint: ProgressionStageSource["endpoint"];
  readonly spoilerLevel: SpoilerLevel;
  readonly context: EditorialContext;
  readonly readerKnowledge: readonly string[];
  readonly actionSequence: readonly string[];
  readonly purchaseUpgradePriorities: readonly string[];
  readonly resourcePolicy: readonly string[];
  readonly loadoutReferences: readonly EditorialReference[];
  readonly priorityReferences: readonly ProgressionPriority[];
  readonly boonEncounterPriorities: readonly string[];
  readonly parallelObjectiveReferences: readonly EditorialReference[];
  readonly routeLateGame: readonly string[];
  readonly completionChecklist: readonly string[];
  readonly completionReferences: readonly EditorialReference[];
}

export interface RatedReference {
  readonly reference: EditorialReference;
  readonly rating: EditorialRating;
  readonly reason: string;
  readonly limitation: string;
  readonly prerequisiteReferences: readonly EditorialReference[];
}

export interface BuildTargetReference extends RatedReference {
  /** Exact prerequisite alternatives, preserving the game's one-from-each-group structure. */
  readonly requirementGroups: readonly (readonly EditorialReference[])[];
  /** One compatible selection from the authored plan, not every possible prerequisite. */
  readonly selectedPrerequisites: readonly EditorialReference[];
  readonly requirementSummary: string;
}

export interface BuildPowerBreakpoint {
  readonly stage: "foundation" | "online" | "power-spike";
  readonly title: string;
  readonly condition: string;
  readonly effect: string;
  readonly references: readonly EditorialReference[];
}

export interface ContextRating {
  readonly context: "consistency" | "speed" | "safety" | "high-fear";
  readonly rating: EditorialRating;
  readonly reason: string;
  readonly limitation: string;
}

export interface ArcanaRecommendation extends RatedReference {
  readonly role: "core" | "support";
}

export interface RewardPriority {
  readonly order: number;
  readonly reward:
    | "core-boon"
    | "magick-recovery"
    | "hammer"
    | "maximum-life"
    | "pom"
    | "duo-legendary";
  readonly reason: string;
}

export interface RewardDecisionRule {
  readonly condition: string;
  readonly choose:
    | "core-boon"
    | "magick-recovery"
    | "hammer"
    | "maximum-life"
    | "pom"
    | "duo-legendary"
    | "permanent-resource";
  readonly over: readonly RewardDecisionRule["choose"][];
  readonly reason: string;
}

export interface BuildInteraction {
  readonly kind: "synergy" | "conflict";
  readonly references: readonly EditorialReference[];
  readonly reason: string;
  readonly condition: string;
}

export type KeepsakeLifecycle =
  "persistent" | "limited-use" | "timed" | "decaying" | "depleting";

export interface ProgressionPriority {
  readonly order: number;
  readonly timing: "now" | "when-available" | "after-core" | "optional";
  readonly required: boolean;
  readonly reference: EditorialReference;
  readonly reason: string;
}

export interface UpgradeConflict {
  readonly references: readonly EditorialReference[];
  readonly reason: string;
}

export interface AspectGuideRecord extends EditorialJudgment {
  readonly recordType: "editorial/aspect-guide";
  readonly id: string;
  readonly aspectReference: EditorialReference;
  readonly context: EditorialContext;
  readonly rankEvaluations: readonly {
    readonly rank: "rank-one" | "maximum";
    readonly rating: EditorialRating;
    readonly reason: string;
    readonly limitation: string;
  }[];
  readonly overallRating: EditorialRating;
  readonly overallReason: string;
  readonly overallLimitation: string;
  readonly strengths: readonly string[];
  readonly weaknesses: readonly string[];
  readonly beginnerDifficulty: number;
  readonly playstyleCombatSequence: readonly string[];
  readonly powerBreakpoints: readonly BuildPowerBreakpoint[];
  readonly arcanaLoadout: readonly ArcanaRecommendation[];
  readonly arcanaGraspCost: number;
  readonly arcanaConstraint: string;
  readonly keepsakeRoute: readonly {
    readonly stage: "opening" | "later-region" | "final-region";
    readonly reference: EditorialReference;
    readonly reason: string;
    readonly switchCondition: string;
    readonly lifecycle: KeepsakeLifecycle;
  }[];
  readonly familiarHex: readonly RatedReference[];
  readonly boonPriorities: readonly {
    readonly slot: BoonPrioritySlot;
    readonly role: "core" | "support";
    readonly preferred: readonly RatedReference[];
    readonly fallback: readonly RatedReference[];
  }[];
  readonly boonRankings: readonly RatedReference[];
  readonly duoLegendaryTargets: readonly BuildTargetReference[];
  readonly hammerRankings: readonly RatedReference[];
  readonly buildInteractions: readonly BuildInteraction[];
  readonly rewardPriorities: readonly RewardPriority[];
  readonly rewardDecisionRules: readonly RewardDecisionRule[];
  readonly conflicts: readonly string[];
  readonly upgradeConflicts: readonly UpgradeConflict[];
  readonly bossRouteConsiderations: readonly string[];
  readonly contextRatings: readonly ContextRating[];
  readonly buildVariants: Readonly<Record<BuildGoal, AspectBuildVariantRecord>>;
}

export interface AspectBuildVariantRecord extends EditorialJudgment {
  readonly goal: BuildGoal;
  readonly overallRating: EditorialRating;
  readonly overallReason: string;
  readonly overallLimitation: string;
  readonly strengths: readonly string[];
  readonly weaknesses: readonly string[];
  readonly playstyleCombatSequence: readonly string[];
  readonly powerBreakpoints: readonly BuildPowerBreakpoint[];
  readonly arcanaLoadout: readonly ArcanaRecommendation[];
  readonly arcanaGraspCost: number;
  readonly arcanaConstraint: string;
  readonly keepsakeRoute: AspectGuideRecord["keepsakeRoute"];
  readonly familiarHex: readonly RatedReference[];
  readonly boonPriorities: AspectGuideRecord["boonPriorities"];
  readonly boonRankings: readonly RatedReference[];
  readonly duoLegendaryTargets: readonly BuildTargetReference[];
  readonly hammerRankings: readonly RatedReference[];
  readonly buildInteractions: readonly BuildInteraction[];
  readonly rewardPriorities: readonly RewardPriority[];
  readonly rewardDecisionRules: readonly RewardDecisionRule[];
  readonly conflicts: readonly string[];
  readonly upgradeConflicts: readonly UpgradeConflict[];
  readonly bossRouteConsiderations: readonly string[];
  readonly contextRatings: readonly ContextRating[];
}

export interface BoonRatingRecord extends EditorialJudgment {
  readonly recordType: "editorial/boon-rating";
  readonly id: string;
  readonly subjectReference: EditorialReference;
  readonly context: EditorialContext;
  readonly rating: EditorialRating;
  readonly evaluationDimension: "general-value";
}

export interface WeaponGuideRecord extends EditorialJudgment {
  readonly recordType: "editorial/weapon-guide";
  readonly id: string;
  readonly weaponReference: EditorialReference;
  readonly context: EditorialContext;
  readonly overallRating: EditorialRating;
  readonly overallReason: string;
  readonly aspectReferences: readonly EditorialReference[];
  readonly boonRankings: readonly RatedReference[];
  readonly contextRatings: readonly ContextRating[];
}

export interface TierRatingRecord extends EditorialJudgment {
  readonly recordType:
    | "editorial/arcana-rating"
    | "editorial/familiar-rating"
    | "editorial/hex-rating";
  readonly id: string;
  readonly subjectReference: EditorialReference;
  readonly context: EditorialContext;
  readonly rating: EditorialRating;
  readonly evaluationDimension: "new-player-value";
  readonly recommendedByAspectCount: number;
  readonly aspectCount: number;
}

export interface TierProfile {
  readonly id: string;
  readonly rating: EditorialRating;
  readonly recommendation: string;
  readonly reason: string;
  readonly limitation: string;
  readonly fallback: string;
}

export interface PageDefinition {
  readonly id: string;
  readonly pageKind: "progression" | "reference" | "tier-list";
  readonly title: string;
  readonly sourceRecordTypes: readonly string[];
  readonly aliases: readonly string[];
  readonly spoilerLevel: SpoilerLevel;
}

export interface KeepsakePriorityRecord extends EditorialJudgment {
  readonly recordType: "mechanics/keepsake";
  readonly id: string;
  readonly subjectReference: EditorialReference;
  readonly context: EditorialContext;
  readonly priority: EditorialRating;
  readonly lifecycle: KeepsakeLifecycle;
  readonly switchWhenInactive: string;
}

export interface ResourceAdviceRecord extends EditorialJudgment {
  readonly recordType: "mechanics/resource";
  readonly id: string;
  readonly subjectReference: EditorialReference;
  readonly context: EditorialContext;
  readonly policy: "reserve" | "spend-for-next-target" | "optional";
  readonly priority: EditorialRating;
  readonly earliestRecommendedStage:
    ProgressionStageSource["endpoint"] | "unprioritized";
  readonly recommendedUseReferences: readonly EditorialReference[];
}

export interface SearchAliasRecord {
  readonly recordType: "foundation/record-metadata";
  readonly id: string;
  readonly subjectReference: EditorialReference;
  readonly aliases: readonly string[];
}

export interface EditorialDataset {
  readonly schema: "neodes2-editorial-1";
  readonly source: {
    readonly datasetAcquisitionId: string;
    readonly datasetSha256: string;
    readonly dataReadyAcquisitionId: string;
    readonly verificationAcquisitionId: string;
    readonly steamBuildId: string;
    readonly executableVersion: string;
    readonly packageVersion: string;
  };
  readonly progressionStages: readonly ProgressionStageRecord[];
  readonly pageDefinitions: readonly PageDefinition[];
  readonly weaponGuides: readonly WeaponGuideRecord[];
  readonly aspectGuides: readonly AspectGuideRecord[];
  readonly boonRatings: readonly BoonRatingRecord[];
  readonly arcanaRatings: readonly TierRatingRecord[];
  readonly familiarRatings: readonly TierRatingRecord[];
  readonly hexRatings: readonly TierRatingRecord[];
  readonly keepsakePriorities: readonly KeepsakePriorityRecord[];
  readonly resourceAdvice: readonly ResourceAdviceRecord[];
  readonly searchAliases: readonly SearchAliasRecord[];
}

export interface ContentReport {
  readonly schema: "neodes2-content-report-1";
  readonly sourceDatasetAcquisitionId: string;
  readonly counts: {
    readonly progressionStages: number;
    readonly pageDefinitions: number;
    readonly weaponGuides: number;
    readonly aspectGuides: number;
    readonly boonRatings: number;
    readonly arcanaRatings: number;
    readonly familiarRatings: number;
    readonly hexRatings: number;
    readonly keepsakePriorities: number;
    readonly resourceAdvice: number;
    readonly searchAliases: number;
  };
  readonly missingReferences: readonly string[];
  readonly missingAliases: readonly string[];
  readonly orphanRecordIds: readonly string[];
  readonly requiredPagesWithoutEditorialCoverage: readonly string[];
  readonly duplicateRecordIds: readonly string[];
  readonly invalidEditorialRecords: readonly string[];
  readonly complete: boolean;
}

export interface EditorialBuildOptions {
  readonly datasetDirectory: string;
  readonly dataReadyDirectory: string;
  readonly outputRoot: string;
  readonly now?: () => Date;
}

export interface EditorialBuildResult {
  readonly acquisitionId: string;
  readonly directory: string;
  readonly editorialSha256: string;
  readonly reportSha256: string;
  readonly dataset: EditorialDataset;
  readonly report: ContentReport;
}
