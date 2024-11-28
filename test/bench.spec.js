import UniqueSet from "../dist";
const { performance } = require("perf_hooks");

describe("UniqueSet Performance Benchmarks", () => {
  it("adds elements and compares performance with native Set", () => {
    console.log("Performance test: UniqueSet vs native Set");

    const data = [
      "string",
      "another string",
      "string",
      1,
      2,
      1,
      {
        foo: "bar",
        bar: "baz",
        baz: "lurman",
      },
      {
        bar: "baz",
        baz: "lurman",
        foo: "bar",
      },
      [1, 2, 3],
      [1, 2, 3],
    ];

    let unique = new UniqueSet();
    let native = new Set();

    performance.mark("unique-start");
    for (let i = 0; i < 10000; i++) {
      data.forEach((el) => {
        unique.add(el);
      });
    }
    performance.mark("unique-end");
    performance.measure("unique", "unique-start", "unique-end");

    performance.mark("native-start");
    for (let i = 0; i < 10000; i++) {
      data.forEach((el) => {
        native.add(el);
      });
    }
    performance.mark("native-end");
    performance.measure("native", "native-start", "native-end");

    const uniqueTime = performance.getEntriesByName("unique")[0].duration;
    const nativeTime = performance.getEntriesByName("native")[0].duration;

    console.log(`UniqueSet execution time: ${uniqueTime.toFixed(2)} ms`);
    console.log(`Native Set execution time: ${nativeTime.toFixed(2)} ms`);

    expect(uniqueTime).toBeLessThan(nativeTime * 50); // Deep comparison is 50x slower
  });
});
