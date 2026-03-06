import { MapSet } from "../dist/index.mjs";
import { DeepSet } from "deep-equality-data-structures";
import { performance } from "perf_hooks";
import { describe, it, expect } from "vitest";

interface Dataset {
  data: (string | [number, string] | { key: number; value: string })[];
  expectedDupes: number;
  stringDupes: number;
}

function generateDataset(size: number): Dataset {
  const data: (string | [number, string] | { key: number; value: string })[] =
    [];
  const limit = size * 2;
  let expectedDupes = 0;
  let stringDupes = 0;
  for (let i = size; i < limit; i++) {
    if (i % 3 === 0) {
      data.push({ key: i, value: `value-${i}` });
      if (i % 7 === 0) {
        data.push({ key: i, value: `value-${i}` }); // Duplicate object
        expectedDupes++;
      }
    } else if (i % 3 === 1) {
      data.push([i, `value-${i}`]);
      if (i % 11 === 0) {
        data.push([i, `value-${i}`]); // Duplicate array
        expectedDupes++;
      }
    } else {
      data.push(`string-${i}`);
      if (i % 5 === 0) {
        data.push(`string-${i}`); // Duplicate string
        stringDupes++;
      }
    }
  }

  return { data, expectedDupes, stringDupes };
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

describe("Performance Benchmarks", () => {
  const datasetSizes = [400, 1000, 20000, 100000];

  for (const datasetSize of datasetSizes) {
    const { data, expectedDupes, stringDupes } = generateDataset(datasetSize);
    const dataSize = data.length;
    const expectedNativeSize = dataSize - stringDupes;
    const expectedSize = expectedNativeSize - expectedDupes;

    it("UniqueSet vs DeepSet vs native Set: " + String(datasetSize), () => {
      const unique = new MapSet();
      const deep = new DeepSet();
      const native = new Set();

      const uniqueTime = measure(`unique-${datasetSize}`, () => {
        data.forEach((el) => unique.add(el));
      });

      const deepTime = measure(`deep-${datasetSize}`, () => {
        data.forEach((el) => deep.add(el));
      });

      const nativeTime = measure(`native-${datasetSize}`, () => {
        data.forEach((el) => native.add(el));
      });

      console.log(
        `UniqueSet: ${uniqueTime.toFixed(2)} ms | DeepSet: ${deepTime.toFixed(2)} ms | Native Set: ${nativeTime.toFixed(2)} ms`
      );

      expect(unique.size).toBe(expectedSize);
      expect(deep.size).toBe(expectedSize);
      expect(native.size).toBe(expectedNativeSize);
    });
  }
});
