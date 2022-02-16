# @sepiariver/unique-set

Extends the `has` and `add` methods on the native JavaScript `Set` object to use [fast-deep-equal](https://www.npmjs.com/package/fast-deep-equal) as the equality algorithm.

The extended methods iterate through the elements of the `UniqueSet` until equality is found. If no elements match, the entire `UniqueSet` would have been iterated to determine so. However fast `fast-deep-equal` is, calling it in a loop like this makes performance many times poorer than the native `Set`. For datasets greater than a thousand elements, there is probably a better way to achieve what you're trying to do. Otherwise, `UniqueSet` is convenient.

Requires @babel/core 7+

## Installation

```cli
npm install @sepiariver/unique-set
```

## Usage

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

let unique1 = new UniqueSet();
data.forEach((el) => {
  unique1.add(el);
});
let unique2 = new UniqueSet(data);
console.log(unique1.size); // 6 instead of 8 with Set
console.log(unique2.size); // 6
```

## Testing

1. Clone this repo
2. `npm install`
3. `npm run test`

## Contributing

Submit pull requests to [https://github.com/sepiariver/unique-set/pulls]
