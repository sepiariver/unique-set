# @sepiariver/unique-set
Extends the add method on the native JavaScript Set object to compare using fast-deep-equal

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

let common = new Set();
data.forEach((el) => {
  common.add(el);
});
console.log(common);

let unique = new UniqueSet();
data.forEach((el) => {
  unique.add(el);
});
```
