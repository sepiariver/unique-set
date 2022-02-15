# @sepiariver/unique-set

Extends the `add` method on the native JavaScript Set object to compare using [fast-deep-equal](https://www.npmjs.com/package/fast-deep-equal)

The extended method iterates through the elements of the Set until equality is found. If no elements match, the entire Set would have been iterated to determine so. For a very large Set, there is probably a better way to achieve what you're trying to do, otherwise UniqueSet can be very convenient.

## Installation

```cli
npm install @sepiariver/unique-set
```

### Usage

```js
const UniqueSet = require('@sepiariver/unique-set');

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

let unique = new UniqueSet();
data.forEach((el) => {
  unique.add(el);
});
console.log(unique.size); // 6 instead of 8 with Set
```
