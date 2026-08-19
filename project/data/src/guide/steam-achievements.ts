export interface SteamAchievementText {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly hidden: boolean;
}

type BinaryValue = string | number | bigint | BinaryObject;
interface BinaryObject {
  readonly [key: string]: BinaryValue;
}

class BinaryVdfReader {
  private offset = 0;
  private readonly input: Buffer;

  constructor(input: Buffer) {
    this.input = input;
  }

  private byte(): number {
    const value = this.input[this.offset];
    if (value === undefined) throw new Error("Steam achievement schema ended unexpectedly.");
    this.offset += 1;
    return value;
  }

  private cstring(): string {
    const end = this.input.indexOf(0, this.offset);
    if (end < 0) throw new Error("Steam achievement schema contains an unterminated string.");
    const value = this.input.toString("utf8", this.offset, end);
    this.offset = end + 1;
    return value;
  }

  private int32(): number {
    if (this.offset + 4 > this.input.length) throw new Error("Steam achievement schema ended inside an integer.");
    const value = this.input.readInt32LE(this.offset);
    this.offset += 4;
    return value;
  }

  private uint64(): bigint {
    if (this.offset + 8 > this.input.length) throw new Error("Steam achievement schema ended inside a uint64.");
    const value = this.input.readBigUInt64LE(this.offset);
    this.offset += 8;
    return value;
  }

  private float32(): number {
    if (this.offset + 4 > this.input.length) throw new Error("Steam achievement schema ended inside a float.");
    const value = this.input.readFloatLE(this.offset);
    this.offset += 4;
    return value;
  }

  object(stopAtEndMarker = true): BinaryObject {
    const output: Record<string, BinaryValue> = {};
    while (this.offset < this.input.length) {
      const type = this.byte();
      if (type === 8) {
        if (stopAtEndMarker) return output;
        continue;
      }
      const key = this.cstring();
      let value: BinaryValue;
      if (type === 0) value = this.object();
      else if (type === 1) value = this.cstring();
      else if (type === 2) value = this.int32();
      else if (type === 3) value = this.float32();
      else if (type === 6) value = this.int32();
      else if (type === 7) value = this.uint64();
      else throw new Error(`Unsupported Steam binary VDF value type ${type} at key ${key}.`);
      output[key] = value;
    }
    return output;
  }
}

function objectValue(value: BinaryValue | undefined): BinaryObject | undefined {
  return typeof value === "object" && value !== null ? value : undefined;
}

function collectAchievements(value: BinaryObject, output: Map<string, SteamAchievementText>): void {
  const id = typeof value.name === "string" ? value.name : undefined;
  const display = objectValue(value.display);
  const names = display === undefined ? undefined : objectValue(display.name);
  const descriptions = display === undefined ? undefined : objectValue(display.desc);
  const name = names?.english;
  const description = descriptions?.english;
  if (id?.startsWith("Ach") && typeof name === "string" && typeof description === "string") {
    if (output.has(id)) throw new Error(`Steam achievement schema repeats ${id}.`);
    output.set(id, { id, name, description, hidden: display?.hidden === 1 });
  }
  for (const child of Object.values(value)) {
    const childObject = objectValue(child);
    if (childObject !== undefined) collectAchievements(childObject, output);
  }
}

export function parseSteamAchievementSchema(input: Buffer): readonly SteamAchievementText[] {
  const document = new BinaryVdfReader(input).object(false);
  const achievements = new Map<string, SteamAchievementText>();
  collectAchievements(document, achievements);
  if (achievements.size === 0) throw new Error("Steam achievement schema contains no English Hades II achievements.");
  return [...achievements.values()].sort((left, right) => left.id.localeCompare(right.id, "en"));
}
