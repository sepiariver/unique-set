# @sepiariver/unique-set

Extends the native `Set` class to deeply compare using [fast-deep-equal](https://www.npmjs.com/package/fast-deep-equal), with optional Bloom filter optimization.

Supports ESM and CommonJS. Thanks @sakgoyal for contributing to and instigating ESM support.

```js
import { BloomSet, UniqueSet } from '@sepiariver/unique-set';
```

```js
const { BloomSet, UniqueSet } = require('@sepiariver/unique-set');
```

WARNING: This version exports 2 classes instead of a single default class, breaking b/c with version 1.

The overridden methods iterate through the elements of the `UniqueSet` deeply comparing equality until existence is found. If no elements match, the entire `UniqueSet` would have been iterated. However fast `fast-deep-equal` is [reported to be](https://github.com/epoberezkin/fast-deep-equal?tab=readme-ov-file#performance-benchmark), its time complexity is dependent on the depth of objects being compared. Calling it in a loop makes performance many, many times worse than the native `Set`.

_For datasets greater than a thousand elements, there is probably a better way to achieve what you're trying to do._ Otherwise, `UniqueSet` is convenient.

**UPDATE:** Version 2 ships with `BloomSet`, which uses a Bloom filter to greatly optimize absence checks, falling back to `fast-deep-equal` to validate potential false positives. This class is useful for larger datasets, up to the tens of thousands or even 100k depending largely on configuration. It performs about 3-10 times faster than `UniqueSet` for datasets greater than 1000 elements. Less than a few hundred (~400) elements, `UniqueSet` can be faster—it all depens on your dataset and config options. In all scenarios except the absolute best case, BloomSet is still orders of magnitude slower than the native `Set`, but if deep equality is required, this is a decent option.

Highly recommended: experiment with config options to find the best performance for your use case.

IMPORTANT: The `delete` method is unmodified in both classes. In the case of duplicate objects that are equivalent but have different references, the results of `delete` operations may be unexpected.

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

## Issues

Issue reporting is encouraged: [https://github.com/sepiariver/unique-set/issues]

## Contributing

Submit pull requests to [https://github.com/sepiariver/unique-set/pulls]

## Contributors

- @sepiariver
- @sakgoyal

## License

MIT
