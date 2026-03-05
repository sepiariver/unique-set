"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// index.ts
var unique_set_exports = {};
__export(unique_set_exports, {
  MapSet: () => MapSet,
  UniqueSet: () => MapSet,
  structuralHash: () => structuralHash
});
module.exports = __toCommonJS(unique_set_exports);
var import_es6 = __toESM(require("fast-deep-equal/es6/index.js"));
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
    hash = _mix(hash, 17);
    const entries = Array.from(value.entries()).sort(
      ([a], [b]) => String(a).localeCompare(String(b))
    );
    for (const [k, v] of entries) {
      hash = _shash(k, hash);
      hash = _shash(v, hash);
    }
    return hash;
  }
  if (value instanceof Set) {
    hash = _mix(hash, 18);
    for (const v of value) hash = _shash(v, hash);
    return hash;
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
  const keys = Object.keys(value).sort();
  for (const key of keys) {
    hash = _mixStr(hash, key);
    hash = _shash(value[key], hash);
  }
  return hash;
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
        if ((0, import_es6.default)(value, item)) return this;
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
      if ((0, import_es6.default)(value, item)) return true;
    }
    return false;
  }
  delete(value) {
    const hash = structuralHash(value);
    const bucket = this.#map.get(hash);
    if (!bucket) return false;
    for (let i = 0; i < bucket.length; i++) {
      if ((0, import_es6.default)(value, bucket[i])) {
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  MapSet,
  UniqueSet,
  structuralHash
});
