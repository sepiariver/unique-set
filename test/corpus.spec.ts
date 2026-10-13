import { MapSet, structuralHash } from "../dist/index.mjs";
import { circularDeepEqual } from "fast-equals";
import { describe, it, expect } from "vitest";
import { mirror } from "./competitors/workload";
import { corpus, type CorpusEntry } from "./fixtures/corpus";
import { wptThrowingGetter } from "./fixtures/wpt";

// Correctness on values from WPT's structured clone battery and devalue's and superjson's
// round-trip suites. Each entry states how its copies compare; the corpus-wide checks then use
// fast-equals itself as the oracle, since MapSet promises to agree with it.

/**
 * Two values from one call site. fast-equals compares an Error's `stack`, which records where
 * the error was built, so copies built from different lines would differ.
 */
const twoCopies = (entry: CorpusEntry): [unknown, unknown] =>
  Array.from({ length: 2 }, () => entry.make()) as [unknown, unknown];

const expectPair = (a: unknown, b: unknown, equal: boolean): void => {
  expect(new MapSet([a, b]).size).toBe(equal ? 1 : 2);
  expect(new MapSet([a]).has(b)).toBe(equal);
};

describe.each(corpus.map((entry) => [entry.name, entry] as const))("%s", (_name, entry) => {
  it(entry.copies ? `keeps two copies: ${entry.copies.distinct}` : "keeps one of two copies", () => {
    const [a, b] = twoCopies(entry);
    expectPair(a, b, !entry.copies);
  });

  const clone = entry.clone;
  if (clone && "throws" in clone) {
    it(`cannot be cloned: ${clone.throws}`, () => {
      expect(() => structuredClone(entry.make())).toThrow();
    });
  } else {
    it(clone ? `keeps its structured clone apart: ${clone.distinct}` : "matches its structured clone", () => {
      const value = entry.make();
      expectPair(value, structuredClone(value), !clone);
    });
  }

  // mirror() recurses without tracking cycles.
  if (!entry.circular) {
    it("matches its mirror, with keys and insertion order reversed", () => {
      const value = entry.make();
      expectPair(value, mirror(value), true);
    });
  }
});

describe("the whole corpus", () => {
  // Two copies of every entry, plus a structured clone where one can be made. fast-equals throws
  // on an out-of-bounds DataView, so it gives no verdict there; extra.spec.ts covers that case.
  const values = corpus.flatMap((entry) => {
    const [a, b] = twoCopies(entry);
    try {
      circularDeepEqual(a, b);
    } catch {
      return [];
    }
    const named = [
      { name: `${entry.name} (copy 1)`, value: a },
      { name: `${entry.name} (copy 2)`, value: b },
    ];
    if (!(entry.clone && "throws" in entry.clone)) {
      named.push({ name: `${entry.name} (clone)`, value: structuredClone(a) });
    }
    return named;
  });

  it("hashes values alike whenever fast-equals calls them equal", () => {
    const unsound: string[] = [];
    for (let i = 0; i < values.length; i++) {
      for (let j = i + 1; j < values.length; j++) {
        const [a, b] = [values[i]!, values[j]!];
        if (circularDeepEqual(a.value, b.value) && structuralHash(a.value) !== structuralHash(b.value)) {
          unsound.push(`${a.name} / ${b.name}`);
        }
      }
    }
    expect(unsound).toEqual([]);
  });

  it("keeps one value per fast-equals class and finds every value", () => {
    const kept: unknown[] = [];
    for (const { value } of values) {
      if (!kept.some((other) => circularDeepEqual(value, other))) kept.push(value);
    }
    const set = new MapSet(values.map(({ value }) => value));
    expect(set.size).toBe(kept.length);
    expect(values.filter(({ value }) => !set.has(value)).map(({ name }) => name)).toEqual([]);
  });
});

describe("wpt: Object with a getter that throws", () => {
  it("propagates the getter's exception and leaves the set unchanged", () => {
    const exception = new Error();
    const set = new MapSet<unknown>([1]);
    expect(() => set.add(wptThrowingGetter(exception))).toThrow(exception);
    expect(() => set.has(wptThrowingGetter(exception))).toThrow(exception);
    expect([...set]).toEqual([1]);
  });
});
