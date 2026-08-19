import type { JsonObject, JsonValue } from "../boons/index.js";
import type { CombinedDataset, VerifiedCombinedDataset } from "../dataset/index.js";

export const observationKinds = [
  "session-start",
  "control-pressed",
  "control-released",
  "weapon-charging",
  "weapon-charge-canceled",
  "perfect-charge-window",
  "weapon-fired",
  "projectile-created",
  "projectile-death",
  "hit",
  "effect-applied",
  "effect-cleared",
  "effect-stack-decreased",
] as const;

export type ObservationKind = typeof observationKinds[number];

export interface ObservationIdentity {
  readonly observerVersion: string;
  readonly sourceAcquisitionId: string;
  readonly sourceManifestSha256: string;
  readonly datasetAcquisitionId: string;
  readonly datasetSha256: string;
  readonly steamBuildId: string;
  readonly executableVersion: string;
  readonly packageVersion: string;
}

export interface ObservationContext {
  readonly roomId?: string;
  readonly roomSetId?: string;
  readonly equippedWeaponId?: string;
  readonly activeAspectId?: string;
  readonly traitIds: readonly string[];
  readonly weaponIds: readonly string[];
  readonly health?: number;
  readonly maxHealth?: number;
  readonly mana?: number;
  readonly maxMana?: number;
}

export type ObservationEventData = Readonly<Record<string, string | number | boolean>>;

export interface ObservationEvent {
  readonly schema: "neodes2-observation-event-1";
  readonly sequence: number;
  readonly kind: ObservationKind;
  readonly worldTime?: number;
  readonly worldTimeUnmodified?: number;
  readonly context: ObservationContext;
  readonly event: ObservationEventData;
  readonly identity?: ObservationIdentity;
}

export interface ObservationTrace {
  readonly identity: ObservationIdentity;
  readonly events: readonly ObservationEvent[];
}

export interface TargetObservation {
  readonly targetId: string;
  readonly eventCount: number;
  readonly firstSequence: number;
  readonly lastSequence: number;
  readonly eventKinds: readonly ObservationKind[];
  readonly sampleSequences: readonly number[];
}

export interface ObservationCandidateSet {
  readonly targetSetId: "core-combat-mechanics" | "enemies" | "hexes" | "status-elements" | "weapon-aspects";
  readonly observed: readonly TargetObservation[];
  readonly missingTargetIds: readonly string[];
}

export interface ObservationEvidenceReport {
  readonly schema: "neodes2-observation-evidence-1";
  readonly observerVersion: string;
  readonly sourceDatasetAcquisitionId: string;
  readonly sourceDatasetSha256: string;
  readonly eventCount: number;
  readonly firstWorldTime: number | null;
  readonly lastWorldTime: number | null;
  readonly eventKindCounts: Readonly<Record<ObservationKind, number>>;
  readonly candidates: readonly ObservationCandidateSet[];
}

const topLevelFields = [
  "schema",
  "sequence",
  "kind",
  "worldTime",
  "worldTimeUnmodified",
  "context",
  "event",
  "identity",
] as const;
const contextFields = [
  "roomId",
  "roomSetId",
  "equippedWeaponId",
  "activeAspectId",
  "traitIds",
  "weaponIds",
  "health",
  "maxHealth",
  "mana",
  "maxMana",
] as const;
const identityFields = [
  "observerVersion",
  "sourceAcquisitionId",
  "sourceManifestSha256",
  "datasetAcquisitionId",
  "datasetSha256",
  "steamBuildId",
  "executableVersion",
  "packageVersion",
] as const;
const eventFields = [
  "controlId",
  "triggerName",
  "weaponId",
  "projectileId",
  "projectileInstanceId",
  "projectileVolley",
  "projectileCount",
  "ammo",
  "perfectCharge",
  "chargeStage",
  "postFire",
  "damageAmount",
  "effectId",
  "stacks",
  "reapplied",
  "exists",
  "actorId",
  "actorName",
  "actorIsHero",
  "targetId",
  "targetName",
  "targetIsHero",
] as const;

function asRecord(value: unknown, label: string): Readonly<Record<string, unknown>> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Readonly<Record<string, unknown>>;
}

function assertKeys(record: Readonly<Record<string, unknown>>, allowed: readonly string[], label: string): void {
  const unexpected = Object.keys(record).filter((field) => !allowed.includes(field));
  if (unexpected.length > 0) throw new Error(`${label} has unexpected field ${unexpected.sort().join(", ")}.`);
}

function stringValue(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${label} must be a nonempty string.`);
  return value;
}

function optionalString(value: unknown, label: string): string | undefined {
  return value === undefined ? undefined : stringValue(value, label);
}

function numberValue(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${label} must be a finite number.`);
  return value;
}

function optionalNumber(value: unknown, label: string): number | undefined {
  return value === undefined ? undefined : numberValue(value, label);
}

function stringArray(value: unknown, label: string): readonly string[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`);
  const strings = value.map((entry, index) => stringValue(entry, `${label}[${index}]`));
  if (new Set(strings).size !== strings.length) throw new Error(`${label} must not repeat a value.`);
  if (strings.some((entry, index) => entry !== strings.toSorted()[index])) throw new Error(`${label} must be sorted.`);
  return strings;
}

function parseIdentity(value: unknown, label: string): ObservationIdentity {
  const record = asRecord(value, label);
  assertKeys(record, identityFields, label);
  return {
    observerVersion: stringValue(record.observerVersion, `${label}.observerVersion`),
    sourceAcquisitionId: stringValue(record.sourceAcquisitionId, `${label}.sourceAcquisitionId`),
    sourceManifestSha256: stringValue(record.sourceManifestSha256, `${label}.sourceManifestSha256`),
    datasetAcquisitionId: stringValue(record.datasetAcquisitionId, `${label}.datasetAcquisitionId`),
    datasetSha256: stringValue(record.datasetSha256, `${label}.datasetSha256`),
    steamBuildId: stringValue(record.steamBuildId, `${label}.steamBuildId`),
    executableVersion: stringValue(record.executableVersion, `${label}.executableVersion`),
    packageVersion: stringValue(record.packageVersion, `${label}.packageVersion`),
  };
}

function parseContext(value: unknown, label: string): ObservationContext {
  const record = asRecord(value, label);
  assertKeys(record, contextFields, label);
  return {
    ...(optionalString(record.roomId, `${label}.roomId`) === undefined ? {} : { roomId: stringValue(record.roomId, `${label}.roomId`) }),
    ...(optionalString(record.roomSetId, `${label}.roomSetId`) === undefined ? {} : { roomSetId: stringValue(record.roomSetId, `${label}.roomSetId`) }),
    ...(optionalString(record.equippedWeaponId, `${label}.equippedWeaponId`) === undefined ? {} : { equippedWeaponId: stringValue(record.equippedWeaponId, `${label}.equippedWeaponId`) }),
    ...(optionalString(record.activeAspectId, `${label}.activeAspectId`) === undefined ? {} : { activeAspectId: stringValue(record.activeAspectId, `${label}.activeAspectId`) }),
    traitIds: stringArray(record.traitIds, `${label}.traitIds`),
    weaponIds: stringArray(record.weaponIds, `${label}.weaponIds`),
    ...(optionalNumber(record.health, `${label}.health`) === undefined ? {} : { health: numberValue(record.health, `${label}.health`) }),
    ...(optionalNumber(record.maxHealth, `${label}.maxHealth`) === undefined ? {} : { maxHealth: numberValue(record.maxHealth, `${label}.maxHealth`) }),
    ...(optionalNumber(record.mana, `${label}.mana`) === undefined ? {} : { mana: numberValue(record.mana, `${label}.mana`) }),
    ...(optionalNumber(record.maxMana, `${label}.maxMana`) === undefined ? {} : { maxMana: numberValue(record.maxMana, `${label}.maxMana`) }),
  };
}

function parseEventData(value: unknown, label: string): ObservationEventData {
  const record = asRecord(value, label);
  assertKeys(record, eventFields, label);
  const result: Record<string, string | number | boolean> = {};
  for (const [field, entry] of Object.entries(record)) {
    if (typeof entry === "string") result[field] = stringValue(entry, `${label}.${field}`);
    else if (typeof entry === "number") result[field] = numberValue(entry, `${label}.${field}`);
    else if (typeof entry === "boolean") result[field] = entry;
    else throw new Error(`${label}.${field} must be a scalar.`);
  }
  return result;
}

function requiredEventString(event: ObservationEventData, field: string, label: string): void {
  if (typeof event[field] !== "string") throw new Error(`${label}.${field} is required for this event kind.`);
}

function validateKindFields(kind: ObservationKind, event: ObservationEventData, label: string): void {
  if (kind === "session-start") {
    if (Object.keys(event).length !== 0) throw new Error(`${label} must be empty for session-start.`);
  } else if (kind === "control-pressed" || kind === "control-released") {
    requiredEventString(event, "controlId", label);
    if (!["Attack1", "Attack2", "Attack3", "Rush", "Shout"].includes(String(event.controlId))) {
      throw new Error(`${label}.controlId is unsupported.`);
    }
  } else if (["weapon-charging", "weapon-charge-canceled", "perfect-charge-window", "weapon-fired"].includes(kind)) {
    requiredEventString(event, "weaponId", label);
  } else if (kind === "projectile-created" || kind === "projectile-death") {
    requiredEventString(event, "projectileId", label);
  } else if (kind === "hit") {
    if (event.targetId === undefined && event.targetName === undefined) {
      throw new Error(`${label} requires targetId or targetName.`);
    }
  } else {
    requiredEventString(event, "effectId", label);
  }
}

function parseEvent(value: unknown, index: number): ObservationEvent {
  const label = `observation line ${index + 1}`;
  const record = asRecord(value, label);
  assertKeys(record, topLevelFields, label);
  if (record.schema !== "neodes2-observation-event-1") throw new Error(`${label}.schema is unsupported.`);
  if (typeof record.sequence !== "number" || !Number.isSafeInteger(record.sequence) || record.sequence < 0) {
    throw new Error(`${label}.sequence must be a nonnegative safe integer.`);
  }
  if (typeof record.kind !== "string" || !observationKinds.includes(record.kind as ObservationKind)) {
    throw new Error(`${label}.kind is unsupported.`);
  }
  const kind = record.kind as ObservationKind;
  const event = parseEventData(record.event, `${label}.event`);
  validateKindFields(kind, event, `${label}.event`);
  const worldTime = optionalNumber(record.worldTime, `${label}.worldTime`);
  const worldTimeUnmodified = optionalNumber(record.worldTimeUnmodified, `${label}.worldTimeUnmodified`);
  return {
    schema: "neodes2-observation-event-1",
    sequence: record.sequence,
    kind,
    ...(worldTime === undefined ? {} : { worldTime }),
    ...(worldTimeUnmodified === undefined ? {} : { worldTimeUnmodified }),
    context: parseContext(record.context, `${label}.context`),
    event,
    ...(record.identity === undefined ? {} : { identity: parseIdentity(record.identity, `${label}.identity`) }),
  };
}

export function parseObservationTrace(content: Buffer): ObservationTrace {
  if (content.length === 0) throw new Error("Observation trace is empty.");
  if (content.length > 128 * 1024 * 1024) throw new Error("Observation trace exceeds 128 MiB.");
  const text = content.toString("utf8");
  if (!text.endsWith("\n")) throw new Error("Observation trace ends with a partial line.");
  const lines = text.slice(0, -1).split("\n");
  if (lines.length > 500_000) throw new Error("Observation trace exceeds 500000 events.");
  const events = lines.map((line, index) => {
    if (Buffer.byteLength(line, "utf8") > 256 * 1024) throw new Error(`Observation line ${index + 1} exceeds 256 KiB.`);
    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch (error) {
      throw new Error(`Observation line ${index + 1} is not valid JSON.`, { cause: error });
    }
    return parseEvent(value, index);
  });
  if (events[0]?.kind !== "session-start" || events[0].identity === undefined) {
    throw new Error("Observation trace must begin with an identified session-start event.");
  }
  let previousWorldTime: number | undefined;
  for (const [index, event] of events.entries()) {
    if (event.sequence !== index) throw new Error(`Observation sequence ${event.sequence} is not contiguous at line ${index + 1}.`);
    if (index > 0 && event.identity !== undefined) throw new Error(`Observation line ${index + 1} repeats session identity.`);
    if (event.worldTimeUnmodified !== undefined) {
      if (previousWorldTime !== undefined && event.worldTimeUnmodified < previousWorldTime) {
        throw new Error(`Observation line ${index + 1} moves backward in unmodified world time.`);
      }
      previousWorldTime = event.worldTimeUnmodified;
    }
  }
  return { identity: events[0].identity, events };
}

export function assertTraceMatchesDataset(trace: ObservationTrace, dataset: VerifiedCombinedDataset): void {
  const expected: ObservationIdentity = {
    observerVersion: "0.1.0",
    sourceAcquisitionId: dataset.dataset.source.acquisitionId,
    sourceManifestSha256: dataset.dataset.source.sourceManifestSha256,
    datasetAcquisitionId: dataset.acquisitionId,
    datasetSha256: dataset.datasetSha256,
    steamBuildId: dataset.dataset.source.steamBuildId,
    executableVersion: dataset.dataset.source.executableVersion,
    packageVersion: dataset.dataset.source.packageVersion,
  };
  for (const field of identityFields) {
    if (trace.identity[field] !== expected[field]) {
      throw new Error(`Observation ${field} does not match the combined dataset.`);
    }
  }
}

interface MutableObservation {
  count: number;
  first: number;
  last: number;
  kinds: Set<ObservationKind>;
  samples: number[];
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function object(value: JsonValue | undefined): JsonObject | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonObject : undefined;
}

function stringList(value: JsonValue | undefined): readonly string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function combatEvent(event: ObservationEvent): boolean {
  return !["session-start", "control-pressed", "control-released"].includes(event.kind);
}

export function summarizeObservationTrace(trace: ObservationTrace, dataset: CombinedDataset): ObservationEvidenceReport {
  const targetIds = {
    "core-combat-mechanics": ["attack", "cast", "dash", "hex", "magick", "omega", "special", "sprint"],
    enemies: dataset.domains.guide.enemies.map((entry) => entry.id),
    hexes: dataset.domains.loadouts.hexes.map((entry) => entry.id),
    "status-elements": dataset.domains.guide.statusElements.map((entry) => entry.id),
    "weapon-aspects": dataset.domains.weapons.aspects.map((entry) => entry.id),
  } as const;
  const known = {
    "core-combat-mechanics": new Set<string>(targetIds["core-combat-mechanics"]),
    enemies: new Set<string>(targetIds.enemies),
    hexes: new Set<string>(targetIds.hexes),
    "status-elements": new Set<string>(targetIds["status-elements"]),
    "weapon-aspects": new Set<string>(targetIds["weapon-aspects"]),
  };
  const observations = new Map<string, MutableObservation>();
  const record = (setId: keyof typeof targetIds, targetId: string, event: ObservationEvent): void => {
    if (!known[setId].has(targetId)) return;
    const key = `${setId}\u0000${targetId}`;
    const current = observations.get(key) ?? {
      count: 0,
      first: event.sequence,
      last: event.sequence,
      kinds: new Set<ObservationKind>(),
      samples: [],
    };
    current.count += 1;
    current.last = event.sequence;
    current.kinds.add(event.kind);
    if (current.samples.length < 25) current.samples.push(event.sequence);
    observations.set(key, current);
  };
  const hexes = dataset.domains.loadouts.hexes.map((hex) => {
    const mechanics = object(hex.mechanics);
    const preEquipWeapons = stringList(mechanics?.PreEquipWeapons);
    return { id: hex.id, traitId: hex.traitId, weaponIds: new Set([...preEquipWeapons, `WeaponSpell${hex.id}`]) };
  });
  const statusById = new Map(dataset.domains.guide.statusElements.map((entry) => [entry.id, entry]));
  const enemyIds = known.enemies;
  const eventKindCounts = Object.fromEntries(observationKinds.map((kind) => [kind, 0])) as Record<ObservationKind, number>;
  for (const event of trace.events) {
    eventKindCounts[event.kind] = (eventKindCounts[event.kind] ?? 0) + 1;
    const eventData = event.event;
    const involvesHero = eventData.actorIsHero === true || eventData.targetIsHero === true;
    if (combatEvent(event) && involvesHero && event.context.activeAspectId !== undefined) {
      record("weapon-aspects", event.context.activeAspectId, event);
    }
    const controlId = typeof eventData.controlId === "string" ? eventData.controlId : undefined;
    const controlTarget = controlId === "Attack1" ? "attack"
      : controlId === "Attack2" ? "special"
      : controlId === "Attack3" ? "cast"
      : controlId === "Rush" ? "dash"
      : controlId === "Shout" ? "hex"
      : undefined;
    if (controlTarget !== undefined) record("core-combat-mechanics", controlTarget, event);
    const weaponId = typeof eventData.weaponId === "string" ? eventData.weaponId : undefined;
    if (weaponId === "WeaponSprint") record("core-combat-mechanics", "sprint", event);
    if (weaponId?.startsWith("WeaponCast") === true) record("core-combat-mechanics", "cast", event);
    if (weaponId?.startsWith("WeaponSpell") === true) {
      record("core-combat-mechanics", "hex", event);
      record("core-combat-mechanics", "magick", event);
    }
    const heroOmegaCandidate = eventData.actorIsHero === true && (
      event.kind === "perfect-charge-window" ||
      (event.kind === "weapon-charging" && weaponId !== undefined && !["WeaponBlink", "WeaponSprint"].includes(weaponId)) ||
      (typeof eventData.chargeStage === "number" && eventData.chargeStage > 0) ||
      eventData.perfectCharge === true
    );
    if (heroOmegaCandidate) {
      record("core-combat-mechanics", "omega", event);
      record("core-combat-mechanics", "magick", event);
    }
    for (const hex of hexes) {
      const active = event.context.traitIds.includes(hex.traitId);
      if (active && (controlId === "Shout" || (weaponId !== undefined && hex.weaponIds.has(weaponId)))) {
        record("hexes", hex.id, event);
      }
    }
    const effectId = typeof eventData.effectId === "string" ? eventData.effectId : undefined;
    if (effectId !== undefined && statusById.get(effectId)?.classification === "effect") {
      record("status-elements", effectId, event);
    }
    if (combatEvent(event)) {
      for (const traitId of event.context.traitIds) {
        if (statusById.get(traitId)?.classification === "element-or-infusion") {
          record("status-elements", traitId, event);
        }
      }
    }
    for (const name of [eventData.actorName, eventData.targetName]) {
      if (typeof name === "string" && enemyIds.has(name)) record("enemies", name, event);
    }
  }
  const candidates = (Object.keys(targetIds) as (keyof typeof targetIds)[]).map((setId) => {
    const observed = targetIds[setId].flatMap((targetId): TargetObservation[] => {
      const value = observations.get(`${setId}\u0000${targetId}`);
      return value === undefined ? [] : [{
        targetId,
        eventCount: value.count,
        firstSequence: value.first,
        lastSequence: value.last,
        eventKinds: [...value.kinds].sort(compareStrings),
        sampleSequences: value.samples,
      }];
    });
    const observedIds = new Set(observed.map((entry) => entry.targetId));
    return {
      targetSetId: setId,
      observed,
      missingTargetIds: targetIds[setId].filter((targetId) => !observedIds.has(targetId)),
    } satisfies ObservationCandidateSet;
  });
  const timed = trace.events.flatMap((event) => event.worldTimeUnmodified === undefined ? [] : [event.worldTimeUnmodified]);
  return {
    schema: "neodes2-observation-evidence-1",
    observerVersion: trace.identity.observerVersion,
    sourceDatasetAcquisitionId: trace.identity.datasetAcquisitionId,
    sourceDatasetSha256: trace.identity.datasetSha256,
    eventCount: trace.events.length,
    firstWorldTime: timed[0] ?? null,
    lastWorldTime: timed.at(-1) ?? null,
    eventKindCounts,
    candidates,
  };
}
