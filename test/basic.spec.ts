import { BloomSet, CuckooSet, MapSet, UniqueSet } from "../dist/index.mjs";
import { describe, it, expect, test } from "vitest";

const data = [
  "string",
  "another string",
  "string",
  1,
  2,
  1,
  { foo: "bar", bar: "baz", baz: "lurman" },
  { bar: "baz", baz: "lurman", foo: "bar" }, // Same as above, different reference
  [1, 2, 3],
  [1, 2, 3], // Duplicate array
  NaN,
  NaN, // Duplicate NaN
];
const expected = [
  "string",
  "another string",
  1,
  2,
  { foo: "bar", bar: "baz", baz: "lurman" },
  [1, 2, 3],
  NaN,
];

describe("UniqueSet", () => {
  it("adds unique objects", () => {
    const unique = new UniqueSet();
    data.forEach((el) => unique.add(el));
    expect(Array.from(unique)).toEqual(expected);
    expect(unique.size).toBe(7);
  });

  it("complies with MDN reference", () => {
    const mySet1 = new UniqueSet();

    mySet1.add(1);
    mySet1.add(5);
    mySet1.add(5);
    mySet1.add("some text");
    const o = { a: 1, b: 2 };
    mySet1.add(o);
    mySet1.add({ a: 1, b: 2 }); // Should be treated as equal

    expect(mySet1.has(1)).toBeTruthy();
    expect(mySet1.has(3)).toBeFalsy();
    expect(mySet1.has(5)).toBeTruthy();
    expect(mySet1.has(Math.sqrt(25))).toBeTruthy();
    expect(mySet1.has("Some Text".toLowerCase())).toBeTruthy();
    expect(mySet1.has(o)).toBeTruthy();
    expect(mySet1.has({ a: 1, b: 2 })).toBeTruthy();
    expect(mySet1.size).toBe(4);

    mySet1.delete(5);
    expect(mySet1.has(5)).toBeFalsy();
    expect(mySet1.size).toBe(3);

    mySet1.clear();
    expect(mySet1.size).toBe(0);
  });

  it("works with the constructor", () => {
    const unique = new UniqueSet(data);
    expect(Array.from(unique)).toEqual(expected);
    expect(unique.size).toBe(7);

    const standard = new Set(data);
    expect(standard.size).toBe(9); // Standard Set treats NaN and duplicates differently
  });

  it("handles edge cases", () => {
    const edgeCaseSet = new UniqueSet();

    // Adding undefined
    edgeCaseSet.add(undefined);
    edgeCaseSet.add(undefined); // Duplicate
    expect(edgeCaseSet.size).toBe(1);
    expect(edgeCaseSet.has(undefined)).toBeTruthy();

    // Adding null
    edgeCaseSet.add(null);
    edgeCaseSet.add(null); // Duplicate
    expect(edgeCaseSet.size).toBe(2);
    expect(edgeCaseSet.has(null)).toBeTruthy();

    // Adding functions (functions are treated as unique)
    const fn = () => {};
    edgeCaseSet.add(fn);
    edgeCaseSet.add(() => {}); // Different function reference
    expect(edgeCaseSet.size).toBe(4);
    expect(edgeCaseSet.has(fn)).toBeTruthy();
  });

  it("handles nested objects and arrays", () => {
    const nested = new UniqueSet();

    nested.add({ a: { b: 1 } });
    nested.add({ a: { b: 1 } }); // Should be treated as equal
    nested.add({ a: { b: 2 } }); // Different
    expect(nested.size).toBe(2);

    nested.add([1, [2, 3]]);
    nested.add([1, [2, 3]]); // Should be treated as equal
    nested.add([1, [3, 2]]); // Different (because order matters)
    expect(nested.size).toBe(4); // Adjust to expect 4
  });
});

describe("BloomSet", () => {
  it("adds unique objects", () => {
    const unique = new BloomSet();
    data.forEach((el) => unique.add(el));

    expect(Array.from(unique)).toEqual(expected);
    expect(unique.size).toBe(7);
  });

  it("complies with MDN reference", () => {
    const mySet1 = new BloomSet();

    mySet1.add(1);
    mySet1.add(5);
    mySet1.add(5);
    mySet1.add("some text");
    const o = { a: 1, b: 2 };
    mySet1.add(o);
    mySet1.add({ a: 1, b: 2 }); // Should be treated as equal

    expect(mySet1.has(1)).toBeTruthy();
    expect(mySet1.has(3)).toBeFalsy();
    expect(mySet1.has(5)).toBeTruthy();
    expect(mySet1.has(Math.sqrt(25))).toBeTruthy();
    expect(mySet1.has("Some Text".toLowerCase())).toBeTruthy();
    expect(mySet1.has(o)).toBeTruthy();
    expect(mySet1.has({ a: 1, b: 2 })).toBeTruthy();
    expect(mySet1.size).toBe(4);

    mySet1.delete(5);
    expect(mySet1.has(5)).toBeFalsy();
    expect(mySet1.size).toBe(3);

    mySet1.clear();
    expect(mySet1.size).toBe(0);
  });

  it("works with the constructor", () => {
    const unique = new BloomSet(data);
    expect(Array.from(unique)).toEqual(expected);
    expect(unique.size).toBe(7);

    const standard = new Set(data);
    expect(standard.size).toBe(9); // Standard Set treats NaN and duplicates differently
  });

  it("handles edge cases", () => {
    const edgeCaseSet = new BloomSet();

    // Adding undefined
    edgeCaseSet.add(undefined);
    edgeCaseSet.add(undefined); // Duplicate
    expect(edgeCaseSet.size).toBe(1);
    expect(edgeCaseSet.has(undefined)).toBeTruthy();

    // Adding null
    edgeCaseSet.add(null);
    edgeCaseSet.add(null); // Duplicate
    expect(edgeCaseSet.size).toBe(2);
    expect(edgeCaseSet.has(null)).toBeTruthy();

    // Adding functions (functions are treated as unique)
    const fn = () => {};
    edgeCaseSet.add(fn);
    edgeCaseSet.add(() => {}); // Different function reference
    expect(edgeCaseSet.size).toBe(4);
    expect(edgeCaseSet.has(fn)).toBeTruthy();
  });

  it("handles nested objects and arrays", () => {
    const nested = new BloomSet();

    nested.add({ a: { b: 1 } });
    nested.add({ a: { b: 1 } }); // Should be treated as equal
    nested.add({ a: { b: 2 } }); // Different
    expect(nested.size).toBe(2);

    nested.add([1, [2, 3]]);
    nested.add([1, [2, 3]]); // Should be treated as equal
    nested.add([1, [3, 2]]); // Different (because order matters)
    expect(nested.size).toBe(4); // Adjust to expect 4
  });
});

describe("MapSet", () => {
  it("adds unique objects", () => {
    const unique = new MapSet();
    data.forEach((el) => unique.add(el));
    expect(Array.from(unique)).toEqual(expected);
    expect(unique.size).toBe(7);
  });

  it("complies with MDN reference", () => {
    const mySet1 = new MapSet();

    mySet1.add(1);
    mySet1.add(5);
    mySet1.add(5);
    mySet1.add("some text");
    const o = { a: 1, b: 2 };
    mySet1.add(o);
    mySet1.add({ a: 1, b: 2 }); // Should be treated as equal

    expect(mySet1.has(1)).toBeTruthy();
    expect(mySet1.has(3)).toBeFalsy();
    expect(mySet1.has(5)).toBeTruthy();
    expect(mySet1.has(Math.sqrt(25))).toBeTruthy();
    expect(mySet1.has("Some Text".toLowerCase())).toBeTruthy();
    expect(mySet1.has(o)).toBeTruthy();
    expect(mySet1.has({ a: 1, b: 2 })).toBeTruthy();
    expect(mySet1.size).toBe(4);

    mySet1.delete(5);
    expect(mySet1.has(5)).toBeFalsy();
    expect(mySet1.size).toBe(3);

    mySet1.clear();
    expect(mySet1.size).toBe(0);
  });

  it("works with the constructor", () => {
    const unique = new MapSet(data);
    expect(Array.from(unique)).toEqual(expected);
    expect(unique.size).toBe(7);

    const standard = new Set(data);
    expect(standard.size).toBe(9); // Standard Set treats NaN and duplicates differently
  });

  it("handles edge cases", () => {
    const edgeCaseSet = new MapSet();

    // Adding undefined
    edgeCaseSet.add(undefined);
    edgeCaseSet.add(undefined); // Duplicate
    expect(edgeCaseSet.size).toBe(1);
    expect(edgeCaseSet.has(undefined)).toBeTruthy();

    // Adding null
    edgeCaseSet.add(null);
    edgeCaseSet.add(null); // Duplicate
    expect(edgeCaseSet.size).toBe(2);
    expect(edgeCaseSet.has(null)).toBeTruthy();

    // Adding functions (functions are treated as unique)
    const fn = () => {};
    edgeCaseSet.add(fn);
    edgeCaseSet.add(() => {}); // Serialization makes these equivalent!
    expect(edgeCaseSet.size).toBe(3);
    expect(edgeCaseSet.has(fn)).toBeTruthy();
  });

  it("handles nested objects and arrays", () => {
    const nested = new MapSet();

    nested.add({ a: { b: 1 } });
    nested.add({ a: { b: 1 } }); // Should be treated as equal
    nested.add({ a: { b: 2 } }); // Different
    expect(nested.size).toBe(2);

    nested.add([1, [2, 3]]);
    nested.add([1, [2, 3]]); // Should be treated as equal
    nested.add([1, [3, 2]]); // Different (because order matters)
    expect(nested.size).toBe(4); // Adjust to expect 4
  });
});

describe("CuckooSet", () => {
  it("adds unique objects", () => {
    const unique = new CuckooSet();
    data.forEach((el) => unique.add(el));

    expect(Array.from(unique)).toEqual(expected);
    expect(unique.size).toBe(7);
  });

  it("complies with MDN reference", () => {
    const mySet1 = new CuckooSet();

    mySet1.add(1);
    mySet1.add(5);
    mySet1.add(5);
    mySet1.add("some text");
    const o = { a: 1, b: 2 };
    mySet1.add(o);
    mySet1.add({ a: 1, b: 2 }); // Should be treated as equal

    expect(mySet1.has(1)).toBeTruthy();
    expect(mySet1.has(3)).toBeFalsy();
    expect(mySet1.has(5)).toBeTruthy();
    expect(mySet1.has(Math.sqrt(25))).toBeTruthy();
    expect(mySet1.has("Some Text".toLowerCase())).toBeTruthy();
    expect(mySet1.has(o)).toBeTruthy();
    expect(mySet1.hasByValue({ a: 1, b: 2 })).toBeTruthy();
    expect(mySet1.size).toBe(4);

    mySet1.delete(5);
    expect(mySet1.has(5)).toBeFalsy();
    expect(mySet1.size).toBe(3);

    mySet1.clear();
    expect(mySet1.size).toBe(0);
  });

  it("works with the constructor", () => {
    const unique = new CuckooSet(data);
    expect(Array.from(unique)).toEqual(expected);
    expect(unique.size).toBe(7);

    const standard = new Set(data);
    expect(standard.size).toBe(9); // Standard Set treats NaN and duplicates differently
  });

  it("handles edge cases", () => {
    const edgeCaseSet = new CuckooSet();

    // Adding undefined
    edgeCaseSet.add(undefined);
    edgeCaseSet.add(undefined); // Duplicate
    expect(edgeCaseSet.size).toBe(1);
    expect(edgeCaseSet.has(undefined)).toBeTruthy();

    // Adding null
    edgeCaseSet.add(null);
    edgeCaseSet.add(null); // Duplicate
    expect(edgeCaseSet.size).toBe(2);
    expect(edgeCaseSet.has(null)).toBeTruthy();

    // Adding functions (functions are treated as unique)
    const fn = () => {};
    edgeCaseSet.add(fn);
    edgeCaseSet.add(() => {}); // Deduped function won't be added
    expect(edgeCaseSet.size).toBe(3);
    expect(edgeCaseSet.has(fn)).toBeTruthy();
  });

  it("handles nested objects and arrays", () => {
    const nested = new CuckooSet();

    nested.add({ a: { b: 1 } });
    nested.add({ a: { b: 1 } }); // Should be treated as equal
    nested.add({ a: { b: 2 } }); // Different
    expect(nested.size).toBe(2);

    nested.add([1, [2, 3]]);
    nested.add([1, [2, 3]]); // Should be treated as equal
    nested.add([1, [3, 2]]); // Different (because order matters)
    expect(nested.size).toBe(4); // Adjust to expect 4
  });
});
