import { MapSet, structuralHash } from "../dist/index.mjs";
import { deepEqual } from "fast-equals";
import fc from "fast-check";
import { describe, it, expect } from "vitest";
import { createRng } from "./competitors/workload";
import { collidingObjects, collidingStrings, collidingWithUndefined } from "./fixtures/collisions";

// Leaves cover the cases the hash special-cases, plus the collision fixtures so that random
// collections regularly put two values in one bucket.
const leaf = fc.oneof(
  fc.integer(),
  fc.double(),
  fc.string({ maxLength: 6 }),
  fc.boolean(),
  fc.bigInt(),
  fc.date(),
  fc.constantFrom(null, undefined, NaN, -0, 0, /a/, /a/g, /b+/im),
  fc.constantFrom(...collidingStrings, ...collidingWithUndefined),
);

// Built-ins whose contents are not enumerable own properties, so the hash reads them specially.
const builtin = fc.oneof(
  fc.webUrl({ withQueryParameters: true, withFragments: true }).map((href) => new URL(href)),
  fc.float64Array({ maxLength: 4 }),
  fc.float32Array({ maxLength: 4 }),
  fc.int32Array({ maxLength: 4 }),
  fc.bigInt64Array({ maxLength: 4 }),
  fc.uint8Array({ maxLength: 4 }).map((bytes) => bytes.buffer),
  fc
    .tuple(fc.uint8Array({ maxLength: 4 }), fc.nat(2))
    .map(([bytes, pad]) => new DataView(new Uint8Array([...Array(pad).fill(9), ...bytes]).buffer, pad)),
  fc.oneof(fc.double(), fc.string({ maxLength: 4 }), fc.boolean(), fc.bigInt()).map(Object),
);

const reactElement = Symbol.for("react.transitional.element");

const { value } = fc.letrec((tie) => ({
  value: fc.oneof(
    { depthSize: "small" },
    leaf,
    builtin,
    fc.array(tie("value"), { maxLength: 5 }),
    fc.dictionary(fc.string({ maxLength: 4 }), tie("value"), { maxKeys: 5 }),
    fc.array(tie("value"), { maxLength: 4 }).map((items) => new Set(items)),
    fc
      .array(fc.tuple(tie("value"), tie("value")), { maxLength: 4 })
      .map((entries) => new Map(entries)),
    fc
      .tuple(fc.string({ maxLength: 4 }), tie("value"))
      .map(([message, cause]) => new Error(message, { cause })),
    fc
      .record({ type: fc.string({ maxLength: 4 }), props: tie("value"), _owner: tie("value") })
      .map((element) => ({ $$typeof: reactElement, ...element })),
  ),
}));

function shuffled<T>(items: T[], rng: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

/**
 * A deep copy that deepEqual accepts as equal, with object key order and Set/Map insertion
 * order shuffled. Unlike `mirror` in competitors/workload.ts it keeps null prototypes, which
 * fast-equals distinguishes from plain objects, and it copies Date and RegExp instances.
 * Built-ins also vary wherever fast-equals allows: URL query order, the sign of float zeros,
 * bytes outside a DataView, and React owners.
 */
function shuffledClone(v: unknown, rng: () => number): unknown {
  if (Array.isArray(v)) return v.map((item) => shuffledClone(item, rng));
  if (v instanceof Date) return new Date(v.getTime());
  if (v instanceof RegExp) return new RegExp(v.source, v.flags);
  if (v instanceof URL) {
    const url = new URL(v.href);
    url.search = new URLSearchParams(shuffled([...v.searchParams], rng)).toString();
    return url;
  }
  if (v instanceof Float64Array || v instanceof Float32Array) {
    const copy = new (v.constructor as Float64ArrayConstructor)(v);
    return copy.map((x) => (x === 0 && rng() < 0.5 ? -x : x));
  }
  if (v instanceof DataView) {
    // Same offset, since fast-equals compares it, but different bytes around the view.
    const copy = new Uint8Array(v.byteOffset + v.byteLength + 1).map(() => rng() * 256);
    copy.set(new Uint8Array(v.buffer, v.byteOffset, v.byteLength), v.byteOffset);
    return new DataView(copy.buffer, v.byteOffset, v.byteLength);
  }
  if (ArrayBuffer.isView(v)) return (v as Int32Array).slice();
  if (v instanceof ArrayBuffer) return v.slice(0);
  if (v instanceof Number || v instanceof String || v instanceof Boolean || v instanceof BigInt) {
    return Object(v.valueOf());
  }
  if (v instanceof Error) {
    const copy = new Error(v.message, { cause: shuffledClone(v.cause, rng) });
    copy.stack = v.stack; // fast-equals compares stacks, which record where each error was built
    return copy;
  }
  if (v instanceof Set) {
    return new Set(shuffled([...v], rng).map((item) => shuffledClone(item, rng)));
  }
  if (v instanceof Map) {
    return new Map(
      shuffled([...v], rng).map(([k, item]) => [shuffledClone(k, rng), shuffledClone(item, rng)]),
    );
  }
  if (v !== null && typeof v === "object") {
    const out = Object.create(Object.getPrototypeOf(v));
    const isElement = "$$typeof" in v; // fast-equals ignores an element's owner
    for (const key of shuffled(Object.keys(v), rng)) {
      const item = (v as Record<string, unknown>)[key];
      // defineProperty, because assigning a "__proto__" key would set the prototype instead.
      Object.defineProperty(out, key, {
        value: isElement && key === "_owner" ? { owner: rng() } : shuffledClone(item, rng),
        enumerable: true,
        writable: true,
        configurable: true,
      });
    }
    return out;
  }
  return v;
}

describe("structuralHash", () => {
  // MapSet relies on deepEqual(a, b) implying equal hashes; a hash finer than equality would
  // let the set store two equal values. This is that invariant stated directly.
  it("gives deep-equal values the same hash", () => {
    fc.assert(
      fc.property(value, fc.nat(), (v, seed) => {
        const w = shuffledClone(v, createRng(seed));
        expect(deepEqual(v, w)).toBe(true);
        expect(structuralHash(w)).toBe(structuralHash(v));
      }),
      { numRuns: 1000 },
    );
  });
});

describe("MapSet", () => {
  it("deduplicates like a brute-force deepEqual scan", () => {
    fc.assert(
      fc.property(fc.array(value, { maxLength: 30 }), fc.nat(), (items, seed) => {
        const rng = createRng(seed);
        const brute: unknown[] = [];
        for (const x of items) if (!brute.some((y) => deepEqual(x, y))) brute.push(x);

        const set = new MapSet<unknown>(items);
        expect(set.size).toBe(brute.length);
        for (const x of items) expect(set.has(shuffledClone(x, rng))).toBe(true);
        for (const x of brute) expect(set.delete(shuffledClone(x, rng))).toBe(true);
        expect(set.size).toBe(0);
        expect([...set]).toEqual([]);
      }),
    );
  });

  it("matches a list model under interleaved add, has and delete", () => {
    // A small pool, so operations often hit values already present or sharing a bucket.
    const pool = fc.oneof(
      fc.constantFrom<unknown>(undefined, ...collidingStrings, ...collidingWithUndefined),
      fc.integer({ min: 0, max: 3 }),
      fc.record({ s: fc.constantFrom(...collidingStrings, "x") }),
    );
    const op = fc.tuple(fc.constantFrom("add", "has", "delete"), pool);

    fc.assert(
      fc.property(fc.array(op, { maxLength: 60 }), fc.nat(), (ops, seed) => {
        const rng = createRng(seed);
        const set = new MapSet<unknown>();
        const model: unknown[] = [];
        for (const [kind, x] of ops) {
          const query = shuffledClone(x, rng);
          const at = model.findIndex((y) => deepEqual(query, y));
          if (kind === "add") {
            expect(set.add(query)).toBe(set);
            if (at === -1) model.push(query);
          } else if (kind === "has") {
            expect(set.has(query)).toBe(at !== -1);
          } else {
            expect(set.delete(query)).toBe(at !== -1);
            if (at !== -1) model.splice(at, 1);
          }
          expect(set.size).toBe(model.length);
        }
        const members = [...set];
        expect(members).toHaveLength(model.length);
        for (const m of members) expect(model.some((y) => deepEqual(m, y))).toBe(true);
      }),
      { numRuns: 500 },
    );
  });
});

describe("MapSet set algebra", () => {
  // A small pool, so the two sides often share values and buckets, plus arbitrary deep values.
  const pool = fc.oneof(
    fc.constantFrom<unknown>(undefined, ...collidingStrings, ...collidingWithUndefined),
    fc.integer({ min: 0, max: 3 }),
    fc.record({ s: fc.constantFrom(...collidingStrings, "x") }),
    value,
  );

  it("matches a list model, keeping this set's values and leaving both inputs unchanged", () => {
    fc.assert(
      fc.property(
        fc.array(pool, { maxLength: 12 }),
        fc.array(pool, { maxLength: 12 }),
        fc.nat(),
        (left, right, seed) => {
          const rng = createRng(seed);
          const a = new MapSet<unknown>(left);
          const b = new MapSet<unknown>(right.map((x) => shuffledClone(x, rng)));
          const aItems = [...a];
          const bItems = [...b];
          const inA = (x: unknown) => aItems.some((y) => deepEqual(x, y));
          const inB = (x: unknown) => bItems.some((y) => deepEqual(x, y));

          /** `set` holds exactly the `expected` values, each by identity. */
          const expectMembers = (set: MapSet<unknown>, expected: unknown[]) => {
            const members = [...set];
            expect(members).toHaveLength(expected.length);
            expect(set.size).toBe(expected.length);
            for (const x of expected) expect(members.some((m) => Object.is(m, x))).toBe(true);
          };

          const onlyA = aItems.filter((x) => !inB(x));
          const onlyB = bItems.filter((x) => !inA(x));
          expectMembers(a.union(b), [...aItems, ...onlyB]);
          expectMembers(a.intersection(b), aItems.filter(inB));
          expectMembers(a.difference(b), onlyA);
          expectMembers(a.symmetricDifference(b), [...onlyA, ...onlyB]);
          expect(a.isSubsetOf(b)).toBe(onlyA.length === 0);
          expect(a.isSupersetOf(b)).toBe(onlyB.length === 0);
          expect(a.isDisjointFrom(b)).toBe(aItems.every((x) => !inB(x)));

          // Results share no buckets with their inputs.
          for (const result of [a.union(b), a.difference(b), a.symmetricDifference(b)]) {
            for (const x of [...result]) result.delete(x);
          }
          expect([...a]).toEqual(aItems);
          expect([...b]).toEqual(bItems);
        },
      ),
      { numRuns: 500 },
    );
  });
});

const isContainer = (v: unknown): v is object =>
  Array.isArray(v) ||
  v instanceof Map ||
  v instanceof Set ||
  (v !== null &&
    typeof v === "object" &&
    [Object.prototype, null].includes(Object.getPrototypeOf(v)));

const children = (v: object): unknown[] =>
  v instanceof Map ? [...v].flat() : v instanceof Set ? [...v] : Object.values(v);

/** Adds an edge from the `pick`ed container to one of its ancestors (or itself). */
function addBackEdge(root: unknown, pick: number): boolean {
  const found: object[][] = [];
  const visited = new Set<object>();
  const walk = (v: unknown, path: object[]) => {
    if (!isContainer(v) || visited.has(v)) return;
    visited.add(v);
    found.push([...path, v]);
    for (const child of children(v)) walk(child, [...path, v]);
  };
  walk(root, []);
  if (found.length === 0) return false;
  const path = found[pick % found.length]!;
  const node = path[path.length - 1]!;
  const target = path[Math.floor(pick / found.length) % path.length]!;
  if (Array.isArray(node)) node.push(target);
  else if (node instanceof Map) node.set("↺", target);
  else if (node instanceof Set) node.add(target);
  else Object.defineProperty(node, "↺", { value: target, enumerable: true, configurable: true });
  return true;
}

/**
 * shuffledClone for graphs: containers are copied once each, so cycles close on the copy.
 * Some edges back into a cycle copy its target once more instead, which fast-equals still
 * calls equal when the copy closes onto itself one level later.
 */
function graphClone(
  v: unknown,
  rng: () => number,
  seen = new Map<object, unknown>(),
  unrolls = { left: 2 },
): unknown {
  if (!isContainer(v)) return shuffledClone(v, rng);
  if (seen.has(v)) {
    if (unrolls.left === 0 || rng() >= 0.2) return seen.get(v);
    unrolls.left--;
    seen = new Map(seen);
  }
  if (Array.isArray(v)) {
    const out: unknown[] = [];
    seen.set(v, out);
    for (const item of v) out.push(graphClone(item, rng, seen, unrolls));
    return out;
  }
  if (v instanceof Set) {
    const out = new Set();
    seen.set(v, out);
    for (const item of shuffled([...v], rng)) out.add(graphClone(item, rng, seen, unrolls));
    return out;
  }
  if (v instanceof Map) {
    const out = new Map();
    seen.set(v, out);
    for (const [k, item] of shuffled([...v], rng)) {
      out.set(graphClone(k, rng, seen, unrolls), graphClone(item, rng, seen, unrolls));
    }
    return out;
  }
  const out = Object.create(Object.getPrototypeOf(v));
  seen.set(v, out);
  for (const key of shuffled(Object.keys(v), rng)) {
    const item = graphClone((v as Record<string, unknown>)[key], rng, seen, unrolls);
    Object.defineProperty(out, key, { value: item, enumerable: true, configurable: true });
  }
  return out;
}

describe("circular values", () => {
  /** A copy of `v`, so fast-check's own value is never mutated, with back edges added. */
  const withCycles = (v: unknown, picks: number[], seed: number): unknown => {
    const graph = graphClone(v, createRng(seed), new Map(), { left: 0 });
    for (const pick of picks) if (!addBackEdge(graph, pick)) return undefined;
    return graph;
  };
  const cyclic = fc
    .tuple(value, fc.array(fc.nat(), { minLength: 1, maxLength: 3 }), fc.nat())
    .map(([v, picks, seed]) => withCycles(v, picks, seed))
    .filter((graph) => graph !== undefined);

  // The invariant above, for values on the depth-limited path.
  it("gives an isomorphic copy the same hash and one MapSet entry", () => {
    fc.assert(
      fc.property(cyclic, fc.nat(), (v, seed) => {
        const w = graphClone(v, createRng(seed), new Map(), { left: 0 });
        expect(structuralHash(w)).toBe(structuralHash(v));
        const set = new MapSet<unknown>([v, w]);
        expect(set.size).toBe(1);
        expect(set.has(w)).toBe(true);
      }),
      { numRuns: 500 },
    );
  });

  // An unrolled copy unfolds like the original, and the comparator may call the two equal,
  // as it does a 1-cycle and the same cycle reached one level later. So they must hash alike.
  it("gives a copy with unrolled cycles the same hash", () => {
    fc.assert(
      fc.property(cyclic, fc.nat(), (v, seed) => {
        const w = graphClone(v, createRng(seed));
        expect(structuralHash(w)).toBe(structuralHash(v));
      }),
      { numRuns: 500 },
    );
  });
});

describe("MapSet duplicate probe", () => {
  // Shallow copies share nested references, which is what the probe in add() checks.
  const bases: unknown[] = [
    undefined,
    0,
    { a: [1] },
    { a: [2] },
    { a: [1], b: { c: 1 } },
    [[1], [2]],
    ...collidingObjects,
    ...collidingStrings.map((s) => ({ s, t: [s] })),
  ];
  const copy = (v: unknown, how: number, rng: () => number): unknown => {
    if (how === 0 || v === null || typeof v !== "object") return v;
    if (how === 1) return Array.isArray(v) ? [...v] : { ...v };
    return shuffledClone(v, rng);
  };

  it("matches a list model when queries are shallow copies", () => {
    const op = fc.tuple(
      fc.constantFrom("add", "add", "has", "delete"),
      fc.nat(bases.length - 1),
      fc.nat(2),
    );
    fc.assert(
      fc.property(fc.array(op, { maxLength: 60 }), fc.nat(), (ops, seed) => {
        const rng = createRng(seed);
        const set = new MapSet<unknown>();
        const model: unknown[] = [];
        for (const [kind, index, how] of ops) {
          const query = copy(bases[index], how, rng);
          const at = model.findIndex((y) => deepEqual(query, y));
          if (kind === "add") {
            set.add(query);
            if (at === -1) model.push(query);
          } else if (kind === "has") {
            expect(set.has(query)).toBe(at !== -1);
          } else {
            expect(set.delete(query)).toBe(at !== -1);
            if (at !== -1) model.splice(at, 1);
          }
          expect(set.size).toBe(model.length);
        }
      }),
      { numRuns: 500 },
    );
  });
});
