import { MapSet } from "../dist/index.mjs";
import { performance } from "perf_hooks";
import { describe, it, expect } from "vitest";

function findNextPrime(num: number): number {
  if (num < 2) return 2;
  if ((num & 1) === 0) num++;
  while (true) {
    let isPrime = true;
    const sqrt = Math.sqrt(num);
    for (let i = 3; i <= sqrt; i += 2) {
      if (num % i === 0) {
        isPrime = false;
        break;
      }
    }
    if (isPrime) return num;
    num += 2;
  }
}

interface Dataset {
  data: (string | [number, string] | { key: number; value: string })[];
  expectedDupes: number;
}

function generateDataset(size: number): Dataset {
  const data = [];
  const limit = size * 2;
  const factor = 0.001;
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

      if (i % prime2 === 0) {
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

      if (i % prime3 === 0) {
        data.push(JSON.parse(JSON.stringify(mixedStructure)));
        expectedDupes++;
      }
    }
  }

  return { data, expectedDupes };
}

describe("Performance Benchmarks - Large Scale", () => {
  const datasetSizes = [5000000];

  for (const datasetSize of datasetSizes) {
    const { data, expectedDupes } = generateDataset(datasetSize);
    const dataSize = data.length;
    const expectedNativeSize = dataSize;
    const expectedSize = dataSize - expectedDupes;

    it("MapSet vs native Set: " + String(datasetSize), () => {
      const map = new MapSet();
      const native = new Set();

      performance.mark("map-start" + datasetSize);
      data.forEach((el) => map.add(el));
      performance.mark("map-end" + datasetSize);
      performance.measure(
        "map" + datasetSize,
        "map-start" + datasetSize,
        "map-end" + datasetSize
      );

      performance.mark("native-start" + datasetSize);
      data.forEach((el) => native.add(el));
      performance.mark("native-end" + datasetSize);
      performance.measure(
        "native" + datasetSize,
        "native-start" + datasetSize,
        "native-end" + datasetSize
      );

      // @ts-ignore
      const mapTime =
        performance.getEntriesByName("map" + datasetSize)?.[0]?.duration ?? 0;
      // @ts-ignore
      const nativeTime =
        performance.getEntriesByName("native" + datasetSize)?.[0]?.duration ??
        0;

      console.log(
        `MapSet: ${mapTime.toFixed(2)} ms | Native Set: ${nativeTime.toFixed(2)} ms`
      );

      expect(map.size).toBe(expectedSize);
      expect(native.size).toBe(expectedNativeSize);
    });
  }
});
