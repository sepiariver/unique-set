import equal from "fast-deep-equal/es6/index.js";

/** Utility functions */

export const serialize = (item: any | number | object): string => {
  if (typeof item === "number") {
    if (isNaN(item)) {
      return "NaN";
    }
    // We might decide we want to flag numeric strings vs numbers
    return String(item);
  }

  if (item && typeof item === "object") {
    if (Array.isArray(item)) {
      return `[${item.map(serialize).join(",")}]`;
    } else if (item instanceof Map) {
      return `${Array.from(item.entries())
        .sort(([a], [b]) => String(a).localeCompare(String(b)))
        .map(([k, v]) => `${serialize(k)}:${serialize(v)}`)
        .join(".")}`;
    } else if (item instanceof Set) {
      return `${Array.from(item.entries())
        .map(([k, v]) => `${serialize(k)}:${serialize(v)}`)
        .join("|")}`;
    } else {
      return `{${Object.entries(item)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}:${serialize(v)}`)
        .join(";")}}`;
    }
  }

  // Call toString on everything else, including Date, RegExp, undefined, null, etc.
  return String(item);
};

export const fnv1a = (str: string): number => {
  if (typeof str !== "string") {
    str = String(str);
  }
  let hash = 2166136261; // FNV offset basis for 32-bit
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 16777619) >>> 0; // Multiply by the FNV prime and ensure 32-bit unsigned
  }
  return hash >>> 0;
};

export const fnv1a64 = (str: string): bigint => {
  if (typeof str !== "string") {
    str = String(str);
  }
  const PRIME = BigInt(1099511628211); // Instantiate FNV 64-bit prime as BigInt
  let hash = BigInt(14695981039346656037); // FNV offset basis for 64-bit
  for (let i = 0; i < str.length; i++) {
    hash ^= BigInt(str.charCodeAt(i));
    hash *= PRIME;
  }
  return hash & BigInt("0xFFFFFFFFFFFFFFFF"); // Ensure it's 64-bit
};

export const findNextPrime = (num: number) => {
  if (num < 2) return 2;
  if ((num & 1) === 0) num++; // Odd numbers only

  while (!isPrime(num)) {
    num += 2; // Odd numbers only
  }

  return num;
};

const isPrime = (num: number): boolean => {
  if (num < 2) return false;
  if (num === 2 || num === 3) return true;
  if ((num & 1) === 0) return false;
  if (num % 3 === 0) return false;

  const sqrt = Math.sqrt(num);
  for (let i = 5; i <= sqrt; i += 6) {
    if (num % i === 0 || num % (i + 2) === 0) return false;
  }

  return true;
};

/** A `Set` extension that ensures uniqueness of items using deep equality checks. */
export class UniqueSet<T> extends Set<T> {
  /*** @throws TypeError If the input is not iterable. */
  constructor(iterable: Iterable<T> = []) {
    if (!Array.isArray(iterable) && !iterable[Symbol.iterator]) {
      throw new TypeError("UniqueSet requires an iterable");
    }
    super();
    for (const item of iterable) {
      this.add(item);
    }
  }
  /**
   * Determines whether an object is in the UniqueSet using deep equality.
   * @param o The object to check for presence in the UniqueSet.
   * @returns `true` if the object is found, `false` otherwise.
   */
  has(o: T): boolean {
    for (const i of this) {
      if (equal(o, i)) {
        return true;
      }
    }
    return false;
  }
  /**
   * Adds a new object to the UniqueSet if it is not already present.
   * @param o The object to add to the UniqueSet.
   * @returns The `UniqueSet` instance, allowing for chaining.
   */
  add(o: T): this {
    if (!this.has(o)) {
      super.add(o);
    }
    return this;
  }
}

/** A `Set` extension that uses a Bloom filter for fast existence checks combined with deep equality for accuracy. */
export class BloomSet<T> extends Set<T> {
  #bitArray: Uint8Array;
  #aSize: number;
  #hashCount: number;
  /**
   * Creates a new `BloomSet` instance.
   * @param iterable Optional: an iterable object with which to initialize the BloomSet.
   * @param options Bloom filter configuration options.
   * @param options.size The size of the Bloom filter's bit array. Defaults to 6553577.
   * @param options.hashCount The number of hash functions to use. Defaults to 7.
   * @throws TypeError If the input is not iterable.
   */
  constructor(
    iterable: Iterable<T> = [],
    options: { size?: number; hashCount?: number } = {}
  ) {
    if (!Array.isArray(iterable) && !iterable[Symbol.iterator]) {
      throw new TypeError("BloomSet requires an iterable");
    }
    super();

    if (!options || typeof options !== "object") {
      options = {};
    }

    options.hashCount ??= 7;
    options.size ??= 6553577;

    let { size, hashCount } = options;

    if (typeof size !== "number" || size <= 0) {
      size = 6553577; // Targeting < 1 collision per 100,000 elements, ~819 KB memory, needs 7 hashes
    }
    this.#aSize = findNextPrime(size);

    if (typeof hashCount !== "number" || hashCount <= 0) {
      hashCount = 7;
    }
    this.#hashCount = hashCount;
    this.#bitArray = new Uint8Array(Math.ceil(size / 8));

    for (const item of iterable) {
      this.add(item);
    }
  }

  /** @internal */
  #hashes(item: T) {
    const hashes: number[] = [];
    const str = serialize(item);
    let hash = fnv1a(str); // Base hash

    // Bloom into hashCount hash values
    for (let i = 0; i < this.#hashCount; i++) {
      hash %= this.#aSize; // Ensure within bounds
      // Track
      hashes.push(hash);
      // Modify
      hash = (hash ^ (hash >>> 13)) * 0xc2b2ae35;
      hash >>>= 0; // Ensure unsigned 32-bit integer
    }

    return hashes;
  }

  /** @internal */
  #setBits(hashes: number[]): void {
    for (const hash of hashes) {
      const index = Math.floor(hash / 8);
      const bit = hash % 8;
      this.#bitArray[index]! |= 1 << bit;
    }
  }

  /** @internal */
  #checkBits(hashes: number[]): boolean {
    for (const hash of hashes) {
      const index = Math.floor(hash / 8);
      const bit = hash % 8;
      if (!(this.#bitArray[index]! & (1 << bit))) {
        return false;
      }
    }
    return true;
  }
  /** Determines existence of an object in the BloomSet using the Bloom filter and deep equality */
  has(o: T): boolean {
    const hashes = this.#hashes(o);
    if (!this.#checkBits(hashes)) {
      return false; // Definitely not in the set
    }
    // Fall back to fast-deep-equal for false positives
    for (const i of this) {
      if (equal(o, i)) {
        return true;
      }
    }
    return false;
  }
  /** Adds a new object to the BloomSet if it is not already present.
   * @returns The `BloomSet` instance, allowing for chaining.
   */
  add(o: T): this {
    if (!this.has(o)) {
      const hashes = this.#hashes(o);
      this.#setBits(hashes);
      super.add(o);
    }
    return this;
  }
}

export class MapSet<T> {
  #map: Map<number | bigint, T>;
  #hashFn: (value: T) => number | bigint;

  constructor(
    iterable: Iterable<T> = [],
    options: { hashFunction?: (value: T) => number | bigint } = {}
  ) {
    const { hashFunction } = options;
    this.#map = new Map();
    this.#hashFn =
      hashFunction && typeof hashFunction === "function"
        ? hashFunction
        : (value) => fnv1a64(serialize(value));

    for (const item of iterable) {
      this.add(item);
    }
  }

  add(value: T): this {
    const hash = this.#hashFn(value);
    if (!this.#map.has(hash)) {
      this.#map.set(hash, value);
    }
    return this;
  }

  has(value: T): boolean {
    const hash = this.#hashFn(value);
    return this.#map.has(hash);
  }

  delete(value: T): boolean {
    const hash = this.#hashFn(value);
    return this.#map.delete(hash);
  }

  get size(): number {
    return this.#map.size;
  }

  clear(): void {
    this.#map.clear();
  }

  forEach(
    callback: (value: T, valueAgain: T, set: this) => void,
    thisArg?: any
  ): void {
    this.#map.forEach((value) => callback.call(thisArg, value, value, this));
  }

  *values(): IterableIterator<T> {
    yield* this.#map.values();
  }

  *[Symbol.iterator](): IterableIterator<T> {
    yield* this.values();
  }
}