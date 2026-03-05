# @sepiariver/unique-set

Uses a streaming structural hash to optimize deep equality checks in a `Set`-like class. Falls back to deeply compare using [fast-deep-equal](https://www.npmjs.com/package/fast-deep-equal) when hash collisions occur.

Supports ESM and CommonJS. Thanks [@sakgoyal](https://github.com/sakgoyal) for contributing to and instigating ESM support.

```js
import { MapSet, UniqueSet } from '@sepiariver/unique-set';
```

```js
const { MapSet, UniqueSet } = require('@sepiariver/unique-set');
```

WARNING: Version 3 includes breaking changes. Older versions are deprecated.

Configuration options from previous versions are no longer supported. Usage is identical to the native `Set` class.

IMPORTANT: `MapSet` and `UniqueSet` are the same class (`UniqueSet` is an alias). The `delete` method uses deep equality, so `delete({a: 1})` will remove a previously added `{a: 1}` even if it's a different reference.

## API

### Constructor

```js
new MapSet(iterable?)
new UniqueSet(iterable?)
```

Accepts any iterable (array, Set, generator, etc.). Duplicates by value are discarded during construction.

### Methods

| Method | Description |
|---|---|
| `add(value)` | Adds `value` if no deeply-equal value exists. Returns `this`. |
| `has(value)` | Returns `true` if a deeply-equal value is in the set. |
| `delete(value)` | Removes the first deeply-equal value. Returns `true` if found. |
| `clear()` | Removes all values. |
| `forEach(cb, thisArg?)` | Calls `cb(value, value, set)` for each value. |
| `values()` | Returns an iterator over all values. |
| `[Symbol.iterator]()` | Makes the set iterable (e.g., `for...of`, spread). |
| `size` | The number of unique values in the set. |

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
```

### Considerations

- **Memory**: Each unique value is stored once, bucketed by a 32-bit structural hash. Overhead is minimal: one `Map` entry plus a small array per hash bucket, with >99% of buckets containing exactly one item at typical sizes.
- **Collisions**: At 20,000 items, roughly 47 hash collisions are expected (birthday paradox on 32-bit). Collisions are handled correctly via `fast-deep-equal`. They add a small cost but never affect correctness.
- **Equality semantics**: Object key order is ignored. Array element order matters. `NaN === NaN`. `0` and `-0` are treated as equal. Functions and symbols are compared by reference.

## Installation

```cli
npm install @sepiariver/unique-set
```

## Usage

```js
import { MapSet, UniqueSet } from "./dist/index.mjs";

const data = [
  "string",
  "another string",
  "string",
  1,
  2,
  1,
  {
    foo: "bar",
    bar: "baz",
    baz: "lurman",
  },
  {
    bar: "baz",
    baz: "lurman",
    foo: "bar",
  },
  [1, 2, 3],
  [1, 2, 3],
];

const norm = new Set();
const unique1 = new UniqueSet();
data.forEach((el) => {
  unique1.add(el);
  norm.add(el);
});
const unique2 = new UniqueSet(data);
console.log(unique1.size); // 6 instead of 8 with Set
console.log(unique2.size); // 6
console.log(norm.size); // 8 with Set

const map1 = new MapSet();
data.forEach((el) => {
  map1.add(el);
});
const map2 = new MapSet(data);
console.log(map1.size); // 6 instead of 8 with Set
console.log(map2.size); // 6
```

## Testing

1. Clone this repo
2. `npm install`
3. `npm run test`

## Issues

Issue reporting is encouraged: [https://github.com/sepiariver/unique-set/issues]

## Contributing

Submit pull requests to [https://github.com/sepiariver/unique-set/pulls]

## Contributors

- @sepiariver
- @sakgoyal

## License

MIT
