import { MapSet, type SetLike } from "../dist/index.mjs";
import { deepEqual } from "fast-equals";
import fc from "fast-check";
import vm from "node:vm";
import { describe, it, expect } from "vitest";
import { collidingStrings, collidingWithUndefined } from "./fixtures/collisions";

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

// Primitives, on which deep equality and native Set's SameValueZero agree, several of them
// sharing a key, so that colliding values are added and deleted mid-iteration.
const primitive = fc.constantFrom<unknown>(undefined, ...collidingStrings, ...collidingWithUndefined, 0, 1, "x");
const mutation = fc.tuple(fc.constantFrom("add", "delete", "none"), primitive);
type Mutation = [string, unknown];

/** Applies `ops[0]` to `set` and drops it, so each mutation runs once. */
function mutate(set: { add(v: unknown): unknown; delete(v: unknown): unknown }, ops: Mutation[]): void {
  const op = ops.shift();
  if (op?.[0] === "add") set.add(op[1]);
  else if (op?.[0] === "delete") set.delete(op[1]);
}

describe("MapSet iteration while the set changes", () => {
  it("matches native Set step for step, with several iterators open", () => {
    const op = fc.oneof(
      mutation,
      fc.tuple(fc.constant("clear"), fc.constant(null)),
      fc.tuple(fc.constant("open"), fc.constant(null)),
      fc.tuple(fc.constant("next"), fc.nat(3)),
    );
    fc.assert(
      fc.property(fc.array(primitive), fc.array(op, { maxLength: 80 }), (initial, ops) => {
        const mine = new MapSet<unknown>(initial);
        const theirs = new Set<unknown>(initial);
        const open: [Iterator<unknown>, Iterator<unknown>][] = [];
        for (const [kind, arg] of ops) {
          if (kind === "add") {
            mine.add(arg);
            theirs.add(arg);
          } else if (kind === "delete") {
            expect(mine.delete(arg)).toBe(theirs.delete(arg));
          } else if (kind === "clear") {
            mine.clear();
            theirs.clear();
          } else if (kind === "open") {
            open.push([mine.values(), theirs.values()]);
          } else if (kind === "next" && open.length > 0) {
            const [m, t] = open[(arg as number) % open.length]!;
            expect(m.next()).toEqual(t.next());
          }
          expect(mine.size).toBe(theirs.size);
        }
        expect([...mine]).toEqual([...theirs]);
        for (const [m, t] of open) {
          for (let step = t.next(); ; step = t.next()) {
            expect(m.next()).toEqual(step);
            if (step.done) break;
          }
        }
      }),
      { numRuns: 1000 },
    );
  });

  it("visits what native Set's forEach visits when the callback changes the set", () => {
    fc.assert(
      fc.property(fc.array(primitive), fc.array(mutation, { maxLength: 30 }), (initial, ops) => {
        const visit = (set: MapSet<unknown> | Set<unknown>) => {
          const seen: unknown[] = [];
          const pending = ops.slice();
          set.forEach((value: unknown) => {
            seen.push(value);
            mutate(set, pending);
          });
          return seen;
        };
        expect(visit(new MapSet<unknown>(initial))).toEqual(visit(new Set<unknown>(initial)));
      }),
    );
  });

  it("visits a colliding value added while an iterator is suspended on its key-mate", () => {
    const set = new MapSet<string>([strA]);
    const values = set.values();
    expect(values.next()).toEqual({ value: strA, done: false });
    set.add(strB);
    expect(values.next()).toEqual({ value: strB, done: false });
    expect(values.next().done).toBe(true);
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

  // The ES2025 algorithms, written over a native Set, whose iteration is the spec's live walk of
  // [[SetData]]. Only the loops that call has() on this set's values are modelled.
  const spec = {
    intersection: (o: Set<unknown>, has: (v: unknown) => boolean) => {
      const result: unknown[] = [];
      for (const e of o) if (has(e) && !result.includes(e)) result.push(e);
      return result;
    },
    difference: (o: Set<unknown>, has: (v: unknown) => boolean) => [...o].filter((e) => !has(e)),
    isSubsetOf: (o: Set<unknown>, has: (v: unknown) => boolean) => {
      for (const e of o) if (!has(e)) return false;
      return true;
    },
    isDisjointFrom: (o: Set<unknown>, has: (v: unknown) => boolean) => {
      for (const e of o) if (has(e)) return false;
      return true;
    },
  };

  it("follows the spec when other.has() changes this set", () => {
    fc.assert(
      fc.property(
        fc.array(primitive, { minLength: 1 }),
        fc.array(primitive),
        fc.array(mutation, { maxLength: 20 }),
        (left, right, ops) => {
          const inOther = new Set(right);
          for (const method of Object.keys(spec) as (keyof typeof spec)[]) {
            const run = (set: MapSet<unknown> | Set<unknown>, apply: (has: (v: unknown) => boolean) => unknown) => {
              const calls: unknown[] = [];
              const pending = ops.slice();
              const has = (value: unknown) => {
                calls.push(value);
                mutate(set, pending);
                return inOther.has(value);
              };
              return { result: apply(has), calls };
            };
            // A size no smaller than this set's, so has() drives every one of these loops.
            const mine = new MapSet<unknown>(left);
            const actual = run(mine, (has) => {
              const result = mine[method]({ size: Infinity, has, keys: () => [].values() });
              return typeof result === "boolean" ? result : [...result];
            });
            const theirs = new Set<unknown>(left);
            const expected = run(theirs, (has) => spec[method](theirs, has));
            expect(actual, method).toEqual(expected);
          }
        },
      ),
      { numRuns: 300 },
    );
  });

  // GetIteratorFromMethod reads next before union and symmetricDifference copy this set.
  it("reads the keys iterator's next once, before copying this set", () => {
    for (const method of ["union", "symmetricDifference"] as const) {
      const set = new MapSet([1]);
      let reads = 0;
      const other = {
        size: 0,
        has: () => false,
        keys: () => ({
          get next() {
            reads++;
            set.add(2);
            return () => ({ done: true, value: undefined });
          },
        }),
      };
      expect([...set[method](other)], method).toEqual([1, 2]);
      expect(reads, method).toBe(1);
    }
  });

  it("closes the keys iterator when a predicate stops early", () => {
    const log: string[] = [];
    const other = {
      size: 1,
      has: () => true,
      keys: () => ({
        next: () => ({ done: false, value: 1 }),
        return: () => {
          log.push("return");
          return { done: true as const, value: undefined };
        },
      }),
    };
    expect(new MapSet([1, 2]).isDisjointFrom(other)).toBe(false);
    expect(new MapSet([3, 4]).isSupersetOf(other)).toBe(false);
    expect(log).toEqual(["return", "return"]);
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

  it("compares a Set argument's values by deep equality, whichever side is smaller", () => {
    const set = new MapSet([a, b, c]);
    // The Set is larger, so the spec would call Set.has with each value of this set.
    const larger = new Set([{ id: 1 }, { id: 2 }, b, { id: 9 }]);
    expect([...set.intersection(larger)]).toEqual([a, b]);
    expect([...set.intersection(larger)][0]).toBe(a);
    expect([...set.difference(larger)]).toEqual([c]);
    expect(set.isSubsetOf(new Set([{ id: 3 }, { id: 2 }, { id: 1 }]))).toBe(true);
    expect(set.isDisjointFrom(new Set([{ id: 3 }, { id: 7 }, { id: 8 }, { id: 9 }]))).toBe(false);
    expect(set.isDisjointFrom(new Set([{ id: 6 }, { id: 7 }, { id: 8 }, { id: 9 }]))).toBe(true);
    // The Set is smaller, so its values are looked up in this set.
    expect([...set.intersection(new Set([{ id: 1 }, { id: 2 }]))]).toEqual([a, b]);
  });

  it("counts equal values in a Set argument once in isSupersetOf()", () => {
    expect(new MapSet([a]).isSupersetOf(new Set([{ id: 1 }, { id: 1 }]))).toBe(true);
    expect(new MapSet([a]).isSupersetOf(new Set([{ id: 1 }, { id: 2 }]))).toBe(false);
  });

  it("hashes a Set argument only when an object of this set misses it by reference", () => {
    let reads = 0;
    const watched = {
      get id() {
        reads++;
        return 0;
      },
    };
    const other = new Set<unknown>([a, b, 1, 2, watched]);
    const set = new MapSet<unknown>([a, b, 1]);
    set.intersection(other);
    set.difference(other);
    set.isSubsetOf(other);
    set.isDisjointFrom(other);
    // A primitive that misses is absent by deep equality too.
    new MapSet<unknown>([1, 5]).intersection(other);
    new MapSet<unknown>([1, 5, 9]).isDisjointFrom(new Set([4, 6, 7, 8, watched]));
    expect(reads).toBe(0);
    // Two objects miss, and the Set is hashed once for the call.
    new MapSet<unknown>([a, c, { id: 4 }]).intersection(other);
    expect(reads).toBe(1);
  });

  it("matches the deep-equality model for Set arguments", () => {
    const atom = fc.oneof(
      fc.integer({ min: 0, max: 5 }),
      fc.constantFrom("x", NaN, -0, null),
      fc.record({ k: fc.integer({ min: 0, max: 3 }) }),
      fc.array(fc.integer({ min: 0, max: 2 }), { maxLength: 2 }),
    );
    const isIn = (values: unknown[], value: unknown) => values.some((v) => deepEqual(value, v));
    fc.assert(
      fc.property(
        fc.array(atom, { maxLength: 8 }),
        fc.array(atom, { maxLength: 8 }),
        fc.array(fc.nat(), { maxLength: 3 }),
        (left, right, shared) => {
          const set = new MapSet<unknown>(left);
          const mine = [...set];
          // Fresh values, and some of this set's own values, so both lookups are exercised.
          const theirs = [...right, ...shared.filter((i) => i < mine.length).map((i) => mine[i])];
          const other = new Set(theirs);
          const inOther = mine.filter((v) => isIn(theirs, v));
          const outside = mine.filter((v) => !isIn(theirs, v));
          const sameValues = (got: Iterable<unknown>, want: unknown[]) => {
            const values = [...got];
            expect(values.length).toBe(want.length);
            for (const v of want) expect(values.some((x) => Object.is(x, v))).toBe(true);
          };
          sameValues(set.intersection(other), inOther);
          sameValues(set.difference(other), outside);
          expect(set.isSubsetOf(other)).toBe(outside.length === 0);
          expect(set.isDisjointFrom(other)).toBe(inOther.length === 0);
          expect(set.isSupersetOf(other)).toBe(theirs.every((v) => isIn(mine, v)));
        },
      ),
      { numRuns: 1000 },
    );
  });

  it("uses other.has() for a Map, a Set subclass, a Set with its own has() and another realm's Set", () => {
    class SubSet extends Set<unknown> {}
    const ownHas = new Set<unknown>([{ id: 1 }]);
    ownHas.has = function (value) {
      return Set.prototype.has.call(this, value);
    };
    const others: SetLike<unknown>[] = [
      new Map([[{ id: 1 }, true]]),
      new SubSet([{ id: 1 }]),
      ownHas,
      vm.runInNewContext("new Set([{ id: 1 }])"),
    ];
    for (const other of others) {
      expect(new MapSet([a]).isSubsetOf(other)).toBe(false);
      expect(new MapSet([a]).intersection(other).size).toBe(0);
    }
    // When the argument is smaller, its values are looked up in this set, by deep equality.
    expect(new MapSet([a, b]).intersection(new Map([[{ id: 1 }, true]])).size).toBe(1);
  });

  it("keeps colliding values apart in results", () => {
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
