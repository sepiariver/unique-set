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

/**
 * Internal `Map` key. Signed, so on 64-bit V8 without pointer compression every key
 * is a small integer, where an unsigned key at or above 2^31 would be boxed as a heap
 * number. `structuralHash` stays unsigned because its output is public.
 */
const _key = (value: unknown): number => _shash(value, 0x811c9dc5) | 0;

/**
 * Values whose keys collide. Module-private, so no stored value can be a `Bucket`,
 * which makes `instanceof Bucket` a safe discriminator. Always holds two or more items.
 */
class Bucket<T> {
  items: T[];
  constructor(first: T, second: T) {
    this.items = [first, second];
  }
}

export class MapSet<T> {
  // A lone value is stored inline; a `Bucket` replaces it only on a key collision.
  #map: Map<number, T | Bucket<T>>;
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
    const key = _key(value);
    const slot = this.#map.get(key);
    // `get()` also returns `undefined` for a stored `undefined`, so confirm the miss.
    if (slot === undefined && !this.#map.has(key)) {
      this.#map.set(key, value);
    } else if (slot instanceof Bucket) {
      for (const item of slot.items) {
        if (equal(value, item)) return this;
      }
      slot.items.push(value);
    } else {
      if (equal(value, slot)) return this;
      this.#map.set(key, new Bucket(slot as T, value)); // `slot` may be a stored `undefined`
    }
    this.#size++;
    return this;
  }

  has(value: T): boolean {
    const key = _key(value);
    const slot = this.#map.get(key);
    if (slot instanceof Bucket) {
      for (const item of slot.items) {
        if (equal(value, item)) return true;
      }
      return false;
    }
    // Only `undefined` equals `undefined`, so the extra lookup is needed for that value alone.
    if (slot === undefined) return value === undefined && this.#map.has(key);
    return equal(value, slot);
  }

  delete(value: T): boolean {
    const key = _key(value);
    const slot = this.#map.get(key);
    if (slot instanceof Bucket) {
      const items = slot.items;
      for (let i = 0; i < items.length; i++) {
        if (equal(value, items[i])) {
          items.splice(i, 1);
          if (items.length === 1) this.#map.set(key, items[0]!);
          this.#size--;
          return true;
        }
      }
      return false;
    }
    if (slot === undefined ? value !== undefined || !this.#map.has(key) : !equal(value, slot)) {
      return false;
    }
    this.#map.delete(key);
    this.#size--;
    return true;
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
    for (const slot of this.#map.values()) {
      if (slot instanceof Bucket) {
        for (const value of slot.items) {
          callback.call(thisArg, value, value, this);
        }
      } else {
        callback.call(thisArg, slot, slot, this);
      }
    }
  }

  *values(): IterableIterator<T> {
    for (const slot of this.#map.values()) {
      if (slot instanceof Bucket) {
        yield* slot.items;
      } else {
        yield slot;
      }
    }
  }

  *[Symbol.iterator](): IterableIterator<T> {
    yield* this.values();
  }
}

export { MapSet as UniqueSet };
