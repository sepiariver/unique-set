import { MapSet, type SetLike } from "../dist/index.mjs";
import fc from "fast-check";
import { describe, it, expect } from "vitest";
import { collidingStrings } from "./fixtures/collisions";

const [strA, strB] = collidingStrings;

// The ES2025 Set methods, which the repo's ES2023 lib does not declare.
type Algebra = {
  [K in "union" | "intersection" | "difference" | "symmetricDifference"]: (
    other: SetLike<unknown>,
  ) => Iterable<unknown>;
} & {
  [K in "isSubsetOf" | "isSupersetOf" | "isDisjointFrom"]: (other: SetLike<unknown>) => boolean;
};
const native = (items: Iterable<unknown>) => new Set(items) as unknown as Algebra;

const setMethods = ["union", "intersection", "difference", "symmetricDifference"] as const;
const predicates = ["isSubsetOf", "isSupersetOf", "isDisjointFrom"] as const;

/** A set-like over `items` that logs each property read and call. */
function spySetLike(items: unknown[], log: string[], size: number = items.length) {
  const set = new Set(items);
  return {
    get size() {
      log.push("size");
      return size;
    },
    get has() {
      log.push("get has");
      return (value: unknown) => {
        log.push(`has(${String(value)})`);
        return set.has(value);
      };
    },
    get keys() {
      log.push("get keys");
      return () => {
        log.push("keys()");
        const inner = set.values();
        return {
          next: () => inner.next(),
          return: () => {
            log.push("return()");
            return { done: true, value: undefined };
          },
        };
      };
    },
  };
}

describe("MapSet Set interface", () => {
  it("has keys(), entries() and Symbol.iterator alongside values()", () => {
    const set = new MapSet(["a", strA, "b", strB]);
    const values = [...set.values()];
    expect([...set.keys()]).toEqual(values);
    expect([...set]).toEqual(values);
    expect([...set.entries()]).toEqual(values.map((v) => [v, v]));
  });

  it("reports its tag to Object.prototype.toString", () => {
    expect(Object.prototype.toString.call(new MapSet())).toBe("[object MapSet]");
  });

  it("constructs empty from null or undefined, and rejects other non-iterables", () => {
    expect(new MapSet(null).size).toBe(0);
    expect(new MapSet(undefined).size).toBe(0);
    expect(() => new MapSet(5 as unknown as Iterable<number>)).toThrow(TypeError);
    expect(() => new MapSet({} as Iterable<number>)).toThrow(TypeError);
  });

  it("rejects a forEach callback that is not a function, even when empty", () => {
    expect(() => new MapSet().forEach(null as never)).toThrow(TypeError);
  });
});

describe("MapSet set algebra matches native Set on primitives", () => {
  const items = fc.array(fc.integer({ min: 1, max: 12 }), { maxLength: 10 });

  it("for MapSet, Set and Map arguments, in the same order", () => {
    fc.assert(
      fc.property(items, items, (left, right) => {
        const expected = native(left);
        const others: SetLike<unknown>[] = [
          new MapSet(right),
          new Set(right),
          new Map(right.map((x) => [x, String(x)])),
        ];
        for (const other of others) {
          for (const method of setMethods) {
            expect([...new MapSet<unknown>(left)[method](other)]).toEqual([...expected[method](other)]);
          }
          for (const method of predicates) {
            expect(new MapSet<unknown>(left)[method](other)).toBe(expected[method](other));
          }
        }
      }),
    );
  });

  it("reads the argument and drives the loop from the same side", () => {
    fc.assert(
      fc.property(items, items, fc.integer({ min: -2, max: 2 }), (left, right, skew) => {
        // A size that disagrees with the contents shows which side each method iterates.
        const size = Math.max(0, new Set(right).size + skew);
        for (const method of [...setMethods, ...predicates]) {
          const mine: string[] = [];
          const theirs: string[] = [];
          const result = new MapSet<unknown>(left)[method](spySetLike(right, mine, size));
          const expected = native(left)[method](spySetLike(right, theirs, size));
          expect(mine).toEqual(theirs);
          if (typeof expected === "boolean") expect(result).toBe(expected);
          else expect([...(result as Iterable<unknown>)]).toEqual([...expected]);
        }
      }),
    );
  });

  it("validates the argument as native Set does", () => {
    const cases: unknown[] = [
      null,
      1,
      [1, 2],
      { size: undefined, has: () => true, keys: () => [].values() },
      { size: "x", has: () => true, keys: () => [].values() },
      { size: -1, has: () => true, keys: () => [].values() },
      { size: 1n, has: () => true, keys: () => [].values() },
      { size: 1, has: true, keys: () => [].values() },
      { size: 1, has: () => true, keys: 1 },
      { size: 0, has: () => true, keys: () => 1 },
      { size: 0, has: () => true, keys: () => ({ next: () => 1 }) },
    ];
    for (const other of cases) {
      for (const method of [...setMethods, ...predicates]) {
        let expected: unknown;
        let actual: unknown;
        try {
          native([1, 2])[method](other as SetLike<unknown>);
        } catch (error) {
          expected = (error as Error).constructor;
        }
        try {
          new MapSet([1, 2])[method](other as SetLike<unknown>);
        } catch (error) {
          actual = (error as Error).constructor;
        }
        expect(actual, `${method}(${String(other)})`).toBe(expected);
      }
    }
  });

  it("accepts an infinite size", () => {
    const everything = { size: Infinity, has: () => true, keys: () => [].values() };
    expect(new MapSet([1]).isSubsetOf(everything)).toBe(true);
    expect(new MapSet([1]).isSupersetOf(everything)).toBe(false);
    expect([...new MapSet([1]).intersection(everything)]).toEqual([1]);
  });
});

describe("MapSet set algebra with deep equality", () => {
  const a = { id: 1 };
  const b = { id: 2 };
  const c = { id: 3 };

  it("matches deep copies from a MapSet argument", () => {
    const set = new MapSet([a, b]);
    const other = new MapSet([{ id: 2 }, { id: 3 }]);
    expect([...set.union(other)]).toEqual([a, b, c]);
    expect(set.union(other).size).toBe(3);
    expect([...set.difference(other)]).toEqual([a]);
    expect([...set.symmetricDifference(other)]).toEqual([a, c]);
    expect(set.isDisjointFrom(other)).toBe(false);
    expect(set.isSubsetOf(new MapSet([{ id: 3 }, { id: 2 }, { id: 1 }]))).toBe(true);
    expect(set.isSupersetOf(new MapSet([{ id: 1 }]))).toBe(true);
  });

  it("keeps this set's values in an intersection, whichever side is smaller", () => {
    const set = new MapSet([a, b]);
    const thisDrives = set.intersection(new MapSet([{ id: 2 }, { id: 2, x: 1 }, { id: 3 }]));
    const otherDrives = set.intersection(new MapSet([{ id: 2 }]));
    expect([...thisDrives]).toEqual([b]);
    expect([...thisDrives][0]).toBe(b);
    expect([...otherDrives][0]).toBe(b);
  });

  it("defers to other.has() for membership, so a Set argument matches by reference", () => {
    const set = new MapSet([a, b, c]);
    expect(set.intersection(new Set([{ id: 1 }, { id: 2 }, b, { id: 9 }])).size).toBe(1);
    // When the argument is smaller, its values are looked up in this set, by deep equality.
    expect(set.intersection(new Set([{ id: 1 }, { id: 2 }])).size).toBe(2);
  });

  it("keeps colliding values in separate result buckets", () => {
    const set = new MapSet([strA, strB, "x"]);
    expect([...set.difference(new MapSet([strA]))]).toEqual([strB, "x"]);
    expect([...set.intersection(new MapSet([strB, "y", "z", "w"]))]).toEqual([strB]);
    expect([...set.symmetricDifference(new MapSet([strB, "y"]))]).toEqual([strA, "x", "y"]);

    const union = set.union(new MapSet());
    union.delete(strA);
    expect([...set]).toEqual([strA, strB, "x"]);
  });

  it("handles circular values on either side", () => {
    const loop = (id: number) => {
      const node: Record<string, unknown> = { id };
      node.self = node;
      return node;
    };
    const set = new MapSet([loop(1), loop(2)]);
    expect(set.union(new MapSet([loop(2), loop(3)])).size).toBe(3);
    expect(set.intersection(new MapSet([loop(2)])).size).toBe(1);
    expect(set.intersection(new MapSet([loop(2), loop(4), loop(5)])).size).toBe(1);
    expect(set.difference(new MapSet([loop(1), loop(4), loop(5)])).size).toBe(1);
    expect(set.difference(new MapSet([loop(1)])).size).toBe(1);
    expect(set.symmetricDifference(new MapSet([loop(1), loop(3)])).size).toBe(2);
    expect(set.isDisjointFrom(new MapSet([loop(3)]))).toBe(true);
    expect(set.isSupersetOf(new MapSet([loop(1)]))).toBe(true);
  });
});
