// index.ts
import equal from "fast-deep-equal/es6/index.js";
var serialize = (item) => {
  if (typeof item === "number" && isNaN(item)) {
    return "NaN";
  }
  if (item && typeof item === "object") {
    if (Array.isArray(item)) {
      return `[${item.map(serialize).join("")}]`;
    } else {
      return `{${Object.entries(item).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}:${serialize(v)}`).join("")}}`;
    }
  }
  return String(item);
};
var fnv1a = (str) => {
  if (typeof str !== "string") {
    str = String(str);
  }
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = hash * 16777619 >>> 0;
  }
  return hash >>> 0;
};
var findNextPrime = (num) => {
  if (num < 2) return 2;
  if ((num & 1) === 0) num++;
  while (!isPrime(num)) {
    num += 2;
  }
  return num;
};
var isPrime = (num) => {
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
var UniqueSet = class extends Set {
  /*** @throws TypeError If the input is not iterable. */
  constructor(iterable = []) {
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
  has(o) {
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
  add(o) {
    if (!this.has(o)) {
      super.add(o);
    }
    return this;
  }
};
var BloomSet = class extends Set {
  #bitArray;
  #aSize;
  #hashCount;
  /**
   * Creates a new `BloomSet` instance.
   * @param iterable Optional: an iterable object with which to initialize the BloomSet.
   * @param options Bloom filter configuration options.
   * @param options.size The size of the Bloom filter's bit array. Defaults to 6553577.
   * @param options.hashCount The number of hash functions to use. Defaults to 7.
   * @throws TypeError If the input is not iterable.
   */
  constructor(iterable = [], options = {}) {
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
      size = 6553577;
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
  #hashes(item) {
    const hashes = [];
    const str = serialize(item);
    let hash = fnv1a(str);
    for (let i = 0; i < this.#hashCount; i++) {
      hash %= this.#aSize;
      hashes.push(hash);
      hash = (hash ^ hash >>> 13) * 3266489909;
      hash >>>= 0;
    }
    return hashes;
  }
  /** @internal */
  #setBits(hashes) {
    for (const hash of hashes) {
      const index = Math.floor(hash / 8);
      const bit = hash % 8;
      this.#bitArray[index] |= 1 << bit;
    }
  }
  /** @internal */
  #checkBits(hashes) {
    for (const hash of hashes) {
      const index = Math.floor(hash / 8);
      const bit = hash % 8;
      if (!(this.#bitArray[index] & 1 << bit)) {
        return false;
      }
    }
    return true;
  }
  /** Determines existence of an object in the BloomSet using the Bloom filter and deep equality */
  has(o) {
    const hashes = this.#hashes(o);
    if (!this.#checkBits(hashes)) {
      return false;
    }
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
  add(o) {
    if (!this.has(o)) {
      const hashes = this.#hashes(o);
      this.#setBits(hashes);
      super.add(o);
    }
    return this;
  }
};
export {
  BloomSet,
  UniqueSet
};
