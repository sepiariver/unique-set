import { MapSet } from "../dist/index.mjs";
import { describe, it, expect } from "vitest";

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

    // Adding functions (functions are compared by reference via deep-equal)
    const fn = () => {};
    edgeCaseSet.add(fn);
    edgeCaseSet.add(() => {}); // Different function reference
    expect(edgeCaseSet.size).toBe(4);
    expect(edgeCaseSet.has(fn)).toBeTruthy();
  });

  it("distinguishes values across types", () => {
    const set = new MapSet();
    // Falsy values are all distinct
    set.add(0);
    set.add(false);
    set.add(null);
    set.add(undefined);
    set.add("");
    set.add(NaN);
    expect(set.size).toBe(6);

    // Number vs numeric string
    set.add(1);
    set.add("1");
    expect(set.size).toBe(8);

    // Empty containers
    set.add({});
    set.add([]);
    expect(set.size).toBe(10);

    // All still findable
    expect(set.has(0)).toBeTruthy();
    expect(set.has(false)).toBeTruthy();
    expect(set.has("1")).toBeTruthy();
    expect(set.has({})).toBeTruthy();
    expect(set.has([])).toBeTruthy();
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
    expect(nested.size).toBe(4);
  });
});
