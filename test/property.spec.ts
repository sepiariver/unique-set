import { MapSet, structuralHash } from "../dist/index.mjs";
import { deepEqual } from "fast-equals";
import fc from "fast-check";
import { describe, it, expect } from "vitest";
import { createRng } from "./competitors/workload";
import { collidingStrings, collidingWithUndefined } from "./fixtures/collisions";

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

const { value } = fc.letrec((tie) => ({
  value: fc.oneof(
    { depthSize: "small" },
    leaf,
    fc.array(tie("value"), { maxLength: 5 }),
    fc.dictionary(fc.string({ maxLength: 4 }), tie("value"), { maxKeys: 5 }),
    fc.array(tie("value"), { maxLength: 4 }).map((items) => new Set(items)),
    fc
      .array(fc.tuple(tie("value"), tie("value")), { maxLength: 4 })
      .map((entries) => new Map(entries)),
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
 */
function shuffledClone(v: unknown, rng: () => number): unknown {
  if (Array.isArray(v)) return v.map((item) => shuffledClone(item, rng));
  if (v instanceof Date) return new Date(v.getTime());
  if (v instanceof RegExp) return new RegExp(v.source, v.flags);
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
    for (const key of shuffled(Object.keys(v), rng)) {
      // defineProperty, because assigning a "__proto__" key would set the prototype instead.
      Object.defineProperty(out, key, {
        value: shuffledClone((v as Record<string, unknown>)[key], rng),
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
