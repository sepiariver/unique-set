import UniqueSet from "../dist";
const { performance, PerformanceObserver } = require("perf_hooks")

describe("UniqueSet", () => {
  const perfObserver1 = new PerformanceObserver((items) => {
    items.getEntries().forEach((entry) => {
      console.log(entry)
    })
  });

  perfObserver1.observe({ entryTypes: ["measure"], buffer: true });
  it("adding the same elements multiple times", () => {
    console.log("adding the same elements multiple times");
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
    performance.mark("unique-start");
    for (let i = 0; i < 10000; i++) {
      data.forEach((el) => {
        unique.add(el);
      });
    }
    performance.mark("unique-end");
    performance.measure("unique", "unique-start", "unique-end");

    let native = new Set();
    performance.mark("native-start");
    for (let i = 0; i < 10000; i++) {
      data.forEach((el) => {
        native.add(el);
      });
    }
    performance.mark("native-end");
    performance.measure("native", "native-start", "native-end");
  });

  it("adding some elements to a large Set", () => {
    console.log("adding the some elements to a large Set");
    const data1 = Array.from({length: 1000}, () => Math.floor(Math.random() * 1000));
    const data2 = Array.from({length: 1000}, () => `string-${Math.floor(Math.random() * 1000)}`);
    const data3 = Array.from({length: 1000}, () => {
      return {
        num: Math.floor(Math.random() * 1000),
        str: `string-${Math.floor(Math.random() * 1000)}`
      };
    });
    const data4 = Array.from({length: 1000}, () => {
      return [
        Math.floor(Math.random() * 1000),
        `string-${Math.floor(Math.random() * 1000)}`
      ];
    });
    const data = data1.concat(data2, data3, data4);
    console.log(data.length);

    let unique = new UniqueSet();
    performance.mark("unique2-start");
    data.forEach((el) => {
      unique.add(el);
    });
    performance.mark("unique2-end");
    performance.measure("unique2", "unique2-start", "unique2-end");

    let native = new Set();
    performance.mark("native2-start");
    data.forEach((el) => {
      native.add(el);
    });
    performance.mark("native2-end");
    performance.measure("native2", "native2-start", "native2-end");
  });

  it("creating a large Set", () => {
    console.log("creating a large Set");
    const data1 = Array.from({length: 1000}, () => Math.floor(Math.random() * 1000));
    const data2 = Array.from({length: 1000}, () => `string-${Math.floor(Math.random() * 1000)}`);
    const data3 = Array.from({length: 1000}, () => {
      return {
        num: Math.floor(Math.random() * 1000),
        str: `string-${Math.floor(Math.random() * 1000)}`
      };
    });
    const data4 = Array.from({length: 1000}, () => {
      return [
        Math.floor(Math.random() * 1000),
        `string-${Math.floor(Math.random() * 1000)}`
      ];
    });
    const data = data1.concat(data2, data3, data4);
    console.log(data.length);

    performance.mark("unique3-start");
    let unique = new UniqueSet(data);
    performance.mark("unique3-end");
    performance.measure("unique3", "unique3-start", "unique3-end");

    performance.mark("native3-start");
    let native = new Set(data);
    performance.mark("native3-end");
    performance.measure("native3", "native3-start", "native3-end");
  });
});