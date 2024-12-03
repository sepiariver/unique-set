# @sepiariver/unique-set

Extends the native `Set` class to deeply compare using [fast-deep-equal](https://www.npmjs.com/package/fast-deep-equal), with optional Bloom filter optimization.

Supports ESM and CommonJS.

WARNING: This version exports 2 classes instead of a single default class, breaking b/c with version 1.

The extended methods iterate through the elements of the `UniqueSet` until equality is found. If no elements match, the entire `UniqueSet` would have been iterated. However fast `fast-deep-equal` is, calling it in a loop like this makes performance many, many times worse than the native `Set`. For datasets greater than a thousand elements, there is probably a better way to achieve what you're trying to do. Otherwise, `UniqueSet` is convenient.

UPDATE: Version 2 ships with `BloomSet`, in which equality checks are optimized with a Bloom filter. This class is useful for larger datasets, performing about 3-10 times faster than `UniqueSet` for datasets greater than 1000 elements. Less than a few hundred (~400) elements, `UniqueSet` is faster. `BloomSet`'s probabilistic false positives are covered by a fallback to `fast-deep-equal`. BloomSet is still orders of magnitude slower than the native `Set`, but if deep equality is required, this is a decent option.

Experiment with configurations to find the best performance for your use case.

NOTE: The `delete` method is unmodified. In the case of duplicate objects that are equivalent but have different references, the results of `delete` operations may be unexpected.

## Config Options

### Constructor Signature

`new BloomSet(iterable = [], options = { size, hashCount });`

### Options

The options object allows you to customize the behavior and performance of the BloomSet. The following properties can be configured:

#### 1. size (number)

Description: Specifies the size of the bit array used internally by the Bloom filter. This directly impacts the memory usage and false positive probability.

Default: 6,553,577 (a prime number using roughly 800 KB of memory).

Recommendations:

For datasets with ~100,000 elements, this default size provides excellent performance (compared against `UniqueSet`) with minimal (< 1) false positives.

Larger datasets may require increasing the size for lower false positive rates. Remember though, false positives are mitigated by a fallback to `fast-deep-equal`, so you may be able to squeeze more performance from a higher tolerance for false positives, depending on your dataset.

#### 2. hashCount (number)

Description: Specifies the number of hash functions used by the Bloom filter. This impacts both the false positive probability and the computational cost of adding/checking elements.

Default: 7

### Examples

Default Configuration:

```js
const bloomSet = new BloomSet();
bloomSet.add("example");
console.log(bloomSet.has("example")); // true
```

Custom Configuration for Larger Datasets:

Example 28,755,000 bit array size uses roughly 3.5 MB of memory, but this configuration is robust against datasets of something like 1M elements. The practicality of using BloomSet with that many elements is low, due to the performance hit of deep equality checks.

```js
const bloomSet = new BloomSet([], { size: 28755000, hashCount: 20 });
bloomSet.add("custom");
console.log(bloomSet.has("custom")); // true
```

### Considerations

- Memory Usage: The bit array uses size / 8 bytes of memory. Even at 800 KB, initializing 1250 BloomSets in the same scope would use a gigabyte of memory.
- False Positive Rate: The probability of a false positive is influenced by size, hashCount, and the number of elements. Adjust these values to balance performance and accuracy for your dataset.

#### Further Tuning

- Use a larger size for datasets exceeding 100,000 elements.
- Reduce hashCount if performance is critical and your dataset contains very few duplicates.


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
