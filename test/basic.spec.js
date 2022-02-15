import UniqueSet from "../dist";

describe("UniqueSet", () => {
  it("adds unique objects", () => {
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

    const expected = [
      "string",
      "another string",
      1,
      2,
      {
        foo: "bar",
        bar: "baz",
        baz: "lurman",
      },
      [1, 2, 3],
    ];

    let unique = new UniqueSet();
    data.forEach((el) => {
      unique.add(el);
    });
    expect(expected).toEqual(Array.from(unique));
    expect(unique.size).toBe(6);
  });

  it("complies with MDN reference", () => {
    const mySet1 = new UniqueSet();

    mySet1.add(1); // Set [ 1 ]
    mySet1.add(5); // Set [ 1, 5 ]
    mySet1.add(5); // Set [ 1, 5 ]
    mySet1.add("some text"); // Set [ 1, 5, 'some text' ]
    const o = { a: 1, b: 2 };
    mySet1.add(o);

    mySet1.add({ a: 1, b: 2 }); // o is referencing a different object, we treat this differently

    expect(mySet1.has(1)).toBeTruthy();
    expect(mySet1.has(3)).toBeFalsy();
    expect(mySet1.has(5)).toBeTruthy();
    expect(mySet1.has(Math.sqrt(25))).toBeTruthy();
    expect(mySet1.has("Some Text".toLowerCase())).toBeTruthy();
    expect(mySet1.has(o)).toBeTruthy();
    expect(mySet1.size).toBe(4); // unique

    mySet1.delete(5); // removes 5 from the set
    expect(mySet1.has(5)).toBeFalsy();
    expect(mySet1.size).toBe(3);
  });
});
