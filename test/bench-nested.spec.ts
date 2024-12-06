import { BloomSet, UniqueSet } from "../dist/index.mjs";
import { performance } from "perf_hooks";
import { describe, it, expect, test } from "vitest";

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
        data.push(JSON.parse(JSON.stringify(nestedObj))); // Duplicate deep object
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
        data.push(JSON.parse(JSON.stringify(nestedArray))); // Duplicate deep array
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
        data.push(JSON.parse(JSON.stringify(mixedStructure))); // Duplicate mixed structure
        expectedDupes++;
      }
    }
  }

  return { data, expectedDupes };
}

describe("Performance Benchmarks - Nested Data", () => {
  const datasetConfigs = {
    400: { hashCount: 7 },
    1000: { hashCount: 7 },
    20000: { hashCount: 7 },
  };
  const iterations = 1;

  for (const [datasetSize, conf] of Object.entries(datasetConfigs)) {
    const { data, expectedDupes } = generateDataset(parseInt(datasetSize));
    const dataSize = data.length;
    const expectedNativeSize = dataSize; // Native Set only handles string/primitive deduping
    const expectedSize = dataSize - expectedDupes;

    let uniqueTiming = 0;

    it("UniqueSet vs native Set: " + String(datasetSize), () => {
      console.log(
        "Performance test: UniqueSet vs native Set" + String(datasetSize)
      );

      const unique = new UniqueSet();
      const native = new Set();

      // Measure UniqueSet
      performance.mark("unique-start" + String(datasetSize));
      for (let i = 0; i < iterations; i++) {
        data.forEach((el) => unique.add(el));
      }
      performance.mark("unique-end" + String(datasetSize));
      performance.measure(
        "unique" + String(datasetSize),
        "unique-start" + String(datasetSize),
        "unique-end" + String(datasetSize)
      );

      // Measure native Set
      performance.mark("native-start" + String(datasetSize));
      for (let i = 0; i < iterations; i++) {
        data.forEach((el) => native.add(el));
      }
      performance.mark("native-end" + String(datasetSize));
      performance.measure(
        "native" + String(datasetSize),
        "native-start" + String(datasetSize),
        "native-end" + String(datasetSize)
      );

      // @ts-ignore
      const uniqueTime = performance.getEntriesByName(
        "unique" + String(datasetSize)
      )[0].duration;
      // @ts-ignore
      const nativeTime = performance.getEntriesByName(
        "native" + String(datasetSize)
      )[0].duration;

      console.log(`UniqueSet execution time: ${uniqueTime.toFixed(2)} ms`);
      console.log(`Native Set execution time: ${nativeTime.toFixed(2)} ms`);

      expect(nativeTime).toBeLessThan(uniqueTime);
      uniqueTiming = uniqueTime;

      console.log(
        "UniqueSet size: " + unique.size,
        "Expected size: " + expectedSize
      );
      expect(unique.size).toBe(expectedSize);

      console.log(
        "Native Set size: " + native.size,
        "Expected size: " + expectedNativeSize
      );
      // Native Set will not deduplicate deeply nested structures
      expect(native.size).toBe(expectedNativeSize);
    });

    it("BloomSet vs native Set: " + String(datasetSize), () => {
      console.log(
        "Performance test: BloomSet vs native Set" + String(datasetSize)
      );

      const bloom = new BloomSet([], conf);
      const native = new Set();

      // Measure BloomSet
      performance.mark("bloom-start" + String(datasetSize));
      for (let i = 0; i < iterations; i++) {
        // @ts-ignore
        data.forEach((el) => bloom.add(el));
      }
      performance.mark("bloom-end" + String(datasetSize));
      performance.measure(
        "bloom" + String(datasetSize),
        "bloom-start" + String(datasetSize),
        "bloom-end" + String(datasetSize)
      );

      // Measure native Set
      performance.mark("native-start" + String(datasetSize));
      for (let i = 0; i < iterations; i++) {
        data.forEach((el) => native.add(el));
      }
      performance.mark("native-end" + String(datasetSize));
      performance.measure(
        "native" + String(datasetSize),
        "native-start" + String(datasetSize),
        "native-end" + String(datasetSize)
      );

      // @ts-ignore
      const bloomTime = performance.getEntriesByName(
        "bloom" + String(datasetSize)
      )[0].duration;
      // @ts-ignore
      const nativeTime = performance.getEntriesByName(
        "native" + String(datasetSize)
      )[1].duration;

      console.log(`BloomSet execution time: ${bloomTime.toFixed(2)} ms`);
      console.log(`Native Set execution time: ${nativeTime.toFixed(2)} ms`);

      expect(nativeTime).toBeLessThan(bloomTime);
      expect(bloomTime).toBeLessThan(uniqueTiming);

      console.log(
        "BloomSet size: " + bloom.size,
        "Expected size: " + expectedSize
      );
      expect(bloom.size).toBe(expectedSize);

      console.log(
        "Native Set size: " + native.size,
        "Expected size: " + expectedNativeSize
      );
      // Native Set will not deduplicate deeply nested structures
      expect(native.size).toBe(expectedNativeSize);
    });
  }
});
