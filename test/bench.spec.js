import { BloomSet, UniqueSet } from "../dist";
const { performance } = require("perf_hooks");

function generateDataset(size) {
  const dataset = [];
  const limit = size * 2;
  for (let i = size; i < limit; i++) {
    if (i % 3 === 0) {
      dataset.push({ key: i, value: `value-${i}` });
      if (i % 7 === 0) {
        dataset.push({ key: i, value: `value-${i}` }); // Duplicate object
      }
    } else if (i % 3 === 1) {
      dataset.push([i, `value-${i}`]);
      if (i % 11 === 0) {
        dataset.push([i, `value-${i}`]); // Duplicate array
      }
    } else {
      dataset.push(`string-${i}`);
      if (i % 5 === 0) {
        dataset.push(`string-${i}`); // Duplicate string
      }
    }
  }
  return dataset;
}

describe("Performance Benchmarks", () => {
  const datasetSizes = [1000, 20000];
  const iterations = 1;
  for (const datasetSize of datasetSizes) {
    const data = generateDataset(datasetSize);
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
    });
  }
});
