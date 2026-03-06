import { deepEqual as equal } from "fast-equals";

/** 
 * Streaming structural hash — computes a 32-bit FNV-1a hash by traversing
 * the value directly, without allocating an intermediate string.
 */
const _f64 = new Float64Array(1);
const _u8 = new Uint8Array(_f64.buffer);

export const structuralHash = (value: unknown): number => {
  return _shash(value, 0x811c9dc5) >>> 0;
};

const _mix = (hash: number, byte: number): number => {
  return Math.imul(hash ^ byte, 0x01000193);
};

const _mixStr = (hash: number, str: string): number => {
  for (let i = 0; i < str.length; i++) {
    hash = Math.imul(hash ^ str.charCodeAt(i), 0x01000193);
  }
  return hash;
};

const _shash = (value: unknown, hash: number): number => {
  if (value === null) return _mix(hash, 0x00);
  if (value === undefined) return _mix(hash, 0x01);

  switch (typeof value) {
    case "boolean":
      return _mix(hash, value ? 0x03 : 0x02);
    case "number":
      hash = _mix(hash, 0x05);
      if (isNaN(value)) return _mix(hash, 0x04);
      if (value === 0) return _mix(hash, 0x30); // normalize 0 and -0
      _f64[0] = value;
      for (let i = 0; i < 8; i++) hash = _mix(hash, _u8[i]!);
      return hash;
    case "string":
      hash = _mix(hash, 0x06);
      return _mixStr(hash, value);
    case "bigint":
      hash = _mix(hash, 0x07);
      return _mixStr(hash, value.toString());
    case "function":
    case "symbol":
      hash = _mix(hash, 0x08);
      return _mixStr(hash, String(value));
    default:
      break;
  }

  if (Array.isArray(value)) {
    hash = _mix(hash, 0x10);
    for (let i = 0; i < value.length; i++) hash = _shash(value[i], hash);
    return hash;
  }
  if (value instanceof Map) {
    let mapHash = 0;
    for (const [k, v] of value) {
      let entryHash = _shash(k, 0x811c9dc5);
      entryHash = _shash(v, entryHash);
      mapHash = (mapHash + entryHash) | 0; // order-independent hash by summing entry hashes (32-bit)
    }
    return _mix(hash, mapHash);
  }
  if (value instanceof Set) {
    let setHash = 0;
    for (const v of value) {
      setHash = (setHash + _shash(v, 0x811c9dc5)) | 0; // order-independent hash by summing element hashes (32-bit)
    }
    return _mix(hash, setHash);
  }
  if (value instanceof Date) {
    hash = _mix(hash, 0x14);
    _f64[0] = value.getTime();
    for (let i = 0; i < 8; i++) hash = _mix(hash, _u8[i]!);
    return hash;
  }
  if (value instanceof RegExp) {
    hash = _mix(hash, 0x15);
    return _mixStr(hash, value.toString());
  }

  // Plain object: order-independent
  hash = _mix(hash, 0x13);
  let objHash = 0;
  const keys = Object.keys(value as object);
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]!;
    let pairHash = _mixStr(0x811c9dc5, key);
    pairHash = _shash((value as Record<string, unknown>)[key], pairHash);
    objHash = (objHash + pairHash) | 0;
  }

  return _mix(hash, objHash);
};

export class MapSet<T> {
  #map: Map<number, T[]>;
  #size: number;

  constructor(iterable: Iterable<T> = []) {
    if (!Array.isArray(iterable) && !iterable[Symbol.iterator]) {
      throw new TypeError("MapSet requires an iterable");
    }
    this.#map = new Map();
    this.#size = 0;
    for (const item of iterable) {
      this.add(item);
    }
  }

  add(value: T): this {
    const hash = structuralHash(value);
    const bucket = this.#map.get(hash);
    if (!bucket) {
      this.#map.set(hash, [value]);
      this.#size++;
    } else {
      for (const item of bucket) {
        if (equal(value, item)) return this;
      }
      bucket.push(value);
      this.#size++;
    }
    return this;
  }

  has(value: T): boolean {
    const hash = structuralHash(value);
    const bucket = this.#map.get(hash);
    if (!bucket) return false;
    for (const item of bucket) {
      if (equal(value, item)) return true;
    }
    return false;
  }

  delete(value: T): boolean {
    const hash = structuralHash(value);
    const bucket = this.#map.get(hash);
    if (!bucket) return false;
    for (let i = 0; i < bucket.length; i++) {
      if (equal(value, bucket[i])) {
        bucket.splice(i, 1);
        if (bucket.length === 0) this.#map.delete(hash);
        this.#size--;
        return true;
      }
    }
    return false;
  }

  get size(): number {
    return this.#size;
  }

  clear(): void {
    this.#map.clear();
    this.#size = 0;
  }

  forEach(
    callback: (value: T, valueAgain: T, set: this) => void,
    thisArg?: any
  ): void {
    for (const bucket of this.#map.values()) {
      for (const value of bucket) {
        callback.call(thisArg, value, value, this);
      }
    }
  }

  *values(): IterableIterator<T> {
    for (const bucket of this.#map.values()) {
      yield* bucket;
    }
  }

  *[Symbol.iterator](): IterableIterator<T> {
    yield* this.values();
  }
}

export { MapSet as UniqueSet };
