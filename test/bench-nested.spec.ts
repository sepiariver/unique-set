import { MapSet } from "../dist/index.mjs";
import { DeepSet } from "deep-equality-data-structures";
import { performance } from "perf_hooks";
import { describe, it, expect } from "vitest";

interface Dataset {
  data: (string | [number, string] | { key: number; value: string })[];
  expectedDupes: number;
}

function generateDataset(size: number): Dataset {
  const data = [];
  const limit = size * 2;
  let expectedDupes = 0;

  for (let i = size; i < limit; i++) {
    if (i % 3 === 0) {
      const nestedObj = {
        key: i,
        value: `value-${i}`,
        nested: {
          level1: {
            level2: {
              key: i,
              value: `deep-value-${i}`,
            },
          },
        },
      };
      data.push(nestedObj);

      if (i % 7 === 0) {
        data.push(JSON.parse(JSON.stringify(nestedObj)));
        expectedDupes++;
      }
    } else if (i % 3 === 1) {
      const nestedArray = [
        i,
        `value-${i}`,
        [
          {
            key: i,
            value: `nested-value-${i}`,
          },
        ],
      ];
      data.push(nestedArray);

      if (i % 11 === 0) {
        data.push(JSON.parse(JSON.stringify(nestedArray)));
        expectedDupes++;
      }
    } else {
      const mixedStructure = {
        id: i,
        name: `name-${i}`,
        data: [
          i,
          `info-${i}`,
          {
            key: i,
            details: {
              nestedKey: `nested-${i}`,
            },
          },
        ],
      };
      data.push(mixedStructure);

      if (i % 5 === 0) {
        data.push(JSON.parse(JSON.stringify(mixedStructure)));
        expectedDupes++;
      }
    }
  }

  return { data, expectedDupes };
}

function measure(label: string, fn: () => void): number {
  const start = `${label}-start`;
  const end = `${label}-end`;
  performance.mark(start);
  fn();
  performance.mark(end);
  performance.measure(label, start, end);
  // @ts-ignore
  return performance.getEntriesByName(label)[0].duration;
}

describe("Performance Benchmarks - Nested Data", () => {
  const datasetSizes = [400, 1000, 20000, 100000];

  for (const datasetSize of datasetSizes) {
    const { data, expectedDupes } = generateDataset(datasetSize);
    const dataSize = data.length;
    const expectedNativeSize = dataSize;
    const expectedSize = dataSize - expectedDupes;

    it("UniqueSet vs DeepSet vs native Set: " + String(datasetSize), () => {
      const unique = new MapSet();
      const deep = new DeepSet();
      const native = new Set();

      const uniqueTime = measure(`unique-nested-${datasetSize}`, () => {
        data.forEach((el) => unique.add(el));
      });

      const deepTime = measure(`deep-nested-${datasetSize}`, () => {
        data.forEach((el) => deep.add(el));
      });

      const nativeTime = measure(`native-nested-${datasetSize}`, () => {
        data.forEach((el) => native.add(el));
      });

      console.log(
        `UniqueSet: ${uniqueTime.toFixed(2)} ms | DeepSet: ${deepTime.toFixed(2)} ms | Native Set: ${nativeTime.toFixed(2)} ms`
      );

      expect(unique.size).toBe(expectedSize);
      expect(deep.size).toBe(expectedSize);
      expect(native.size).toBe(expectedNativeSize);
    });

    it("UniqueSet.has() vs DeepSet.has() - hits and misses: " + String(datasetSize), () => {
      // Pre-populate with half the data
      const half = Math.floor(data.length / 2);
      const uniqueSet = new MapSet(data.slice(0, half));
      const deepSet = new DeepSet(data.slice(0, half));

      // Query all items — first half are hits, second half are mostly misses
      const queries = data.map((el) => JSON.parse(JSON.stringify(el)));

      let uniqueHits = 0;
      const uniqueHasTime = measure(`unique-has-${datasetSize}`, () => {
        for (const q of queries) {
          if (uniqueSet.has(q)) uniqueHits++;
        }
      });

      let deepHits = 0;
      const deepHasTime = measure(`deep-has-${datasetSize}`, () => {
        for (const q of queries) {
          if (deepSet.has(q)) deepHits++;
        }
      });

      console.log(
        `UniqueSet.has(): ${uniqueHasTime.toFixed(2)} ms | DeepSet.has(): ${deepHasTime.toFixed(2)} ms | ${uniqueHits} hits / ${queries.length} queries`
      );

      expect(uniqueHits).toBe(deepHits);
      expect(uniqueHits).toBeGreaterThan(0);
      expect(uniqueHits).toBeLessThan(queries.length);
    });
  }
});
