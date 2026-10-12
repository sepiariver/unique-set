import { bench, describe } from "vitest";
import { adapters } from "./competitors/adapters";
import { withMirroredDuplicates, type Workload } from "./competitors/workload";
import { hashItRecords, hashItStairs } from "./fixtures/hash-it";
import { lodashNearMisses } from "./fixtures/lodash";
import { createBenchObjects } from "./fixtures/ohash";

// Each workload states its expected unique size up front, so a library that disagrees with
// unique-set's equality semantics is reported instead of looking faster.
const workloads: Workload[] = [
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

for (const workload of workloads) {
  describe(workload.name, () => {
    for (const adapter of adapters) {
      if (adapter.maxItems !== undefined && workload.items.length > adapter.maxItems) {
        bench.skip(`${adapter.name} — not run above ${adapter.maxItems} items`, () => {});
        continue;
      }

      // Throwing benches are dropped silently by vitest, so check once up front and label failures.
      let failure: string | undefined;
      try {
        const size = adapter.run(workload.items);
        if (size !== workload.expectedSize) failure = `size ${size}, expected ${workload.expectedSize}`;
      } catch (error) {
        failure = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      }

      if (failure !== undefined) {
        console.warn(`[competitors] ${workload.name} › ${adapter.name} ✗ ${failure}`);
        bench.skip(`${adapter.name} ✗ ${failure}`, () => {});
      } else {
        bench(adapter.name, () => {
          adapter.run(workload.items);
        });
      }
    }
  });
}
