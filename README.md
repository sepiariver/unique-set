# @sepiariver/unique-set

A `Set` that deduplicates by deep value equality.

- Against six benchmarked deep-equality libraries, `UniqueSet` is the fastest on 12 of 13 deduplication workloads and on lookup, from 1.3x to ~1,500x faster. Notably, it's up to 2x faster than the closest competitor, which doesn't guarantee collision safety. It is also the only one with correct results on every workload. Some test datasets were imported from those competitors, with attribution. See ([PERF.md](PERF.md)).
- It compares built-ins by content: URL, Error, typed arrays, ArrayBuffer, DataView, boxed primitives, and React/Preact elements ([equality semantics](#considerations)).
- It is collision-safe: a streaming, non-cryptographic 32-bit FNV-1a hash picks the bucket, and `fast-equals` confirms every match ([PERF.md - Collision safety](PERF.md#collision-safety)). `add()` and `has()` are O(1) on average.

## Installation

```sh
npm install @sepiariver/unique-set
```

Supports ESM and CommonJS. `UniqueSet` is an alias of `MapSet`, and the two are the same class.

```js
import { MapSet, UniqueSet } from "@sepiariver/unique-set";
const { MapSet, UniqueSet } = require("@sepiariver/unique-set");
```

Version 3 has breaking changes: older versions are deprecated, and their configuration options are gone. Usage matches the native `Set`, apart from the [differences](#differences-from-native-set) listed below.

## API

### Constructor

```js
new MapSet(iterable?)
new UniqueSet(iterable?)
```

Accepts any iterable (array, Set, generator, etc.) and discards duplicate values.

### Methods

| Method | Description |
| --- | --- |
| `add(value)` | Adds `value` if no deeply-equal value exists. Returns `this`. |
| `has(value)` | Returns `true` if a deeply-equal value is in the set. |
| `delete(value)` | Removes the deeply-equal value, whatever its reference. Returns `true` if found. |
| `clear()` | Removes all values. |
| `forEach(cb, thisArg?)` | Calls `cb(value, value, set)` for each value. |
| `values()` | Returns an iterator over all values. |
| `[Symbol.iterator]()` | Makes the set iterable (e.g., `for...of`, spread). |
| `size` | The number of unique values in the set. |
| `keys()` | The same as `values()`, as on `Set`. |
| `entries()` | Returns an iterator of `[value, value]` pairs, as on `Set`. |
| `union(other)` | Returns a new set with the values of this set, then those of `other` that it lacks. `other` is any set-like object (`size`, `has()`, `keys()`), as for the ES2025 `Set` methods. |
| `intersection(other)` | Returns a new set with the values of this set that `other` also has. |
| `difference(other)` | Returns a new set with the values of this set that `other` does not have. |
| `symmetricDifference(other)` | Returns a new set with the values in exactly one of this set and `other`. |
| `isSubsetOf(other)` | Returns `true` if `other` has every value of this set. |
| `isSupersetOf(other)` | Returns `true` if this set has every value of `other`. |
| `isDisjointFrom(other)` | Returns `true` if this set and `other` have no value in common. |

### Examples

```js
const set = new UniqueSet();

set.add({ a: 1, b: 2 });
set.add({ b: 2, a: 1 }); // same value, different key order: not added
set.size; // 1

set.has({ a: 1, b: 2 }); // true (deep equality, not reference)

set.add([1, [2, 3]]);
set.add([1, [2, 3]]); // duplicate nested array: not added
set.size; // 2

set.delete({ a: 1, b: 2 }); // true
set.size; // 1

new UniqueSet(["a", "a", 1, 1, [1, 2], [1, 2]]).size; // 3, where Set gives 4
```

### Considerations

- **Memory**: Values are stored once each, in a `Map` keyed by their 32-bit structural hash. A lone value is the `Map` entry's value itself, and an array is allocated only when two values share a hash.
- **Collisions**: At 100,000 values, about one pair of values is expected to share a hash (the birthday bound for 32 bits). `fast-equals` tells them apart, so a collision costs a comparison but never a wrong result.
- **Equality semantics**: The structural hash follows `fast-equals`' comparison for every kind of value, so equal values always share a bucket.
  - **Plain objects**: Key order is ignored.
  - **Arrays**: Element order matters.
  - **`Set` values**: Insertion order is ignored, and elements compare by deep equality: `new Set([1, 2])` equals `new Set([2, 1])`.
  - **`Map` values**: Insertion order is ignored, and both keys and values compare by deep equality.
  - **Primitives**: `NaN` equals `NaN`, and `0` equals `-0`.
  - **Class instances**: Equal only to instances of the same class, and compared by their own enumerable properties. `#private` fields are invisible to the comparison, so instances that differ only in private state are treated as equal and only the first is kept: `new Counter(1)` and `new Counter(2)` deduplicate to one value when `Counter` stores its count in `#count`. When that state should count, expose it as an enumerable property or add a derived plain value.
  - **Other built-ins**: `Date`, `RegExp`, `URL`, `ArrayBuffer`, typed arrays, `DataView` and boxed primitives compare by contents. Enumerable properties added to any of these, or to a `Map` or `Set`, are ignored. Errors compare their `name`, `message`, `stack`, `cause` and enumerable own properties. A `DataView` whose buffer has been detached, or has shrunk below it, compares as an empty view at offset 0. React and Preact elements ignore their owner fields (`_owner`, `__o`, `__v`).
  - **Objects compared by reference**: Built-ins without a comparison of their own, such as `URLSearchParams`, `Blob`, `WeakMap` and `Promise`, and class instances with a `then` method, are equal only to themselves. Each is hashed by its identity, so it gets its own bucket, and `structuralHash()` returns a value that identifies that object only within the running process.
  - **Values from another realm** (such as a `vm` context or an iframe): Never equal to the same value built in this realm, because constructors must match, but compared with each other by contents like the built-ins above.
  - **Functions and symbols**: Compared by reference. They hash by their string representation (`String(value)`), so same-source functions may share a bucket.
- **Circular references**: Supported.
  - A value nested more than 256 objects deep, which includes every circular value, is hashed from its top 3 levels only and compared with `fast-equals`' `circularDeepEqual` semantics. Such values that agree in their top 3 levels share a bucket and are told apart by comparison, one by one.
  - `circularDeepEqual` pairs each object with its counterpart, so two values are equal only when their cycles line up: `a = { self: a }` equals `{ self: b }` where `b = { self: b }`, but `x = [x]` does not equal `[[y]]` where `y = [y]`.
  - UniqueSet uses its own copy of that pairing check, because the one in `fast-equals` 6.1.1 overflows the stack on some equal `Set`s and `Map`s that contain themselves, when their insertion orders differ.
  - Comparing two equal acyclic values still overflows the stack once they are nested deep enough: somewhere past 1,000 levels in Node.js 24 with the default stack size, depending on the values' shape.

#### Differences from native `Set`

- A `MapSet` is not `instanceof Set`.
- Values whose hashes collide break insertion order: `['1lhyg3m', 'x', 'prr3b2']` iterates as `['1lhyg3m', 'prr3b2', 'x']`, because the first and last share a bucket.
- Set algebra uses `other.has()` whenever the ES2025 algorithm calls it, so with a native `Set` argument the result depends on which side is smaller. `new UniqueSet([{ a: 1 }]).intersection(new Set([{ a: 1 }]))` has size 0, because the loop runs over this set and `Set.has` compares by reference. With `{ b: 2 }` added to the UniqueSet, the same call has size 1, because the loop then runs over the native `Set` and looks each value up here by deep equality. Pass a `MapSet` as `other` for deep equality on both paths.

## Testing

1. Clone this repo
2. `npm install`
3. `npm run test`

Benchmark commands are in [PERF.md](PERF.md#method).

## Issues

Issue reporting is encouraged: <https://github.com/sepiariver/unique-set/issues>

## Contributing

Submit pull requests to <https://github.com/sepiariver/unique-set/pulls>

## Contributors

### Human

- @sepiariver
- [@sakgoyal](https://github.com/sakgoyal), who instigated and contributed ESM support.

### AI

Through various versions of this package, I've leveraged Opus 4.x through 5.5 for research, analysis and contributions in the areas of:

- performance optimization
- testing and test fixture preparation
- competitive analysis and benchmarking
- native Set API parity

## License

MIT
