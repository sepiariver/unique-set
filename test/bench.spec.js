import { BloomSet, UniqueSet } from "../dist";
const { performance } = require("perf_hooks");

function generateDataset(size) {
  const data = [];
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
  const datasetSizes = [1000, 20000];
  const iterations = 1;
  for (const datasetSize of datasetSizes) {
    const { data, expectedDupes, stringDupes } = generateDataset(datasetSize);
    const dataSize = data.length;
    const expectedNativeSize = dataSize - stringDupes;
    const expectedSize = expectedNativeSize - expectedDupes;

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

      const uniqueTime = performance.getEntriesByName(
        "unique" + String(datasetSize)
      )[0].duration;
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
      // Native Set will have duplicates
      expect(native.size).toBe(expectedNativeSize);
    });

    it("BloomSet vs native Set: " + String(datasetSize), () => {
      console.log(
        "Performance test: BloomSet vs native Set" + String(datasetSize)
      );

      const bloom = new BloomSet();
      const native = new Set();

      // Measure BloomSet
      performance.mark("bloom-start" + String(datasetSize));
      for (let i = 0; i < iterations; i++) {
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

      const bloomTime = performance.getEntriesByName(
        "bloom" + String(datasetSize)
      )[0].duration;
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
      // Native Set will have duplicates
      expect(native.size).toBe(expectedNativeSize);
    });
  }
});
