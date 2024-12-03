# @sepiariver/unique-set

Extends the native `Set` class to deeply compare using [fast-deep-equal](https://www.npmjs.com/package/fast-deep-equal), with optional Bloom filter optimization.

Supports ESM and CommonJS.

WARNING: This version exports 2 classes instead of a single default class, breaking b/c with version 1.

The extended methods iterate through the elements of the `UniqueSet` until equality is found. If no elements match, the entire `UniqueSet` would have been iterated. However fast `fast-deep-equal` is, calling it in a loop like this makes performance many, many times worse than the native `Set`. For datasets greater than a thousand elements, there is probably a better way to achieve what you're trying to do. Otherwise, `UniqueSet` is convenient.

Version 2 ships with `BloomSet`, in which equality checks are optimized with a Bloom filter. This class is useful for larger datasets, with performance about 2-10 times better than `UniqueSet` for datasets greater than 1000 elements. The probabilistic false positives are covered by a fallback to `fast-deep-equal`. Still orders of magnitude slower than the native `Set`, but if deep equality is required, this is a decent option.

NOTE: the `delete` method is unmodified. In the case of duplicate objects that are equivalent but have different references, `results` of delete operations may be unexpected.

Requires @babel/core 7+

## Installation

```cli
npm install @sepiariver/unique-set
```

## Usage

```js
const { BloomSet, UniqueSet } = require('@sepiariver/unique-set');

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

const unique1 = new UniqueSet();
data.forEach((el) => {
  unique1.add(el);
});
const unique2 = new UniqueSet(data);
console.log(unique1.size); // 6 instead of 8 with Set
console.log(unique2.size); // 6

const bloom1 = new BloomSet();
data.forEach((el) => {
  bloom1.add(el);
});
const bloom2 = new BloomSet(data);
console.log(bloom1.size); // 6 instead of 8 with Set
console.log(bloom2.size); // 6
```

## Testing

1. Clone this repo
2. `npm install`
3. `npm run test`

## Contributing

Submit pull requests to [https://github.com/sepiariver/unique-set/pulls]

## Issues

Issue reporting is encouraged: [https://github.com/sepiariver/unique-set/issues]
