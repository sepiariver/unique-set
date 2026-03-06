// index.ts
import { deepEqual as equal } from "fast-equals";
var _f64 = new Float64Array(1);
var _u8 = new Uint8Array(_f64.buffer);
var structuralHash = (value) => {
  return _shash(value, 2166136261) >>> 0;
};
var _mix = (hash, byte) => {
  return Math.imul(hash ^ byte, 16777619);
};
var _mixStr = (hash, str) => {
  for (let i = 0; i < str.length; i++) {
    hash = Math.imul(hash ^ str.charCodeAt(i), 16777619);
  }
  return hash;
};
var _shash = (value, hash) => {
  if (value === null) return _mix(hash, 0);
  if (value === void 0) return _mix(hash, 1);
  switch (typeof value) {
    case "boolean":
      return _mix(hash, value ? 3 : 2);
    case "number":
      hash = _mix(hash, 5);
      if (isNaN(value)) return _mix(hash, 4);
      if (value === 0) return _mix(hash, 48);
      _f64[0] = value;
      for (let i = 0; i < 8; i++) hash = _mix(hash, _u8[i]);
      return hash;
    case "string":
      hash = _mix(hash, 6);
      return _mixStr(hash, value);
    case "bigint":
      hash = _mix(hash, 7);
      return _mixStr(hash, value.toString());
    case "function":
    case "symbol":
      hash = _mix(hash, 8);
      return _mixStr(hash, String(value));
    default:
      break;
  }
  if (Array.isArray(value)) {
    hash = _mix(hash, 16);
    for (let i = 0; i < value.length; i++) hash = _shash(value[i], hash);
    return hash;
  }
  if (value instanceof Map) {
    let mapHash = 0;
    for (const [k, v] of value) {
      let entryHash = _shash(k, 2166136261);
      entryHash = _shash(v, entryHash);
      mapHash = mapHash + entryHash | 0;
    }
    return _mix(hash, mapHash);
  }
  if (value instanceof Set) {
    let setHash = 0;
    for (const v of value) {
      setHash = setHash + _shash(v, 2166136261) | 0;
    }
    return _mix(hash, setHash);
  }
  if (value instanceof Date) {
    hash = _mix(hash, 20);
    _f64[0] = value.getTime();
    for (let i = 0; i < 8; i++) hash = _mix(hash, _u8[i]);
    return hash;
  }
  if (value instanceof RegExp) {
    hash = _mix(hash, 21);
    return _mixStr(hash, value.toString());
  }
  hash = _mix(hash, 19);
  let objHash = 0;
  const keys = Object.keys(value);
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    let pairHash = _mixStr(2166136261, key);
    pairHash = _shash(value[key], pairHash);
    objHash = objHash + pairHash | 0;
  }
  return _mix(hash, objHash);
};
var MapSet = class {
  #map;
  #size;
  constructor(iterable = []) {
    if (!Array.isArray(iterable) && !iterable[Symbol.iterator]) {
      throw new TypeError("MapSet requires an iterable");
    }
    this.#map = /* @__PURE__ */ new Map();
    this.#size = 0;
    for (const item of iterable) {
      this.add(item);
    }
  }
  add(value) {
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
  has(value) {
    const hash = structuralHash(value);
    const bucket = this.#map.get(hash);
    if (!bucket) return false;
    for (const item of bucket) {
      if (equal(value, item)) return true;
    }
    return false;
  }
  delete(value) {
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
  get size() {
    return this.#size;
  }
  clear() {
    this.#map.clear();
    this.#size = 0;
  }
  forEach(callback, thisArg) {
    for (const bucket of this.#map.values()) {
      for (const value of bucket) {
        callback.call(thisArg, value, value, this);
      }
    }
  }
  *values() {
    for (const bucket of this.#map.values()) {
      yield* bucket;
    }
  }
  *[Symbol.iterator]() {
    yield* this.values();
  }
};
export {
  MapSet,
  MapSet as UniqueSet,
  structuralHash
};
