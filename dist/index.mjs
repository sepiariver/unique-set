// index.ts
import equal from "fast-deep-equal/es6/index.js";
var serialize = (item) => {
  if (typeof item === "number") {
    if (isNaN(item)) {
      return "NaN";
    }
    return String(item);
  }
  if (item && typeof item === "object") {
    if (Array.isArray(item)) {
      return `[${item.map(serialize).join(",")}]`;
    } else if (item instanceof Map) {
      return `${Array.from(item.entries()).sort(([a], [b]) => String(a).localeCompare(String(b))).map(([k, v]) => `${serialize(k)}:${serialize(v)}`).join(".")}`;
    } else if (item instanceof Set) {
      return `${Array.from(item.entries()).map(([k, v]) => `${serialize(k)}:${serialize(v)}`).join("|")}`;
    } else {
      return `{${Object.entries(item).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}:${serialize(v)}`).join(";")}}`;
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
var fnv1a64 = (str) => {
  if (typeof str !== "string") {
    str = String(str);
  }
  const PRIME = BigInt(1099511628211);
  let hash = BigInt(14695981039346655e3);
  for (let i = 0; i < str.length; i++) {
    hash ^= BigInt(str.charCodeAt(i));
    hash *= PRIME;
  }
  return hash & BigInt("0xFFFFFFFFFFFFFFFF");
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
var isValidNumberArg = (n) => {
  return Boolean(Number.isInteger(n) && n > 0);
};
var findExponentForSize = (n, ratio) => {
  if (!isValidNumberArg(n)) {
    n = 1;
  }
  if (!isValidNumberArg(ratio)) {
    ratio = 4;
  }
  const target = ratio * n;
  return Math.ceil(Math.log2(target));
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
var MapSet = class {
  #map;
  #hashFn;
  constructor(iterable = [], options = {}) {
    if (!Array.isArray(iterable) && !iterable[Symbol.iterator]) {
      throw new TypeError("MapSet requires an iterable");
    }
    const { hashFunction } = options;
    this.#map = /* @__PURE__ */ new Map();
    this.#hashFn = hashFunction && typeof hashFunction === "function" ? hashFunction : (value) => fnv1a64(serialize(value));
    for (const item of iterable) {
      this.add(item);
    }
  }
  add(value) {
    const hash = this.#hashFn(value);
    if (!this.#map.has(hash)) {
      this.#map.set(hash, value);
    }
    return this;
  }
  has(value) {
    const hash = this.#hashFn(value);
    return this.#map.has(hash);
  }
  delete(value) {
    const hash = this.#hashFn(value);
    return this.#map.delete(hash);
  }
  get size() {
    return this.#map.size;
  }
  clear() {
    this.#map.clear();
  }
  forEach(callback, thisArg) {
    this.#map.forEach((value) => callback.call(thisArg, value, value, this));
  }
  *values() {
    yield* this.#map.values();
  }
  *[Symbol.iterator]() {
    yield* this.values();
  }
};
var CuckooOverflowError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "CuckooOverflowError";
  }
};
var CuckooSet = class extends Set {
  // Array of buckets, each a Set of fingerprints
  #buckets;
  // Maximum slots per bucket. Cannot change after initialization. 8 seems a good default.
  #bucketSize;
  // Total number of buckets. Recommend max number of expected elements. Cannot change after initialization.
  #numBuckets;
  // Fingerprint size in bits. Critical for collision resistance. Default to exponent of 2 >= 5x #numBuckets.
  #fingerprintSize;
  // Maximum number of relocations before throwing an error
  #maxRelocations;
  // Whether to throw an error on overflow. Should almost always be false: do throw.
  #silenceOverflow;
  constructor(iterable = [], options = {}) {
    if (!Array.isArray(iterable) && !iterable[Symbol.iterator]) {
      throw new TypeError("CuckooSet requires an iterable");
    }
    super();
    const { bucketSize, numBuckets, fingerprintSize, maxRelocations } = options;
    this.#bucketSize = isValidNumberArg(bucketSize) ? bucketSize : 8;
    this.#numBuckets = isValidNumberArg(numBuckets) ? numBuckets : 2e4;
    const exp = findExponentForSize(this.#numBuckets, 3);
    console.log("exp", exp);
    this.#fingerprintSize = isValidNumberArg(fingerprintSize) ? fingerprintSize : Math.max(20, exp);
    this.#maxRelocations = isValidNumberArg(maxRelocations) ? maxRelocations : 100;
    this.#silenceOverflow = options.silenceOverflow ?? false;
    this.#buckets = Array(this.#numBuckets).fill(null);
    for (const item of iterable) {
      this.add(item);
    }
  }
  #getIdentifiers(o) {
    const serialized = serialize(o);
    const hash = fnv1a64(serialized);
    const fingerprint = this.#fingerprint(hash);
    const numBucketsBigInt = BigInt(this.#numBuckets);
    const bucketIndex1 = Number(hash % numBucketsBigInt);
    const bucketIndex2 = this.#getBucketIndex2(bucketIndex1, fingerprint);
    return { bucketIndex1, bucketIndex2, fingerprint, serialized };
  }
  #fingerprint(hash) {
    const mask = (1n << BigInt(this.#fingerprintSize)) - 1n;
    const fingerprint = hash & mask;
    return fingerprint.toString(2);
  }
  #getBucket(bucketIndex) {
    if (!this.#buckets[bucketIndex]) {
      this.#buckets[bucketIndex] = /* @__PURE__ */ new Set();
    }
    return this.#buckets[bucketIndex];
  }
  #getBucketIndex2(bucketIndex1, fingerprint) {
    const bucketIndex1BigInt = BigInt(bucketIndex1);
    const fingerprintBigInt = BigInt(`0b${fingerprint}`);
    const bucketIndex2BigInt = (bucketIndex1BigInt ^ fingerprintBigInt) % BigInt(this.#numBuckets);
    return Number(bucketIndex2BigInt);
  }
  /** Attempt to insert an item, evicting if necessary. */
  #addWithEviction(insertionRecord) {
    const added = this.#findAHome(insertionRecord);
    if (added) {
      return true;
    } else {
      const pending = [];
      let doEviction = true;
      while (doEviction) {
        const candidate = this.#getEvictionCandidate(
          insertionRecord.bucketIndex1
        );
        const relocated = this.#tryRelocation(candidate);
        if (relocated) {
          doEviction = false;
        } else {
          pending.push(candidate);
          if (pending.length > this.#maxRelocations) {
            return false;
          }
        }
      }
      for (let i = pending.length - 1; i >= 0; i--) {
        const record = pending[i];
        if (record && !this.#tryRelocation(record)) {
          return false;
        }
      }
      return this.#findAHome(insertionRecord);
    }
  }
  #getEvictionCandidate(bucketIndex1) {
    const bucket = this.#getBucket(bucketIndex1);
    const candidate = bucket.values().next().value;
    const bucketIndex2 = this.#getBucketIndex2(bucketIndex1, candidate);
    return {
      fingerprint: candidate,
      bucketIndex1,
      bucketIndex2
    };
  }
  #tryRelocation(candidate) {
    const { bucketIndex1, bucketIndex2, fingerprint } = candidate;
    const bucket1 = this.#getBucket(bucketIndex1);
    const bucket2 = this.#getBucket(bucketIndex2);
    if (bucket1.has(fingerprint)) {
      if (bucket2.size < this.#bucketSize || bucket2.has(fingerprint)) {
        bucket2.add(fingerprint);
        bucket1.delete(fingerprint);
        return true;
      }
    } else if (bucket2.has(fingerprint)) {
      if (bucket1.size < this.#bucketSize || bucket1.has(fingerprint)) {
        bucket1.add(fingerprint);
        bucket2.delete(fingerprint);
        return true;
      }
    }
    return false;
  }
  #findAHome(insertionRecord) {
    const { bucketIndex1, bucketIndex2, fingerprint } = insertionRecord;
    const bucket1 = this.#getBucket(bucketIndex1);
    if (bucket1 && // Set behavior: if the item is already in the bucket, it's a no-op
    (bucket1.size < this.#bucketSize || bucket1.has(fingerprint))) {
      bucket1.add(fingerprint);
      return true;
    }
    const bucket2 = this.#getBucket(bucketIndex2);
    if (bucket2 && (bucket2.size < this.#bucketSize || bucket2.has(fingerprint))) {
      bucket2.add(fingerprint);
      return true;
    }
    return false;
  }
  #recordExists(record) {
    const { bucketIndex1, bucketIndex2, fingerprint } = record;
    return this.#getBucket(bucketIndex1).has(fingerprint) || this.#getBucket(bucketIndex2).has(fingerprint);
  }
  add(o) {
    const record = this.#getIdentifiers(o);
    const exists = this.#recordExists(record);
    if (!exists) {
      const added = this.#addWithEviction(record);
      if (!added) {
        const err = JSON.stringify({
          message: "Failed to add item after maximum relocations",
          bucketSize: this.#bucketSize,
          numBuckets: this.#numBuckets,
          fingerprintSize: this.#fingerprintSize,
          maxRelocations: this.#maxRelocations
        });
        if (this.#silenceOverflow) {
          console.error(err);
          return this;
        }
        throw new CuckooOverflowError(err);
      }
      super.add(o);
    }
    return this;
  }
  /**
   * Checks the Cuckoo filter for the presence of an object by value.
   * @param o The object representing the value to check for presence.
   * @returns True if an equivalent object is found, false otherwise.
   */
  hasByValue(o) {
    const record = this.#getIdentifiers(o);
    return this.#recordExists(record);
  }
  /**
   * Adhere's the native Set's behavior, deleting objects by reference only.
   * @param o The object to delete from the CuckooSet.
   * @returns True if the object was found and deleted, false otherwise.
   */
  delete(o) {
    const deleted = super.delete(o);
    if (!deleted) {
      return false;
    }
    const { bucketIndex1, bucketIndex2, fingerprint } = this.#getIdentifiers(o);
    this.#getBucket(bucketIndex1).delete(fingerprint);
    this.#getBucket(bucketIndex2).delete(fingerprint);
    return true;
  }
  /**
   * Deletes all objects from the CuckooSet that are equal to the input object.
   * WARNING: this is expensive and should be used sparingly.
   * @param o The object representing the value to delete.
   * @returns True if any objects were deleted, false otherwise.
   */
  deleteByValue(o) {
    const record = this.#getIdentifiers(o);
    const exists = this.#recordExists(record);
    if (!exists) {
      return false;
    }
    const deletedReference = this.delete(o);
    if (deletedReference) {
      return true;
    }
    const { bucketIndex1, bucketIndex2, fingerprint } = record;
    this.#getBucket(bucketIndex1).delete(fingerprint);
    this.#getBucket(bucketIndex2).delete(fingerprint);
    for (const item of this) {
      if (equal(o, item)) {
        super.delete(item);
        return true;
      }
    }
    return false;
  }
};
export {
  BloomSet,
  CuckooOverflowError,
  CuckooSet,
  MapSet,
  UniqueSet,
  findNextPrime,
  fnv1a,
  fnv1a64,
  serialize
};
