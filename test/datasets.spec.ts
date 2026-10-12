import { MapSet } from "../dist/index.mjs";
import { describe, it, expect } from "vitest";
import { flatDataset, hasWorkload, nestedDataset } from "./fixtures/datasets";

// Correctness on the datasets competitors.bench.ts times, checked against counts known by construction.
const datasets = { flat: flatDataset, nested: nestedDataset };

for (const [kind, generate] of Object.entries(datasets)) {
  describe(`${kind} dataset`, () => {
    for (const size of [400, 1_000, 20_000]) {
      const dataset = generate(size);

      it(`keeps one of each value: ${size}`, () => {
        expect(new MapSet(dataset.items).size).toBe(dataset.expectedSize);
      });

      it(`finds exactly the stored values: ${size}`, () => {
        const { stored, queries, expected } = hasWorkload(dataset);
        const set = new MapSet(stored);
        expect(queries.map((q) => set.has(q))).toEqual(expected);
        expect(expected).toContain(true);
        expect(expected).toContain(false);
      });
    }
  });
}
