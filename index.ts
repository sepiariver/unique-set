import { createCustomEqual, type EqualityComparator, type State } from "fast-equals";

/**
 * Streaming structural hash — computes a 32-bit FNV-1a hash by traversing
 * the value directly, without allocating an intermediate string. Objects that fast-equals
 * compares by reference hash by identity, so their hash holds only within one process (see
 * "Objects compared by reference" in the README's Considerations).
 */
const _f64 = new Float64Array(1);
const _u8 = new Uint8Array(_f64.buffer);

export const structuralHash = (value: unknown): number => {
  return _hashRoot(value) >>> 0;
};

/**
 * Object nesting at which hashing gives up on the full structure. A circular value always
 * gets here, and so does an acyclic one nested deeper than this.
 */
const MAX_DEPTH = 256;

/**
 * Object nesting at which a value past `MAX_DEPTH` is cut off. Cutting by depth alone keeps
 * the hash a function of the value's unfolding, which every value fast-equals' circular
 * comparator calls equal shares. Hashing a back-reference as a constant would not: the
 * comparator calls `a = { self: a }` equal to `{ self: b }` with `b = { self: b }`, whose
 * cycles close at different depths.
 */
const CUT_DEPTH = 3;

/**
 * fast-equals' cycle check, except that it restores the pairing it overwrites. fast-equals 6.1.1
 * deletes it instead, so when Set or Map matching tries a wrong candidate first, a cycle through
 * the outer pair goes unnoticed and recursion overflows the stack (for example, comparing two
 * equal Sets that hold themselves and each other, in different insertion orders).
 */
const _pairing =
  (areItemsEqual: EqualityComparator<undefined>): EqualityComparator<undefined> =>
  (a, b, state: State<undefined>) => {
    const cache = state.cache!;
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

/**
 * The bytes a `DataView` covers. A view whose buffer has shrunk below it, or been detached,
 * throws on `byteOffset` and `byteLength`, so it reads as the empty view at offset 0, which is
 * what an out-of-bounds typed array reports itself as.
 */
const _viewBytes = (view: DataView): Uint8Array => {
  try {
    return new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
  } catch {
    return new Uint8Array(0);
  }
};

/** fast-equals' `DataView` comparison (bytes and `byteOffset`), through `_viewBytes`. */
const _areDataViewsEqual = (a: DataView, b: DataView): boolean => {
  const x = _viewBytes(a);
  const y = _viewBytes(b);
  if (x.length !== y.length || x.byteOffset !== y.byteOffset) return false;
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return false;
  return true;
};

/** fast-equals' `deepEqual` and `shallowEqual`, except that no `DataView` makes them throw. */
const _deepEqual = createCustomEqual<undefined>({
  createCustomConfig: () => ({ areDataViewsEqual: _areDataViewsEqual }),
});
const _shallowEqual = createCustomEqual<undefined>({
  createInternalComparator: () => Object.is,
  createCustomConfig: () => ({ areDataViewsEqual: _areDataViewsEqual }),
});

/** `circularDeepEqual`, with the cycle check above on every comparator that recurses. */
const _circularEqual = createCustomEqual<undefined>({
  createState: () => ({ cache: new WeakMap(), meta: undefined }),
  createCustomConfig: (config) => ({
    areDataViewsEqual: _areDataViewsEqual,
    areArraysEqual: _pairing(config.areArraysEqual),
    areErrorsEqual: _pairing(config.areErrorsEqual),
    areMapsEqual: _pairing(config.areMapsEqual),
    areObjectsEqual: _pairing(config.areObjectsEqual),
    areSetsEqual: _pairing(config.areSetsEqual),
  }),
});

const _tooDeep = new Error("unique-set: value nested past MAX_DEPTH");
let _limit = MAX_DEPTH;

/**
 * Whether the last `_hashRoot` call hit `MAX_DEPTH`, so the value may be circular and must be
 * compared with `_circularEqual`. Any other value has a finite depth that ends a lockstep
 * `deepEqual`, even against a circular stored value.
 */
let _deep = false;

/**
 * Hashes `value`, falling back to a hash cut off at `CUT_DEPTH` when it is nested past
 * `MAX_DEPTH`. Equal values unfold alike, so both always take the same path.
 */
const _hashRoot = (value: unknown): number => {
  _deep = false;
  try {
    return _shash(value, 0x811c9dc5, 0);
  } catch (error) {
    if (error !== _tooDeep) throw error;
  }
  _deep = true;
  _limit = CUT_DEPTH;
  try {
    return _shash(value, 0x811c9dc5, 0);
  } finally {
    _limit = MAX_DEPTH;
  }
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

const _mixBytes = (hash: number, bytes: Uint8Array): number => {
  for (let i = 0; i < bytes.length; i++) hash = _mix(hash, bytes[i]!);
  return hash;
};

// Every case below hashes no more than fast-equals compares for that kind of value (often less),
// so equal values always share a key. It follows fast-equals' own dispatch: an object whose
// constructor is `Object`, or which has none, compares by its keys; a same-realm built-in by its
// contents; and any other object by its `Object.prototype.toString` tag (see `_shashTagged`).

const _toString = Object.prototype.toString;
const _mapSize = Object.getOwnPropertyDescriptor(Map.prototype, "size")!.get!;
const _setSize = Object.getOwnPropertyDescriptor(Set.prototype, "size")!.get!;
const _getTime = Date.prototype.getTime;
/** The element type of any typed array, from any realm, and `undefined` for a `DataView`. */
const _typedArrayTag = Object.getOwnPropertyDescriptor(
  Object.getPrototypeOf(Int8Array.prototype),
  Symbol.toStringTag
)!.get!;

/** Whether `value` passes a built-in method's own brand check, which works across realms. */
const _isBrand = (method: (this: never) => unknown, value: object): boolean => {
  try {
    method.call(value as never);
    return true;
  } catch {
    return false;
  }
};

/** Ids for objects that fast-equals compares by reference, so that each gets its own key. */
const _ids = new WeakMap<object, number>();
let _nextId = 0;

/** Hashes an object by its identity. Ids differ, so no two objects mixed at one point collide. */
const _shashIdentity = (value: object, hash: number): number => {
  let id = _ids.get(value);
  if (id === undefined) _ids.set(value, (id = _nextId++));
  return _mix(_mix(hash, 0x1c), id);
};

/** By own enumerable keys, in any order, as fast-equals compares plain objects. */
const _shashKeys = (value: object, hash: number, depth: number): number => {
  const keys = Object.keys(value);
  hash = _mix(hash, 0x13);
  let objHash = 0;
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]!;
    // fast-equals skips these keys on React and Preact elements, so hashing them would be finer than equality.
    if (
      key.charCodeAt(0) === 95 && // "_"
      (key === "_owner" || key === "__o" || key === "__v") &&
      (value as { $$typeof?: unknown }).$$typeof
    ) {
      continue;
    }
    let pairHash = _mixStr(0x811c9dc5, key);
    pairHash = _shash((value as Record<string, unknown>)[key], pairHash, depth);
    objHash = (objHash + pairHash) | 0;
  }
  return _mix(hash, objHash);
};

const _shashMap = (value: Map<unknown, unknown>, hash: number, depth: number): number => {
  let mapHash = 0;
  for (const [k, v] of value) {
    let entryHash = _shash(k, 0x811c9dc5, depth);
    entryHash = _shash(v, entryHash, depth);
    mapHash = (mapHash + entryHash) | 0; // order-independent hash by summing entry hashes (32-bit)
  }
  return _mix(hash, mapHash);
};

const _shashSet = (value: Set<unknown>, hash: number, depth: number): number => {
  let setHash = 0;
  for (const v of value) {
    setHash = (setHash + _shash(v, 0x811c9dc5, depth)) | 0; // order-independent hash by summing element hashes (32-bit)
  }
  return _mix(hash, setHash);
};

const _shashDate = (value: Date, hash: number): number => {
  hash = _mix(hash, 0x14);
  const time = value.getTime();
  if (time !== time) return _mix(hash, 0x04); // invalid dates are equal whatever their NaN bits
  _f64[0] = time;
  for (let i = 0; i < 8; i++) hash = _mix(hash, _u8[i]!);
  return hash;
};

/** `DataView`s compare by the bytes they cover and their `byteOffset`, which is not hashed. */
const _shashDataView = (value: DataView, hash: number): number =>
  _mixBytes(_mix(hash, 0x18), _viewBytes(value));

/** Typed arrays and `DataView`, which compare by contents and `byteOffset`. */
const _shashView = (value: ArrayBufferView, hash: number, depth: number): number => {
  if (_typedArrayTag.call(value) === undefined) return _shashDataView(value as DataView, hash);
  // Elements compare with `!==`, and NaN equals NaN in float arrays; the number path
  // normalizes NaN and -0 to match. `byteOffset` is compared but not hashed.
  hash = _mix(hash, 0x16);
  const items = value as unknown as ArrayLike<number | bigint>;
  for (let i = 0; i < items.length; i++) hash = _shash(items[i], hash, depth);
  return hash;
};

/**
 * Any object the cases in `_shash` do not take: class instances, built-ins from another realm
 * (such as a `vm` context), and objects fast-equals has no comparator for. fast-equals picks
 * their comparison by tag, and so does this. Content-compared built-ins ignore enumerable own
 * keys, so they are hashed by contents alone. An object that borrows a built-in's tag without
 * being one gets a fixed hash per tag, which is coarser than whatever fast-equals compares.
 */
const _shashTagged = (value: object, hash: number, depth: number): number => {
  const tag = _toString.call(value);
  switch (tag) {
    case "[object Object]":
      // fast-equals compares a thenable class instance by reference, like a `Promise`.
      return typeof (value as { then?: unknown }).then === "function"
        ? _shashIdentity(value, hash)
        : _shashKeys(value, hash, depth);
    case "[object Arguments]":
      return _shashKeys(value, hash, depth);
    case "[object Error]": {
      // Compared by `name`, `message`, `stack`, `cause` and own enumerable keys. `stack` is left
      // out, since it costs a long string per error and differs by construction site anyway.
      const error = value as Error;
      hash = _shash(error.name, _mix(hash, 0x19), depth);
      hash = _shash(error.message, hash, depth);
      hash = _shash(error.cause, hash, depth);
      return _shashKeys(value, hash, depth);
    }
    case "[object Map]":
      return _isBrand(_mapSize, value)
        ? _shashMap(value as Map<unknown, unknown>, hash, depth)
        : _mix(hash, 0x1d);
    case "[object Set]":
      return _isBrand(_setSize, value) ? _shashSet(value as Set<unknown>, hash, depth) : _mix(hash, 0x1e);
    case "[object Date]":
      return _isBrand(_getTime, value) ? _shashDate(value as Date, hash) : _mix(hash, 0x14);
    case "[object RegExp]": {
      const regExp = value as RegExp;
      return _shash(regExp.flags, _shash(regExp.source, _mix(hash, 0x15), depth), depth);
    }
    case "[object Number]":
    case "[object String]":
    case "[object Boolean]":
    case "[object BigInt]": {
      // Compared with `Object.is` on `valueOf()`; the number path merges 0 and -0, which is coarser.
      const valueOf = (value as { valueOf?: unknown }).valueOf;
      const primitive = typeof valueOf === "function" ? valueOf.call(value) : value;
      return typeof primitive === "object" || typeof primitive === "function"
        ? _mix(hash, 0x1b)
        : _shash(primitive, _mix(hash, 0x1b), depth);
    }
    case "[object URL]":
      return _shashUrl(value as URL, hash, depth);
    case "[object ArrayBuffer]":
      return _mixBytes(_mix(hash, 0x17), new Uint8Array(value as ArrayBuffer));
    case "[object DataView]":
      return _shashDataView(value as DataView, hash);
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
      return _mix(hash, 0x1f);
    default:
      // fast-equals has no comparator for this tag, so it compares by reference.
      return _shashIdentity(value, hash);
  }
};

/**
 * Equal when `href` matches, or the components below match and the query holds the same
 * `&`-separated pairs in any order, so the pairs are summed rather than hashed in sequence.
 */
const _shashUrl = (value: URL, hash: number, depth: number): number => {
  let searchParams: string;
  try {
    searchParams = value.searchParams.toString();
  } catch {
    return _mix(hash, 0x1a); // only borrows the tag
  }
  hash = _shash(value.protocol, _mix(hash, 0x1a), depth);
  hash = _shash(value.username, hash, depth);
  hash = _shash(value.password, hash, depth);
  hash = _shash(value.host, hash, depth);
  hash = _shash(value.pathname, hash, depth);
  hash = _shash(value.hash, hash, depth);
  let paramsHash = 0;
  for (const pair of searchParams.split("&")) {
    paramsHash = (paramsHash + _mixStr(0x811c9dc5, pair)) | 0;
  }
  return _mix(hash, paramsHash);
};

const _shash = (value: unknown, hash: number, depth: number): number => {
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

  if (++depth > _limit) {
    if (_limit === MAX_DEPTH) throw _tooDeep;
    return _mix(hash, 0x3f);
  }

  if (Array.isArray(value)) {
    hash = _mix(hash, 0x10);
    for (let i = 0; i < value.length; i++) hash = _shash(value[i], hash, depth);
    return hash;
  }
  const constructor = (value as { constructor?: unknown }).constructor;
  if (constructor === Object || constructor == null) return _shashKeys(value as object, hash, depth);
  if (value instanceof Map) return _shashMap(value, hash, depth);
  if (value instanceof Set) return _shashSet(value, hash, depth);
  if (value instanceof Date) return _shashDate(value, hash);
  if (value instanceof RegExp) return _mixStr(_mix(hash, 0x15), value.toString());
  if (ArrayBuffer.isView(value)) return _shashView(value, hash, depth);
  return _shashTagged(value as object, hash, depth);
};

/**
 * Internal `Map` key. Signed, so on 64-bit V8 without pointer compression every key
 * is a small integer, where an unsigned key at or above 2^31 would be boxed as a heap
 * number. `structuralHash` stays unsigned because its output is public.
 */
const _key = (value: unknown): number => _hashRoot(value) | 0;

/**
 * Values whose keys collide. Module-private, so no stored value can be a `Bucket`,
 * which makes `instanceof Bucket` a safe discriminator. Always holds two or more items.
 */
class Bucket<T> {
  items: T[];
  constructor(items: T[]) {
    this.items = items;
  }
}

type Slots<T> = Map<number, T | Bucket<T>>;

/** What `_find` returns when no stored value matches. Module-private, so never a stored value. */
const _NONE: unique symbol = Symbol("none");

/** The stored value at `key` that equals `value`, or `_NONE`. */
const _find = <T>(
  map: Slots<T>,
  key: number,
  value: unknown,
  equal: typeof _deepEqual
): T | typeof _NONE => {
  const slot = map.get(key);
  if (slot instanceof Bucket) {
    for (const item of slot.items) {
      if (equal(value, item)) return item;
    }
    return _NONE;
  }
  // Only `undefined` equals `undefined`, so the extra lookup is needed for that value alone.
  if (slot === undefined) return value === undefined && map.has(key) ? (slot as T) : _NONE;
  return equal(value, slot) ? slot : _NONE;
};

/** Stores `value` at `key`, which must not hold a value equal to it. */
const _insert = <T>(map: Slots<T>, key: number, value: T): void => {
  const slot = map.get(key);
  if (slot === undefined && !map.has(key)) map.set(key, value);
  else if (slot instanceof Bucket) slot.items.push(value);
  else map.set(key, new Bucket([slot as T, value]));
};

/** Removes the stored value `item` itself from `key`, and reports whether it was there. */
const _remove = <T>(map: Slots<T>, key: number, item: T): boolean => {
  const slot = map.get(key);
  if (slot instanceof Bucket) {
    const items = slot.items;
    for (let i = 0; i < items.length; i++) {
      if (Object.is(items[i], item)) {
        items.splice(i, 1);
        if (items.length === 1) map.set(key, items[0]!);
        return true;
      }
    }
    return false;
  }
  if (!Object.is(slot, item) || (slot === undefined && !map.has(key))) return false;
  map.delete(key);
  return true;
};

/** Whether `key` holds the stored value `item` itself. */
const _holds = <T>(map: Slots<T>, key: number, item: T): boolean => {
  const slot = map.get(key);
  if (slot instanceof Bucket) return slot.items.some((stored) => Object.is(stored, item));
  return Object.is(slot, item) && (slot !== undefined || map.has(key));
};

/**
 * What the set-algebra methods accept as their argument, as in the ES2025 `Set` methods: any
 * object with a numeric `size`, a `has()` and a `keys()`, such as a `MapSet`, `Set` or `Map`.
 */
export interface SetLike<T> {
  readonly size: number;
  has(value: T): boolean;
  keys(): Iterator<T>;
}

interface SetRecord<T> {
  set: SetLike<T>;
  size: number;
  has: (value: unknown) => unknown;
  keys: () => Iterator<T>;
}

/** The spec's GetSetRecord: reads and validates `size`, `has` and `keys` once, in that order. */
const _setRecord = <T>(other: SetLike<T>): SetRecord<T> => {
  if (other === null || (typeof other !== "object" && typeof other !== "function")) {
    throw new TypeError("MapSet: the argument must be a set-like object");
  }
  const size = +other.size; // like ToNumber, throws on a BigInt or Symbol
  if (size !== size) throw new TypeError("MapSet: the argument's size must be a number");
  const intSize = Math.trunc(size);
  if (intSize < 0) throw new RangeError("MapSet: the argument's size must not be negative");
  // Called with this set's values as well as `other`'s, as the spec does.
  const has = other.has as (value: unknown) => unknown;
  if (typeof has !== "function") throw new TypeError("MapSet: the argument's has must be a function");
  const keys = other.keys;
  if (typeof keys !== "function") throw new TypeError("MapSet: the argument's keys must be a function");
  return { set: other, size: intSize, has, keys };
};

/**
 * Calls the record's `keys()` now and iterates what it returns. `for…of` over the result reads
 * `next` once, and calls `return` when the loop exits early, as the spec does.
 */
const _keysOf = <T>(rec: SetRecord<T>): Iterable<T> => {
  const iterator = rec.keys.call(rec.set);
  return { [Symbol.iterator]: () => iterator };
};

export class MapSet<T> {
  // A lone value is stored inline; a `Bucket` replaces it only on a key collision.
  #map: Map<number, T | Bucket<T>>;
  #size: number;
  // The stored value the last `add()` matched, while `#probing`. Runs of duplicates that are
  // shallow copies of one value share every nested reference, which `shallowEqual` checks
  // with `Object.is` far faster than the value can be hashed. Its `true` implies `deepEqual`,
  // and it never recurses, so it is also safe on circular values.
  #last: T | undefined = undefined;
  #probing = false;

  constructor(iterable?: Iterable<T> | null) {
    this.#map = new Map();
    this.#size = 0;
    if (iterable == null) return;
    if (!Array.isArray(iterable) && !iterable[Symbol.iterator]) {
      throw new TypeError("MapSet requires an iterable");
    }
    for (const item of iterable) {
      this.add(item);
    }
  }

  add(value: T): this {
    if (this.#probing && _shallowEqual(value, this.#last)) return this;
    const key = _key(value);
    const equal = _deep ? _circularEqual : _deepEqual;
    const slot = this.#map.get(key);
    // `get()` also returns `undefined` for a stored `undefined`, so confirm the miss.
    if (slot === undefined && !this.#map.has(key)) {
      this.#map.set(key, value);
    } else if (slot instanceof Bucket) {
      for (const item of slot.items) {
        if (equal(value, item)) return this.#matched(item);
      }
      slot.items.push(value);
    } else {
      if (equal(value, slot)) return this.#matched(slot as T);
      this.#map.set(key, new Bucket([slot as T, value])); // `slot` may be a stored `undefined`
    }
    this.#size++;
    this.#probing = false;
    return this;
  }

  #matched(item: T): this {
    this.#last = item;
    this.#probing = true;
    return this;
  }

  has(value: T): boolean {
    return this.#find(value) !== _NONE;
  }

  /** The stored value equal to `value`, or `_NONE`. */
  #find(value: unknown): T | typeof _NONE {
    const key = _key(value);
    return _find(this.#map, key, value, _deep ? _circularEqual : _deepEqual);
  }

  delete(value: T): boolean {
    this.#last = undefined; // it may be the value deleted
    this.#probing = false;
    const key = _key(value);
    const equal = _deep ? _circularEqual : _deepEqual;
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
    this.#last = undefined;
    this.#probing = false;
  }

  forEach(
    callback: (value: T, valueAgain: T, set: this) => void,
    thisArg?: any
  ): void {
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

  *values(): IterableIterator<T> {
    for (const slot of this.#map.values()) {
      if (slot instanceof Bucket) {
        yield* slot.items;
      } else {
        yield slot;
      }
    }
  }

  /** The same as `values()`, as on `Set`. */
  keys(): IterableIterator<T> {
    return this.values();
  }

  /** Yields `[value, value]` for each value, as on `Set`. */
  *entries(): IterableIterator<[T, T]> {
    for (const value of this.values()) yield [value, value];
  }

  [Symbol.iterator](): IterableIterator<T> {
    return this.values();
  }

  get [Symbol.toStringTag](): string {
    return "MapSet";
  }

  // Set algebra, following the ES2025 `Set` methods step for step: `other` is read through
  // `_setRecord`, the smaller side drives the loop where the spec says so, and every result is a
  // new `MapSet`. Values from this set keep their map key, so they are never hashed again.
  // Where `other.has()` decides membership, its own notion of equality applies: a `Set` argument
  // matches objects by reference.

  /** A copy sharing no buckets with this set, so either can change without affecting the other. */
  #copy(): MapSet<T> {
    const copy = new MapSet<T>();
    const map = copy.#map;
    this.#map.forEach((slot, key) => {
      map.set(key, slot instanceof Bucket ? new Bucket(slot.items.slice()) : slot);
    });
    copy.#size = this.#size;
    return copy;
  }

  /** A new set with the values of this set, then those of `other` that it lacks. */
  union<U>(other: SetLike<U>): MapSet<T | U> {
    const rec = _setRecord(other);
    const keys = _keysOf(rec);
    const result: MapSet<T | U> = this.#copy();
    for (const value of keys) result.add(value);
    return result;
  }

  /** A new set with the values of this set that `other` also has. */
  intersection<U>(other: SetLike<U>): MapSet<T & U> {
    const rec = _setRecord(other);
    const result = new MapSet<T>();
    const map = result.#map;
    if (this.#size <= rec.size) {
      this.#map.forEach((slot, key) => {
        const items = slot instanceof Bucket ? slot.items : [slot as T];
        for (let i = 0; i < items.length; i++) {
          const item = items[i]!;
          // `has()` may change this set, which can visit a value twice.
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
        // Keeps this set's value rather than `other`'s, so the result holds values of this set
        // whichever side drove the loop. Equal values from `other` all find the same one.
        if (item !== _NONE && !_holds(map, key, item)) {
          _insert(map, key, item);
          result.#size++;
        }
      }
    }
    return result as MapSet<T & U>;
  }

  /** A new set with the values of this set that `other` does not have. */
  difference<U>(other: SetLike<U>): MapSet<T> {
    const rec = _setRecord(other);
    const result = this.#copy();
    const map = result.#map;
    if (this.#size <= rec.size) {
      this.#map.forEach((slot, key) => {
        const items = slot instanceof Bucket ? slot.items : [slot as T];
        for (let i = 0; i < items.length; i++) {
          const item = items[i]!;
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
  symmetricDifference<U>(other: SetLike<U>): MapSet<T | U> {
    const rec = _setRecord(other);
    const keys = _keysOf(rec);
    const result: MapSet<T | U> = this.#copy();
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
  isSubsetOf(other: SetLike<unknown>): boolean {
    const rec = _setRecord(other);
    if (this.#size > rec.size) return false;
    for (const item of this.values()) {
      if (!rec.has.call(rec.set, item)) return false;
    }
    return true;
  }

  /** Whether this set has every value of `other`. */
  isSupersetOf(other: SetLike<unknown>): boolean {
    const rec = _setRecord(other);
    if (this.#size < rec.size) return false;
    for (const value of _keysOf(rec)) {
      if (this.#find(value) === _NONE) return false;
    }
    return true;
  }

  /** Whether this set and `other` have no value in common. */
  isDisjointFrom(other: SetLike<unknown>): boolean {
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
}

export { MapSet as UniqueSet };
