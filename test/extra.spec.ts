import { MapSet, structuralHash } from "../dist/index.mjs";
import { describe, it, expect } from "vitest";
import {
  collidingObjects,
  collidingStrings,
  collidingWithUndefined,
} from "./fixtures/collisions";

const [strA, strB] = collidingStrings;
const [objA, objB] = collidingObjects;
const [undefA, undefB, undefC] = collidingWithUndefined;

describe("collision fixtures", () => {
  it("still collide under the current hash", () => {
    expect(structuralHash(strB)).toBe(structuralHash(strA));
    expect(structuralHash(objB)).toBe(structuralHash(objA));
    for (const s of collidingWithUndefined) {
      expect(structuralHash(s)).toBe(structuralHash(undefined));
    }
  });
});

describe("MapSet collision buckets", () => {
  it("stores colliding values separately and deduplicates within a bucket", () => {
    const set = new MapSet<unknown>([strA, strB, strA, strB]);
    expect(set.size).toBe(2);
    expect(set.has(strA)).toBe(true);
    expect(set.has(strB)).toBe(true);

    // Fresh objects, so equality goes through fast-equals rather than reference identity.
    const objects = new MapSet<unknown>([{ ...objA }, { ...objB }, { ...objA }, { ...objB }]);
    expect(objects.size).toBe(2);
    expect(objects.has({ ...objA })).toBe(true);
    expect(objects.has({ ...objB })).toBe(true);
    expect(objects.has({ s: "other" })).toBe(false);
  });

  it("misses a value that shares a key with an inline or bucketed value", () => {
    const set = new MapSet<unknown>([undefA]);
    expect(set.has(undefB)).toBe(false); // same key, inline slot
    expect(set.delete(undefB)).toBe(false);
    set.add(undefB);
    expect(set.has(undefC)).toBe(false); // same key, bucket
    expect(set.delete(undefC)).toBe(false);
    expect(set.size).toBe(2);
  });

  it("collapses a bucket on delete and rebuilds it on add", () => {
    const set = new MapSet<unknown>([strA, strB]);
    expect(set.delete(strA)).toBe(true);
    expect(set.size).toBe(1);
    expect(set.has(strA)).toBe(false);
    expect(set.has(strB)).toBe(true);
    expect([...set]).toEqual([strB]);

    set.add(strA);
    expect(set.size).toBe(2);
    expect([...set]).toEqual([strB, strA]);

    expect(set.delete(strB)).toBe(true);
    expect(set.delete(strA)).toBe(true);
    expect(set.size).toBe(0);
    expect([...set]).toEqual([]);
  });

  it("deletes from the middle of a bucket of three", () => {
    const set = new MapSet<unknown>(collidingWithUndefined);
    expect(set.delete(undefB)).toBe(true);
    expect([...set]).toEqual([undefA, undefC]);
    expect(set.size).toBe(2);
  });

  it("yields a colliding value next to its bucket-mate", () => {
    const set = new MapSet(["first", strA, "middle", strB, "last"]);
    expect([...set]).toEqual(["first", strA, strB, "middle", "last"]);

    const seen: string[] = [];
    set.forEach((value, valueAgain, self) => {
      expect(valueAgain).toBe(value);
      expect(self).toBe(set);
      seen.push(value);
    });
    expect(seen).toEqual([...set.values()]);
  });
});

describe("MapSet with undefined", () => {
  it("tells a stored undefined from an absent key", () => {
    const set = new MapSet<unknown>();
    expect(set.has(undefined)).toBe(false);
    expect(set.delete(undefined)).toBe(false);

    set.add(undefA);
    expect(set.has(undefined)).toBe(false); // undefined's key holds only a colliding string
    expect(set.delete(undefined)).toBe(false);
    expect(set.size).toBe(1);
  });

  it("shares a bucket with values that collide with it", () => {
    const set = new MapSet<unknown>([undefined, undefined]);
    expect(set.size).toBe(1);
    expect(set.has(undefA)).toBe(false);
    expect(set.delete(undefA)).toBe(false);

    set.add(undefA);
    set.add(undefined);
    expect(set.size).toBe(2);
    expect([...set]).toEqual([undefined, undefA]);

    expect(set.delete(undefined)).toBe(true);
    expect(set.has(undefined)).toBe(false);
    expect(set.has(undefA)).toBe(true);
    expect([...set]).toEqual([undefA]);

    // The bucket has collapsed back to the inline string; undefined can join it again.
    set.add(undefined);
    expect([...set]).toEqual([undefA, undefined]);
    expect(set.delete(undefA)).toBe(true);
    expect(set.has(undefined)).toBe(true);
    expect(set.delete(undefined)).toBe(true);
    expect(set.size).toBe(0);
  });
});

// fast-equals defines equality, and its semantics have changed within 6.x. Each case pins one
// behavior that differs from 6.0.0, so a dependency bump that changes it fails here by name.
describe("fast-equals 6.1.1 semantics through MapSet", () => {
  it("compares URL query strings", () => {
    const set = new MapSet([new URL("https://a.test/p?x=1"), new URL("https://a.test/p?x=2")]);
    expect(set.size).toBe(2);
  });

  it("ignores URL query parameter order", () => {
    const set = new MapSet([new URL("https://a.test/p?x=1&y=2"), new URL("https://a.test/p?y=2&x=1")]);
    expect(set.size).toBe(1);
  });

  it("treats NaN as equal to NaN in float typed arrays", () => {
    expect(new MapSet([new Float64Array([NaN]), new Float64Array([NaN])]).size).toBe(1);
  });

  it("keeps a null-prototype object apart from a plain one", () => {
    const bare = Object.assign(Object.create(null), { a: 1 });
    expect(new MapSet<unknown>([{ a: 1 }, bare]).size).toBe(2);
  });

  it("compares Error causes deeply", () => {
    // Built on one line, so the errors share a stack, which fast-equals also compares.
    const errors = (causes: unknown[]) => causes.map((cause) => new Error("x", { cause }));
    expect(new MapSet(errors([{ a: 1 }, { a: 1 }])).size).toBe(1);
    expect(new MapSet(errors([{ a: 1 }, { a: 2 }])).size).toBe(2);
  });
});

/** Every value is distinct, and each gets its own key rather than one shared per type. */
function expectDistinctKeys(values: unknown[]): void {
  expect(new MapSet(values).size).toBe(values.length);
  expect(new Set(values.map(structuralHash)).size).toBe(values.length);
}

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

describe("structuralHash for built-ins", () => {
  it("URL: hashes the query as unordered pairs", () => {
    const pair = [new URL("https://a.test/p?x=1&y=2#h"), new URL("https://a.test/p?y=2&x=1#h")];
    expect(structuralHash(pair[1])).toBe(structuralHash(pair[0]));
    expectDistinctKeys(range(200).map((i) => new URL(`https://a.test/${i % 7}?q=${i}`)));
    // Repeated keys form a multiset: a=1&a=2 equals a=2&a=1 but not a=1&a=1.
    expect(new MapSet([new URL("https://a.test/?a=1&a=2"), new URL("https://a.test/?a=1&a=1")]).size).toBe(2);
  });

  it("Error: hashes name, message and cause", () => {
    const errors = (messages: string[], cause?: unknown) =>
      messages.map((message) => new Error(message, { cause }));
    const [a, b] = errors(["m", "m"], { deep: [1] });
    expect(structuralHash(b)).toBe(structuralHash(a));
    expectDistinctKeys(errors(range(200).map(String)));
    class CodedError extends Error {}
    expect(structuralHash(new CodedError("m"))).not.toBe(structuralHash(new CodedError("n")));

    // Enumerable own properties take the plain-object path, so they alone are hashed.
    class HttpError extends Error {
      constructor(public status: number) {
        super("http");
      }
    }
    const http = (statuses: number[]) => statuses.map((status) => new HttpError(status));
    const [ok, okAgain] = http([200, 200]);
    expect(structuralHash(okAgain)).toBe(structuralHash(ok));
    expect(new MapSet(http([200, 200, 404])).size).toBe(2);
  });

  it("typed arrays: hashes elements, merging NaN and -0 as fast-equals does", () => {
    expect(structuralHash(new Float64Array([NaN, 1]))).toBe(structuralHash(new Float64Array([NaN, 1])));
    expect(structuralHash(new Float32Array([-0]))).toBe(structuralHash(new Float32Array([0])));
    expect(new MapSet([new Float32Array([-0]), new Float32Array([0])]).size).toBe(1);
    expectDistinctKeys(range(200).map((i) => new Uint16Array([i, i >> 3])));
    expectDistinctKeys(range(200).map((i) => new BigInt64Array([BigInt(i) - 100n])));
  });

  it("typed arrays: keeps equal bytes at different offsets apart", () => {
    const bytes = new Uint8Array([7, 7, 7]);
    const views = [bytes.subarray(0, 2), bytes.subarray(1, 3)];
    expect(structuralHash(views[1])).toBe(structuralHash(views[0])); // byteOffset is not hashed
    expect(new MapSet(views).size).toBe(2);
  });

  it("ArrayBuffer and DataView: hashes bytes", () => {
    const buffer = (i: number) => new Uint8Array([i & 0xff, i >> 8]).buffer;
    expect(structuralHash(buffer(5))).toBe(structuralHash(buffer(5)));
    expectDistinctKeys(range(300).map(buffer));

    // DataViews compare the bytes they cover and their byteOffset, which is not hashed.
    const views = [new DataView(new Uint8Array([0, 1, 2]).buffer, 1), new DataView(new Uint8Array([1, 2]).buffer)];
    expect(structuralHash(views[1])).toBe(structuralHash(views[0]));
    expect(new MapSet(views).size).toBe(2);
    const outside = [new DataView(new Uint8Array([3, 1, 2]).buffer, 1), views[0]];
    expect(new MapSet(outside).size).toBe(1);
    expectDistinctKeys(range(300).map((i) => new DataView(buffer(i))));
  });

  it("boxed primitives: hashes valueOf()", () => {
    expect(structuralHash(new String("s"))).toBe(structuralHash(new String("s")));
    expectDistinctKeys([
      ...range(100).map((i) => new Number(i)),
      ...range(50).map((i) => Object(BigInt(i))),
      new Boolean(true),
      new Boolean(false),
      new String(""),
    ]);
    // A non-empty String wrapper has index keys, so it hashes as a plain object by its characters.
    expect(new MapSet(range(100).map((i) => new String(`s${i}`))).size).toBe(100);
    // Object.is keeps 0 and -0 apart; sharing a key is coarser, so both are still stored.
    expect(structuralHash(new Number(-0))).toBe(structuralHash(new Number(0)));
    expect(new MapSet([new Number(0), new Number(-0)]).size).toBe(2);
  });

  it("Date: hashes every invalid date alike", () => {
    expect(structuralHash(new Date(NaN))).toBe(structuralHash(new Date("not a date")));
    expect(new MapSet([new Date(NaN), new Date("not a date")]).size).toBe(1);
  });

  it("React elements: skips the owner keys fast-equals skips", () => {
    const $$typeof = Symbol.for("react.transitional.element");
    const element = (owner: unknown) => ({ $$typeof, type: "div", props: { id: 1 }, _owner: owner });
    const pair = [element({ name: "A" }), element({ name: "B" })];
    expect(structuralHash(pair[1])).toBe(structuralHash(pair[0]));
    expect(new MapSet(pair).size).toBe(1);

    const preact = (o: unknown) => ({ $$typeof, type: "p", __o: o, __v: o });
    expect(new MapSet([preact(1), preact(2)]).size).toBe(1);
    // Without $$typeof, the same keys are ordinary data.
    expect(new MapSet([{ _owner: 1 }, { _owner: 2 }]).size).toBe(2);
  });
});

// Values nested past MAX_DEPTH, circular ones included, hash only their top CUT_DEPTH levels
// and compare with fast-equals' circularDeepEqual.
describe("MapSet with circular and deeply nested values", () => {
  const selfRef = <T extends object>(make: (self: T) => void, value: T): T => {
    make(value);
    return value;
  };

  it("deduplicates self-referencing objects, arrays, Maps, Sets and Error causes", () => {
    const makeAll = () => [
      selfRef((o: any) => (o.self = o), { a: 1 } as any),
      selfRef((a: any[]) => a.push(a), [1] as any[]),
      selfRef((m: Map<any, any>) => m.set("self", m), new Map()),
      selfRef((s: Set<any>) => s.add(s), new Set()),
      selfRef((e: any) => (e.cause = e), new Error("x")),
    ];
    const first = makeAll();
    // fast-equals compares error stacks, so the copy reuses each error.
    const second = makeAll().map((v, i) => (v instanceof Error ? first[i] : v));
    const set = new MapSet<unknown>([...first, ...second]);
    expect(set.size).toBe(first.length);
    for (const v of second) expect(set.has(v)).toBe(true);
    for (const v of second) expect(set.delete(v)).toBe(true);
    expect(set.size).toBe(0);
  });

  it("tells circular values apart by a leaf above the cut-off", () => {
    const make = (n: number) => selfRef((o: any) => (o.self = o), { n } as any);
    const set = new MapSet<unknown>([make(1), make(2), make(1)]);
    expect(set.size).toBe(2);
    expect(set.has(make(3))).toBe(false);
  });

  it("tells circular values apart by a leaf below the cut-off, sharing a bucket", () => {
    const make = (n: number) => {
      const root: any = { a: { b: { c: { d: { n } } } } };
      root.a.b.c.d.root = root;
      return root;
    };
    expect(structuralHash(make(1))).toBe(structuralHash(make(2)));
    const set = new MapSet<unknown>([make(1), make(2), make(1)]);
    expect(set.size).toBe(2);
  });

  // fast-equals pairs each object with its counterpart, so cycles of different lengths are
  // unequal, but a cycle reached one level later is equal. A hash that cut a cycle where it
  // closes would put these two in different buckets.
  it("follows fast-equals on cycles that close at different depths", () => {
    const a: any = {};
    a.self = a;
    const b: any = {};
    b.self = b;
    expect(new MapSet<unknown>([a, { self: b }]).size).toBe(1);

    const x: any[] = [];
    x.push(x);
    const y: any[] = [];
    y.push([y]);
    expect(new MapSet<unknown>([x, y]).size).toBe(2);
  });

  // fast-equals 6.1.1's circularDeepEqual overflows the stack here; MapSet restores the pairing
  // it overwrites. Drop this note, not the test, once fast-equals fixes it.
  it("compares Sets that hold themselves and each other in different orders", () => {
    const make = (reversed: boolean) => {
      const s = new Set<unknown>();
      const t = new Set<unknown>([s]);
      for (const item of reversed ? [t, s] : [s, t]) s.add(item);
      return s;
    };
    const set = new MapSet<unknown>([make(false), make(true)]);
    expect(set.size).toBe(1);
    expect(set.has(make(true))).toBe(true);
  });

  it("keeps a circular value apart from an acyclic one of the same shape", () => {
    const circular: any = { a: { b: { c: {} } } };
    circular.a.b.c.self = circular;
    const acyclic = { a: { b: { c: { self: { a: 1 } } } } };
    const set = new MapSet<unknown>([circular, acyclic]);
    expect(set.size).toBe(2);
    expect(set.has(acyclic)).toBe(true);
    expect(set.has({ a: { b: { c: { self: { a: 2 } } } } })).toBe(false);
  });

  it("deduplicates acyclic values nested past the depth limit", () => {
    const deep = (leaf: number) => {
      let node: unknown = { leaf };
      for (let i = 0; i < 1_000; i++) node = { d: node };
      return node;
    };
    const set = new MapSet<unknown>([deep(1), deep(2), deep(1)]);
    expect(set.size).toBe(2);
    expect(set.has(deep(2))).toBe(true);
  });
});

// After a duplicate, add() checks the next value against the stored value it matched with
// shallowEqual before hashing.
describe("MapSet duplicate probe", () => {
  it("skips a shallow copy of the value it last matched", () => {
    const shared = { nested: [1, 2, 3] };
    const set = new MapSet<unknown>([{ ...shared }, { ...shared }, { ...shared }]);
    expect(set.size).toBe(1);
  });

  it("falls through to the hash when the shallow check fails", () => {
    const set = new MapSet<unknown>([{ a: [1] }, { a: [1] }, { a: [2] }, { a: [1] }]);
    expect(set.size).toBe(2);
  });

  it("forgets the matched value once it is deleted", () => {
    const shared = { nested: [1] };
    const set = new MapSet<unknown>([{ ...shared }, { ...shared }]);
    expect(set.delete({ nested: [1] })).toBe(true);
    set.add({ ...shared });
    expect(set.size).toBe(1);
    set.clear();
    set.add({ ...shared });
    expect(set.size).toBe(1);
  });

  it("matches a stored undefined", () => {
    const set = new MapSet<unknown>([undefined, undefined, undefined]);
    expect(set.size).toBe(1);
  });
});
