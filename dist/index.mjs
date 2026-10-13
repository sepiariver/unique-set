// index.ts
import { createCustomEqual } from "fast-equals";
var _f64 = new Float64Array(1);
var _u8 = new Uint8Array(_f64.buffer);
var structuralHash = (value) => {
  return _hashRoot(value) >>> 0;
};
var MAX_DEPTH = 256;
var CUT_DEPTH = 3;
var _pairing = (areItemsEqual) => (a, b, state) => {
  const cache = state.cache;
  const cachedA = cache.get(a);
  const cachedB = cache.get(b);
  if (cachedA && cachedB) return cachedA === b && cachedB === a;
  cache.set(a, b);
  cache.set(b, a);
  const result = areItemsEqual(a, b, state);
  if (cachedA) cache.set(a, cachedA);
  else cache.delete(a);
  if (cachedB) cache.set(b, cachedB);
  else cache.delete(b);
  return result;
};
var _viewBytes = (view) => {
  try {
    return new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
  } catch {
    return new Uint8Array(0);
  }
};
var _areDataViewsEqual = (a, b) => {
  const x = _viewBytes(a);
  const y = _viewBytes(b);
  if (x.length !== y.length || x.byteOffset !== y.byteOffset) return false;
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return false;
  return true;
};
var _deepEqual = createCustomEqual({
  createCustomConfig: () => ({ areDataViewsEqual: _areDataViewsEqual })
});
var _shallowEqual = createCustomEqual({
  createInternalComparator: () => Object.is,
  createCustomConfig: () => ({ areDataViewsEqual: _areDataViewsEqual })
});
var _circularEqual = createCustomEqual({
  createState: () => ({ cache: /* @__PURE__ */ new WeakMap(), meta: void 0 }),
  createCustomConfig: (config) => ({
    areDataViewsEqual: _areDataViewsEqual,
    areArraysEqual: _pairing(config.areArraysEqual),
    areErrorsEqual: _pairing(config.areErrorsEqual),
    areMapsEqual: _pairing(config.areMapsEqual),
    areObjectsEqual: _pairing(config.areObjectsEqual),
    areSetsEqual: _pairing(config.areSetsEqual)
  })
});
var _tooDeep = new Error("unique-set: value nested past MAX_DEPTH");
var _limit = MAX_DEPTH;
var _deep = false;
var _hashRoot = (value) => {
  _deep = false;
  try {
    return _shash(value, 2166136261, 0);
  } catch (error) {
    if (error !== _tooDeep) throw error;
  }
  _deep = true;
  _limit = CUT_DEPTH;
  try {
    return _shash(value, 2166136261, 0);
  } finally {
    _limit = MAX_DEPTH;
  }
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
var _mixBytes = (hash, bytes) => {
  for (let i = 0; i < bytes.length; i++) hash = _mix(hash, bytes[i]);
  return hash;
};
var _toString = Object.prototype.toString;
var _mapSize = Object.getOwnPropertyDescriptor(Map.prototype, "size").get;
var _setSize = Object.getOwnPropertyDescriptor(Set.prototype, "size").get;
var _getTime = Date.prototype.getTime;
var _typedArrayTag = Object.getOwnPropertyDescriptor(
  Object.getPrototypeOf(Int8Array.prototype),
  Symbol.toStringTag
).get;
var _isBrand = (method, value) => {
  try {
    method.call(value);
    return true;
  } catch {
    return false;
  }
};
var _ids = /* @__PURE__ */ new WeakMap();
var _nextId = 0;
var _shashIdentity = (value, hash) => {
  let id = _ids.get(value);
  if (id === void 0) _ids.set(value, id = _nextId++);
  return _mix(_mix(hash, 28), id);
};
var _shashKeys = (value, hash, depth) => {
  const keys = Object.keys(value);
  hash = _mix(hash, 19);
  let objHash = 0;
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    if (key.charCodeAt(0) === 95 && // "_"
    (key === "_owner" || key === "__o" || key === "__v") && value.$$typeof) {
      continue;
    }
    let pairHash = _mixStr(2166136261, key);
    pairHash = _shash(value[key], pairHash, depth);
    objHash = objHash + pairHash | 0;
  }
  return _mix(hash, objHash);
};
var _shashMap = (value, hash, depth) => {
  let mapHash = 0;
  for (const [k, v] of value) {
    let entryHash = _shash(k, 2166136261, depth);
    entryHash = _shash(v, entryHash, depth);
    mapHash = mapHash + entryHash | 0;
  }
  return _mix(hash, mapHash);
};
var _shashSet = (value, hash, depth) => {
  let setHash = 0;
  for (const v of value) {
    setHash = setHash + _shash(v, 2166136261, depth) | 0;
  }
  return _mix(hash, setHash);
};
var _shashDate = (value, hash) => {
  hash = _mix(hash, 20);
  const time = value.getTime();
  if (time !== time) return _mix(hash, 4);
  _f64[0] = time;
  for (let i = 0; i < 8; i++) hash = _mix(hash, _u8[i]);
  return hash;
};
var _shashDataView = (value, hash) => _mixBytes(_mix(hash, 24), _viewBytes(value));
var _shashView = (value, hash, depth) => {
  if (_typedArrayTag.call(value) === void 0) return _shashDataView(value, hash);
  hash = _mix(hash, 22);
  const items = value;
  for (let i = 0; i < items.length; i++) hash = _shash(items[i], hash, depth);
  return hash;
};
var _shashTagged = (value, hash, depth) => {
  const tag = _toString.call(value);
  switch (tag) {
    case "[object Object]":
      return typeof value.then === "function" ? _shashIdentity(value, hash) : _shashKeys(value, hash, depth);
    case "[object Arguments]":
      return _shashKeys(value, hash, depth);
    case "[object Error]": {
      const error = value;
      hash = _shash(error.name, _mix(hash, 25), depth);
      hash = _shash(error.message, hash, depth);
      hash = _shash(error.cause, hash, depth);
      return _shashKeys(value, hash, depth);
    }
    case "[object Map]":
      return _isBrand(_mapSize, value) ? _shashMap(value, hash, depth) : _mix(hash, 29);
    case "[object Set]":
      return _isBrand(_setSize, value) ? _shashSet(value, hash, depth) : _mix(hash, 30);
    case "[object Date]":
      return _isBrand(_getTime, value) ? _shashDate(value, hash) : _mix(hash, 20);
    case "[object RegExp]": {
      const regExp = value;
      return _shash(regExp.flags, _shash(regExp.source, _mix(hash, 21), depth), depth);
    }
    case "[object Number]":
    case "[object String]":
    case "[object Boolean]":
    case "[object BigInt]": {
      const valueOf = value.valueOf;
      const primitive = typeof valueOf === "function" ? valueOf.call(value) : value;
      return typeof primitive === "object" || typeof primitive === "function" ? _mix(hash, 27) : _shash(primitive, _mix(hash, 27), depth);
    }
    case "[object URL]":
      return _shashUrl(value, hash, depth);
    case "[object ArrayBuffer]":
      return _mixBytes(_mix(hash, 23), new Uint8Array(value));
    case "[object DataView]":
      return _shashDataView(value, hash);
    // Real arrays and typed arrays never get here, so these only borrow the tag.
    case "[object Array]":
    case "[object Int8Array]":
    case "[object Uint8Array]":
    case "[object Uint8ClampedArray]":
    case "[object Int16Array]":
    case "[object Uint16Array]":
    case "[object Int32Array]":
    case "[object Uint32Array]":
    case "[object Float16Array]":
    case "[object Float32Array]":
    case "[object Float64Array]":
    case "[object BigInt64Array]":
    case "[object BigUint64Array]":
      return _mix(hash, 31);
    default:
      return _shashIdentity(value, hash);
  }
};
var _shashUrl = (value, hash, depth) => {
  let searchParams;
  try {
    searchParams = value.searchParams.toString();
  } catch {
    return _mix(hash, 26);
  }
  hash = _shash(value.protocol, _mix(hash, 26), depth);
  hash = _shash(value.username, hash, depth);
  hash = _shash(value.password, hash, depth);
  hash = _shash(value.host, hash, depth);
  hash = _shash(value.pathname, hash, depth);
  hash = _shash(value.hash, hash, depth);
  let paramsHash = 0;
  for (const pair of searchParams.split("&")) {
    paramsHash = paramsHash + _mixStr(2166136261, pair) | 0;
  }
  return _mix(hash, paramsHash);
};
var _shash = (value, hash, depth) => {
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
  if (++depth > _limit) {
    if (_limit === MAX_DEPTH) throw _tooDeep;
    return _mix(hash, 63);
  }
  if (Array.isArray(value)) {
    hash = _mix(hash, 16);
    for (let i = 0; i < value.length; i++) hash = _shash(value[i], hash, depth);
    return hash;
  }
  const constructor = value.constructor;
  if (constructor === Object || constructor == null) return _shashKeys(value, hash, depth);
  if (value instanceof Map) return _shashMap(value, hash, depth);
  if (value instanceof Set) return _shashSet(value, hash, depth);
  if (value instanceof Date) return _shashDate(value, hash);
  if (value instanceof RegExp) return _mixStr(_mix(hash, 21), value.toString());
  if (ArrayBuffer.isView(value)) return _shashView(value, hash, depth);
  return _shashTagged(value, hash, depth);
};
var _key = (value) => _hashRoot(value) | 0;
var Bucket = class {
  items;
  constructor(items) {
    this.items = items;
  }
};
var _NONE = /* @__PURE__ */ Symbol("none");
var _find = (map, key, value, equal) => {
  const slot = map.get(key);
  if (slot instanceof Bucket) {
    for (const item of slot.items) {
      if (equal(value, item)) return item;
    }
    return _NONE;
  }
  if (slot === void 0) return value === void 0 && map.has(key) ? slot : _NONE;
  return equal(value, slot) ? slot : _NONE;
};
var _insert = (map, key, value) => {
  const slot = map.get(key);
  if (slot === void 0 && !map.has(key)) map.set(key, value);
  else if (slot instanceof Bucket) slot.items.push(value);
  else map.set(key, new Bucket([slot, value]));
};
var _remove = (map, key, item) => {
  const slot = map.get(key);
  if (slot instanceof Bucket) {
    const items = slot.items;
    for (let i = 0; i < items.length; i++) {
      if (Object.is(items[i], item)) {
        items.splice(i, 1);
        if (items.length === 1) map.set(key, items[0]);
        return true;
      }
    }
    return false;
  }
  if (!Object.is(slot, item) || slot === void 0 && !map.has(key)) return false;
  map.delete(key);
  return true;
};
var _holds = (map, key, item) => {
  const slot = map.get(key);
  if (slot instanceof Bucket) return slot.items.some((stored) => Object.is(stored, item));
  return Object.is(slot, item) && (slot !== void 0 || map.has(key));
};
var _setRecord = (other) => {
  if (other === null || typeof other !== "object" && typeof other !== "function") {
    throw new TypeError("MapSet: the argument must be a set-like object");
  }
  const size = +other.size;
  if (size !== size) throw new TypeError("MapSet: the argument's size must be a number");
  const intSize = Math.trunc(size);
  if (intSize < 0) throw new RangeError("MapSet: the argument's size must not be negative");
  const has = other.has;
  if (typeof has !== "function") throw new TypeError("MapSet: the argument's has must be a function");
  const keys = other.keys;
  if (typeof keys !== "function") throw new TypeError("MapSet: the argument's keys must be a function");
  return { set: other, size: intSize, has, keys };
};
var _keysOf = (rec) => {
  const iterator = rec.keys.call(rec.set);
  return { [Symbol.iterator]: () => iterator };
};
var MapSet = class _MapSet {
  #map;
  #size;
  // The stored value the last `add()` matched, while `#probing`, for the duplicate probe
  // (PERF.md, Notes).
  #last = void 0;
  #probing = false;
  constructor(iterable) {
    this.#map = /* @__PURE__ */ new Map();
    this.#size = 0;
    if (iterable == null) return;
    if (!Array.isArray(iterable) && !iterable[Symbol.iterator]) {
      throw new TypeError("MapSet requires an iterable");
    }
    for (const item of iterable) {
      this.add(item);
    }
  }
  add(value) {
    if (this.#probing && _shallowEqual(value, this.#last)) return this;
    const key = _key(value);
    const equal = _deep ? _circularEqual : _deepEqual;
    const slot = this.#map.get(key);
    if (slot === void 0 && !this.#map.has(key)) {
      this.#map.set(key, value);
    } else if (slot instanceof Bucket) {
      for (const item of slot.items) {
        if (equal(value, item)) return this.#matched(item);
      }
      slot.items.push(value);
    } else {
      if (equal(value, slot)) return this.#matched(slot);
      this.#map.set(key, new Bucket([slot, value]));
    }
    this.#size++;
    this.#probing = false;
    return this;
  }
  #matched(item) {
    this.#last = item;
    this.#probing = true;
    return this;
  }
  has(value) {
    return this.#find(value) !== _NONE;
  }
  /** The stored value equal to `value`, or `_NONE`. */
  #find(value) {
    const key = _key(value);
    return _find(this.#map, key, value, _deep ? _circularEqual : _deepEqual);
  }
  delete(value) {
    this.#last = void 0;
    this.#probing = false;
    const key = _key(value);
    const equal = _deep ? _circularEqual : _deepEqual;
    const slot = this.#map.get(key);
    if (slot instanceof Bucket) {
      const items = slot.items;
      for (let i = 0; i < items.length; i++) {
        if (equal(value, items[i])) {
          items.splice(i, 1);
          if (items.length === 1) this.#map.set(key, items[0]);
          this.#size--;
          return true;
        }
      }
      return false;
    }
    if (slot === void 0 ? value !== void 0 || !this.#map.has(key) : !equal(value, slot)) {
      return false;
    }
    this.#map.delete(key);
    this.#size--;
    return true;
  }
  get size() {
    return this.#size;
  }
  clear() {
    this.#map.clear();
    this.#size = 0;
    this.#last = void 0;
    this.#probing = false;
  }
  forEach(callback, thisArg) {
    if (typeof callback !== "function") throw new TypeError("MapSet: forEach requires a function");
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
  *values() {
    for (const slot of this.#map.values()) {
      if (slot instanceof Bucket) {
        yield* slot.items;
      } else {
        yield slot;
      }
    }
  }
  /** The same as `values()`, as on `Set`. */
  keys() {
    return this.values();
  }
  /** Yields `[value, value]` for each value, as on `Set`. */
  *entries() {
    for (const value of this.values()) yield [value, value];
  }
  [Symbol.iterator]() {
    return this.values();
  }
  get [Symbol.toStringTag]() {
    return "MapSet";
  }
  // Set algebra, following the ES2025 `Set` methods step for step: `other` is read through
  // `_setRecord`, the smaller side drives the loop where the spec says so, and every result is a
  // new `MapSet`. Values from this set keep their map key, so they are never hashed again.
  // `other.has()` brings its own equality (README.md, "Differences from native `Set`").
  /** A copy sharing no buckets with this set, so either can change without affecting the other. */
  #copy() {
    const copy = new _MapSet();
    const map = copy.#map;
    this.#map.forEach((slot, key) => {
      map.set(key, slot instanceof Bucket ? new Bucket(slot.items.slice()) : slot);
    });
    copy.#size = this.#size;
    return copy;
  }
  /** A new set with the values of this set, then those of `other` that it lacks. */
  union(other) {
    const rec = _setRecord(other);
    const keys = _keysOf(rec);
    const result = this.#copy();
    for (const value of keys) result.add(value);
    return result;
  }
  /** A new set with the values of this set that `other` also has. */
  intersection(other) {
    const rec = _setRecord(other);
    const result = new _MapSet();
    const map = result.#map;
    if (this.#size <= rec.size) {
      this.#map.forEach((slot, key) => {
        const items = slot instanceof Bucket ? slot.items : [slot];
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (rec.has.call(rec.set, item) && !_holds(map, key, item)) {
            _insert(map, key, item);
            result.#size++;
          }
        }
      });
    } else {
      for (const value of _keysOf(rec)) {
        const key = _key(value);
        const item = _find(this.#map, key, value, _deep ? _circularEqual : _deepEqual);
        if (item !== _NONE && !_holds(map, key, item)) {
          _insert(map, key, item);
          result.#size++;
        }
      }
    }
    return result;
  }
  /** A new set with the values of this set that `other` does not have. */
  difference(other) {
    const rec = _setRecord(other);
    const result = this.#copy();
    const map = result.#map;
    if (this.#size <= rec.size) {
      this.#map.forEach((slot, key) => {
        const items = slot instanceof Bucket ? slot.items : [slot];
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (rec.has.call(rec.set, item) && _remove(map, key, item)) result.#size--;
        }
      });
    } else {
      for (const value of _keysOf(rec)) {
        const key = _key(value);
        const item = _find(map, key, value, _deep ? _circularEqual : _deepEqual);
        if (item !== _NONE) {
          _remove(map, key, item);
          result.#size--;
        }
      }
    }
    return result;
  }
  /** A new set with the values in exactly one of this set and `other`. */
  symmetricDifference(other) {
    const rec = _setRecord(other);
    const keys = _keysOf(rec);
    const result = this.#copy();
    const map = result.#map;
    for (const value of keys) {
      const key = _key(value);
      const equal = _deep ? _circularEqual : _deepEqual;
      const inResult = _find(map, key, value, equal);
      if (_find(this.#map, key, value, equal) !== _NONE) {
        if (inResult !== _NONE) {
          _remove(map, key, inResult);
          result.#size--;
        }
      } else if (inResult === _NONE) {
        _insert(map, key, value);
        result.#size++;
      }
    }
    return result;
  }
  /** Whether `other` has every value of this set. */
  isSubsetOf(other) {
    const rec = _setRecord(other);
    if (this.#size > rec.size) return false;
    for (const item of this.values()) {
      if (!rec.has.call(rec.set, item)) return false;
    }
    return true;
  }
  /** Whether this set has every value of `other`. */
  isSupersetOf(other) {
    const rec = _setRecord(other);
    if (this.#size < rec.size) return false;
    for (const value of _keysOf(rec)) {
      if (this.#find(value) === _NONE) return false;
    }
    return true;
  }
  /** Whether this set and `other` have no value in common. */
  isDisjointFrom(other) {
    const rec = _setRecord(other);
    if (this.#size <= rec.size) {
      for (const item of this.values()) {
        if (rec.has.call(rec.set, item)) return false;
      }
    } else {
      for (const value of _keysOf(rec)) {
        if (this.#find(value) !== _NONE) return false;
      }
    }
    return true;
  }
};
export {
  MapSet,
  MapSet as UniqueSet,
  structuralHash
};
