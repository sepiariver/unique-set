import { bench, describe } from "vitest";
import { adapters, type Adapter } from "./competitors/adapters";
import { withMirroredDuplicates, type Workload } from "./competitors/workload";
import { flatDataset, hasWorkload, nestedDataset, type Dataset } from "./fixtures/datasets";
import { hashItRecords, hashItStairs } from "./fixtures/hash-it";
import { lodashNearMisses } from "./fixtures/lodash";
import { createBenchObjects } from "./fixtures/ohash";

const count = (n: number): string => n.toLocaleString("en-US");

const fromDataset = (kind: string, dataset: Dataset): Workload => ({
  name: `${kind}: ${count(dataset.expectedSize)} unique in ${count(dataset.items.length)} items`,
  items: dataset.items,
  expectedSize: dataset.expectedSize,
});

// Each workload states its expected unique size up front, so a library that disagrees with
// unique-set's equality semantics is reported instead of looking faster.
const workloads: Workload[] = [
  fromDataset("flat mixed", flatDataset(20_000)),
  fromDataset("nested", nestedDataset(20_000)),
  {
    name: "hash-it records: 5,000 unique + mirrored duplicates",
    items: withMirroredDuplicates(hashItRecords(5_000, 1), 2),
    expectedSize: 5_000,
  },
  {
    name: "hash-it records: 1,000 unique + mirrored duplicates",
    items: withMirroredDuplicates(hashItRecords(1_000, 3), 4),
    expectedSize: 1_000,
  },
  {
    name: "hash-it stairs (100 deep): 200 unique + mirrored duplicates",
    items: withMirroredDuplicates(hashItStairs(200), 5),
    expectedSize: 200,
  },
  {
    name: "lodash isEqual near-misses: 1,000 unique + mirrored duplicates",
    items: withMirroredDuplicates(lodashNearMisses(1_000), 6),
    expectedSize: 1_000,
  },
  ...(
    [
      { count: 1024, size: "small" },
      { count: 1024, size: "small", circular: true },
      { count: 512, size: "large" },
      { count: 512, size: "large", circular: true },
    ] as const
  ).map((preset) => ({
    name: `ohash ${preset.size}${"circular" in preset ? " circular" : ""}: ${preset.count} copies`,
    items: createBenchObjects(preset),
    expectedSize: 1,
  })),
];

/**
 * Register one bench per adapter, after checking its result once. Throwing benches are dropped
 * silently by vitest, so a wrong result or an error is labelled as a skipped bench instead.
 * `prepare` runs untimed and returns the timed function, or a failure message.
 */
function benchAdapters(
  workloadName: string,
  itemCount: number,
  prepare: (adapter: Adapter) => (() => void) | string,
): void {
  for (const adapter of adapters) {
    if (adapter.maxItems !== undefined && itemCount > adapter.maxItems) {
      bench.skip(`${adapter.name} — not run above ${adapter.maxItems} items`, () => {});
      continue;
    }

    let timed: (() => void) | string;
    try {
      timed = prepare(adapter);
    } catch (error) {
      timed = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    }

    if (typeof timed === "string") {
      console.warn(`[competitors] ${workloadName} › ${adapter.name} ✗ ${timed}`);
      bench.skip(`${adapter.name} ✗ ${timed}`, () => {});
    } else {
      bench(adapter.name, timed);
    }
  }
}

for (const workload of workloads) {
  describe(workload.name, () => {
    benchAdapters(workload.name, workload.items.length, (adapter) => {
      const size = adapter.run(workload.items);
      if (size !== workload.expectedSize) return `size ${size}, expected ${workload.expectedSize}`;
      return () => {
        adapter.run(workload.items);
      };
    });
  });
}

// has(): build from half the dataset untimed, then time a lookup of a fresh copy of every item.
const lookup = hasWorkload(nestedDataset(20_000));
const expectedHits = lookup.expected.filter(Boolean).length;
const lookupName =
  `nested has(): ${count(lookup.stored.length)} stored, ` +
  `${count(lookup.queries.length)} queries, ${count(expectedHits)} hits`;

describe(lookupName, () => {
  benchAdapters(lookupName, lookup.stored.length, (adapter) => {
    const has = adapter.has(lookup.stored);
    const countHits = (): number => {
      let hits = 0;
      for (const query of lookup.queries) if (has(query)) hits++;
      return hits;
    };
    const hits = countHits();
    if (hits !== expectedHits) return `${hits} hits, expected ${expectedHits}`;
    return countHits;
  });
});
