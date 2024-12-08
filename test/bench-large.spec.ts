import { BloomSet, CuckooSet, MapSet, findNextPrime } from "../dist/index.mjs";
import { performance } from "perf_hooks";
import { describe, it, expect, test } from "vitest";

interface Dataset {
  data: (string | [number, string] | { key: number; value: string })[];
  expectedDupes: number;
}

function generateDataset(size: number): Dataset {
  const data = [];
  const limit = size * 2;
  const factor = 0.00001; // 0.001: 0.99% duplicates; 0.0001: 8.5%; 0.00001: 14.3%
  const prime1 = findNextPrime(Math.floor(size * factor));
  const prime2 = findNextPrime(prime1);
  const prime3 = findNextPrime(prime2);

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

      if (i % prime1 === 0) {
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

      if (i % prime2 === 0) {
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

      if (i % prime3 === 0) {
        data.push(JSON.parse(JSON.stringify(mixedStructure))); // Duplicate mixed structure
        expectedDupes++;
      }
    }
  }

  return { data, expectedDupes };
}

describe("Performance Benchmarks - Nested Data 100K", () => {
  const datasetConfigs = {
    //100000: { hashCount: 7, size: 6553577 },
    //100000: { hashCount: 1, size: 28755000 },
    //1000000: { hashCount: 3, size: 4000000007 },
    5000000: { hashCount: 7, size: 8000000011 },
  };
  const iterations = 1;

  for (const [datasetSize, conf] of Object.entries(datasetConfigs)) {
    const { data, expectedDupes } = generateDataset(parseInt(datasetSize));
    const dataSize = data.length;
    const expectedNativeSize = dataSize; // Native Set only handles string/primitive deduping
    const expectedSize = dataSize - expectedDupes;
    const tenPercent = Math.ceil(dataSize * 0.1);

    let uniqueTiming = 0;

    it.skip("BloomSet vs native Set: " + String(datasetSize), () => {
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
      const bloomTime =
        performance.getEntriesByName("bloom" + String(datasetSize))?.[0]
          ?.duration ?? 0;
      // @ts-ignore
      const nativeTime =
        performance.getEntriesByName("native" + String(datasetSize))?.[0]
          ?.duration ?? 0;

      console.log(`BloomSet execution time: ${bloomTime.toFixed(2)} ms`);
      console.log(`Native Set execution time: ${nativeTime.toFixed(2)} ms`);

      expect(nativeTime).toBeLessThan(bloomTime);

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

    it("CuckooSet vs native Set: " + String(datasetSize), () => {
      console.log(
        "Performance test: CuckooSet vs native Set" + String(datasetSize)
      );

      const cuckoo = new CuckooSet([], {
        numBuckets: dataSize,
        fingerprintSize: 24,
      });
      const native = new Set();

      // Measure CuckooSet
      performance.mark("cuckoo-start" + String(datasetSize));
      for (let i = 0; i < iterations; i++) {
        // @ts-ignore
        data.forEach((el) => cuckoo.add(el));
      }
      performance.mark("cuckoo-end" + String(datasetSize));
      performance.measure(
        "cuckoo" + String(datasetSize),
        "cuckoo-start" + String(datasetSize),
        "cuckoo-end" + String(datasetSize)
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
      const cuckooTime =
        performance.getEntriesByName("cuckoo" + String(datasetSize))?.[0]
          ?.duration ?? 0;
      // @ts-ignore
      const nativeTime =
        performance.getEntriesByName("native" + String(datasetSize))?.[0]
          ?.duration ?? 0;

      console.log(`CuckooSet execution time: ${cuckooTime.toFixed(2)} ms`);
      console.log(`Native Set execution time: ${nativeTime.toFixed(2)} ms`);

      expect(nativeTime).toBeLessThan(cuckooTime);

      console.log(
        "CuckooSet size: " + cuckoo.size,
        "Expected size: " + expectedSize
      );
      expect(cuckoo.size).toBe(expectedSize);

      console.log(
        "Native Set size: " + native.size,
        "Expected size: " + expectedNativeSize
      );
      // Native Set will not deduplicate deeply nested structures
      expect(native.size).toBe(expectedNativeSize);
    });

    it.skip("MapSet vs native Set: " + String(datasetSize), () => {
      console.log(
        "Performance test: MapSet vs native Set" + String(datasetSize)
      );

      const map = new MapSet();
      const native = new Set();

      // Measure MapSet
      performance.mark("map-start" + String(datasetSize));
      for (let i = 0; i < iterations; i++) {
        // @ts-ignore
        data.forEach((el) => map.add(el));
      }
      performance.mark("map-end" + String(datasetSize));
      performance.measure(
        "map" + String(datasetSize),
        "map-start" + String(datasetSize),
        "map-end" + String(datasetSize)
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
      const mapTime =
        performance.getEntriesByName("map" + String(datasetSize))?.[0]
          ?.duration ?? 0;
      // @ts-ignore
      const nativeTime =
        performance.getEntriesByName("native" + String(datasetSize))?.[0]
          ?.duration ?? 0;

      console.log(`MapSet execution time: ${mapTime.toFixed(2)} ms`);
      console.log(`Native Set execution time: ${nativeTime.toFixed(2)} ms`);

      expect(nativeTime).toBeLessThan(mapTime);

      console.log("MapSet size: " + map.size, "Expected size: " + expectedSize);
      expect(map.size).toBe(expectedSize);

      console.log(
        "Native Set size: " + native.size,
        "Expected size: " + expectedNativeSize
      );
      // Native Set will not deduplicate deeply nested structures
      expect(native.size).toBe(expectedNativeSize);
    });
  }
});
