// The repo's own flat and nested datasets, used by competitors.bench.ts (timing), datasets.spec.ts
// (correctness) and bench-large.spec.ts (scale). Each integer i in [size, 2 * size) yields one
// distinct value, and some values are followed by a mirrored duplicate, so a dataset of `size`
// holds exactly `size` unique values by construction.
import { mirror } from "../competitors/workload";

export interface Dataset {
  items: unknown[];
  /** The i each item was generated from; two items are equal exactly when their ids are. */
  ids: number[];
  expectedSize: number;
}

/** Duplicate the value generated from i when i is divisible by `dupeEvery[i % 3]`. */
export type DupeEvery = readonly [number, number, number];

function generate(size: number, make: (i: number) => unknown, dupeEvery: DupeEvery): Dataset {
  const items: unknown[] = [];
  const ids: number[] = [];
  for (let i = size; i < size * 2; i++) {
    const value = make(i);
    items.push(value);
    ids.push(i);
    if (i % dupeEvery[i % 3]! === 0) {
      items.push(mirror(value));
      ids.push(i);
    }
  }
  return { items, ids, expectedSize: size };
}

/** Flat objects (2 keys), 2-element arrays and strings. */
const flatValue = (i: number): unknown => {
  if (i % 3 === 0) return { key: i, value: `value-${i}` };
  if (i % 3 === 1) return [i, `value-${i}`];
  return `string-${i}`;
};

/** Objects nested 3-4 levels, arrays holding objects, and mixed structures. */
const nestedValue = (i: number): unknown => {
  if (i % 3 === 0) {
    return {
      key: i,
      value: `value-${i}`,
      nested: { level1: { level2: { key: i, value: `deep-value-${i}` } } },
    };
  }
  if (i % 3 === 1) return [i, `value-${i}`, [{ key: i, value: `nested-value-${i}` }]];
  return {
    id: i,
    name: `name-${i}`,
    data: [i, `info-${i}`, { key: i, details: { nestedKey: `nested-${i}` } }],
  };
};

export const flatDataset = (size: number): Dataset => generate(size, flatValue, [7, 11, 5]);

export const nestedDataset = (size: number, dupeEvery: DupeEvery = [7, 11, 5]): Dataset =>
  generate(size, nestedValue, dupeEvery);

export interface HasWorkload {
  /** The first half of the dataset's items, to build the collection from. */
  stored: unknown[];
  /** A fresh mirrored copy of every item, so lookups cannot succeed by reference. */
  queries: unknown[];
  /** Whether each query's value is in `stored`. */
  expected: boolean[];
}

export function hasWorkload({ items, ids }: Dataset): HasWorkload {
  const half = Math.floor(items.length / 2);
  const storedIds = new Set(ids.slice(0, half));
  return {
    stored: items.slice(0, half),
    queries: items.map(mirror),
    expected: ids.map((id) => storedIds.has(id)),
  };
}
