import equal from "fast-deep-equal";

export class UniqueSet extends Set {
  constructor(iterable = []) {
    if (!Array.isArray(iterable) && !iterable[Symbol.iterator]) {
      throw new TypeError("UniqueSet requires an iterable");
    }
    super();
    for (const item of iterable) {
      this.add(item);
    }
  }

  has(o) {
    for (const i of this) {
      if (equal(o, i)) {
        return true;
      }
    }
    return false;
  }

  add(o) {
    if (!this.has(o)) {
      super.add(o);
    }
    return this;
  }
}

export class BloomSet extends Set {
  constructor(iterable = [], options = {}) {
    if (!Array.isArray(iterable) && !iterable[Symbol.iterator]) {
      throw new TypeError("BloomSet requires an iterable");
    }
    super();

    if (!options || typeof options !== "object") {
      options = {};
    }

    const { size = 6553577, hashCount = 7 } = options;

    if (typeof size !== "number" || size <= 0) {
      size = 6553577; // Targeting < 1 collision per 100,000 elements, ~819 KB memory, needs 7 hashes
    }
    this.aSize = this._findNextPrime(size);

    if (typeof hashCount !== "number" || hashCount <= 0) {
      hashCount = 7;
    }
    this.hashCount = hashCount;

    this.bitArray = new Uint8Array(Math.ceil(size / 8));

    for (const item of iterable) {
      this.add(item);
    }
  }

  _findNextPrime(num) {
    if (num < 2) return 2;
    if (num % 2 === 0) num++; // Odd numbers only

    while (!this._isPrime(num)) {
      num += 2; // Odd numbers only
    }

    return num;
  }

  _isPrime(num) {
    if (num < 2) return false;
    if (num === 2 || num === 3) return true;
    if (num % 2 === 0 || num % 3 === 0) return false;

    const sqrt = Math.floor(Math.sqrt(num));
    for (let i = 5; i <= sqrt; i += 6) {
      if (num % i === 0 || num % (i + 2) === 0) return false;
    }

    return true;
  }

  _serialize(item) {
    if (typeof item === "number" && isNaN(item)) {
      return "NaN";
    }

    if (item && typeof item === "object") {
      const serialize = this._serialize.bind(this);
      if (Array.isArray(item)) {
        return `[${item.map(serialize).join(",")}]`;
      } else {
        return `{${Object.entries(item)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, v]) => `${k}:${serialize(v)}`)
          .join(",")}}`;
      }
    }

    return String(item);
  }

  _hashes(item) {
    const hashes = [];
    const str = this._serialize(item);
    let hash = this._fnv1a(str); // Base hash

    // Bloom into hashCount hash values
    for (let i = 0; i < this.hashCount; i++) {
      hash %= this.aSize; // Ensure within bounds
      // Track
      hashes.push(hash);
      // Modify
      hash = (hash ^ (hash >>> 13)) * 0xc2b2ae35;
      hash >>>= 0; // Ensure unsigned 32-bit integer
    }

    return hashes;
  }

  _fnv1a(str) {
    if (typeof str !== "string") {
      str = String(str);
    }
    let hash = 2166136261; // FNV offset basis for 32-bit
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = (hash * 16777619) >>> 0; // Multiply by the FNV prime and ensure 32-bit unsigned
    }
    return hash >>> 0;
  }

  _setBits(hashes) {
    for (const hash of hashes) {
      const index = Math.floor(hash / 8);
      const bit = hash % 8;
      this.bitArray[index] |= 1 << bit;
    }
  }

  _checkBits(hashes) {
    for (const hash of hashes) {
      const index = Math.floor(hash / 8);
      const bit = hash % 8;
      if (!(this.bitArray[index] & (1 << bit))) {
        return false;
      }
    }
    return true;
  }

  has(o) {
    const hashes = this._hashes(o);
    if (!this._checkBits(hashes)) {
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

  add(o) {
    if (!this.has(o)) {
      const hashes = this._hashes(o);
      this._setBits(hashes);
      super.add(o);
    }
    return this;
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    UniqueSet,
    BloomSet,
  };
}
