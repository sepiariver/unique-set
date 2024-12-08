import { MapSet } from "../dist/index.mjs";
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

describe("Performance Benchmarks", () => {
  const datasetSizes = [400, 1000, 20000];

  for (const datasetSize of datasetSizes) {
    const { data, expectedDupes, stringDupes } = generateDataset(datasetSize);
    const dataSize = data.length;
    const expectedNativeSize = dataSize - stringDupes;
    const expectedSize = expectedNativeSize - expectedDupes;

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
      const mapTime = performance.getEntriesByName("map" + datasetSize)[0]
        .duration;
      // @ts-ignore
      const nativeTime = performance.getEntriesByName("native" + datasetSize)[0]
        .duration;

      console.log(
        `MapSet: ${mapTime.toFixed(2)} ms | Native Set: ${nativeTime.toFixed(2)} ms`
      );

      expect(map.size).toBe(expectedSize);
      expect(native.size).toBe(expectedNativeSize);
    });
  }
});
