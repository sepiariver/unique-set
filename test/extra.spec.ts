import { MapSet, structuralHash } from "../dist/index.mjs";
import { describe, it, expect } from "vitest";
import {
  collidingObjects,
  collidingStrings,
  collidingWithUndefined,
} from "./fixtures/collisions";

const [strA, strB] = collidingStrings;
const [objA, objB] = collidingObjects;
const [undefA, undefB, undefC] = collidingWithUndefined;

describe("collision fixtures", () => {
  it("still collide under the current hash", () => {
    expect(structuralHash(strB)).toBe(structuralHash(strA));
    expect(structuralHash(objB)).toBe(structuralHash(objA));
    for (const s of collidingWithUndefined) {
      expect(structuralHash(s)).toBe(structuralHash(undefined));
    }
  });
});

describe("MapSet collision buckets", () => {
  it("stores colliding values separately and deduplicates within a bucket", () => {
    const set = new MapSet<unknown>([strA, strB, strA, strB]);
    expect(set.size).toBe(2);
    expect(set.has(strA)).toBe(true);
    expect(set.has(strB)).toBe(true);

    // Fresh objects, so equality goes through fast-equals rather than reference identity.
    const objects = new MapSet<unknown>([{ ...objA }, { ...objB }, { ...objA }, { ...objB }]);
    expect(objects.size).toBe(2);
    expect(objects.has({ ...objA })).toBe(true);
    expect(objects.has({ ...objB })).toBe(true);
    expect(objects.has({ s: "other" })).toBe(false);
  });

  it("misses a value that shares a key with an inline or bucketed value", () => {
    const set = new MapSet<unknown>([undefA]);
    expect(set.has(undefB)).toBe(false); // same key, inline slot
    expect(set.delete(undefB)).toBe(false);
    set.add(undefB);
    expect(set.has(undefC)).toBe(false); // same key, bucket
    expect(set.delete(undefC)).toBe(false);
    expect(set.size).toBe(2);
  });

  it("collapses a bucket on delete and rebuilds it on add", () => {
    const set = new MapSet<unknown>([strA, strB]);
    expect(set.delete(strA)).toBe(true);
    expect(set.size).toBe(1);
    expect(set.has(strA)).toBe(false);
    expect(set.has(strB)).toBe(true);
    expect([...set]).toEqual([strB]);

    set.add(strA);
    expect(set.size).toBe(2);
    expect([...set]).toEqual([strB, strA]);

    expect(set.delete(strB)).toBe(true);
    expect(set.delete(strA)).toBe(true);
    expect(set.size).toBe(0);
    expect([...set]).toEqual([]);
  });

  it("deletes from the middle of a bucket of three", () => {
    const set = new MapSet<unknown>(collidingWithUndefined);
    expect(set.delete(undefB)).toBe(true);
    expect([...set]).toEqual([undefA, undefC]);
    expect(set.size).toBe(2);
  });

  it("yields a colliding value next to its bucket-mate", () => {
    const set = new MapSet(["first", strA, "middle", strB, "last"]);
    expect([...set]).toEqual(["first", strA, strB, "middle", "last"]);

    const seen: string[] = [];
    set.forEach((value, valueAgain, self) => {
      expect(valueAgain).toBe(value);
      expect(self).toBe(set);
      seen.push(value);
    });
    expect(seen).toEqual([...set.values()]);
  });
});

describe("MapSet with undefined", () => {
  it("tells a stored undefined from an absent key", () => {
    const set = new MapSet<unknown>();
    expect(set.has(undefined)).toBe(false);
    expect(set.delete(undefined)).toBe(false);

    set.add(undefA);
    expect(set.has(undefined)).toBe(false); // undefined's key holds only a colliding string
    expect(set.delete(undefined)).toBe(false);
    expect(set.size).toBe(1);
  });

  it("shares a bucket with values that collide with it", () => {
    const set = new MapSet<unknown>([undefined, undefined]);
    expect(set.size).toBe(1);
    expect(set.has(undefA)).toBe(false);
    expect(set.delete(undefA)).toBe(false);

    set.add(undefA);
    set.add(undefined);
    expect(set.size).toBe(2);
    expect([...set]).toEqual([undefined, undefA]);

    expect(set.delete(undefined)).toBe(true);
    expect(set.has(undefined)).toBe(false);
    expect(set.has(undefA)).toBe(true);
    expect([...set]).toEqual([undefA]);

    // The bucket has collapsed back to the inline string; undefined can join it again.
    set.add(undefined);
    expect([...set]).toEqual([undefA, undefined]);
    expect(set.delete(undefA)).toBe(true);
    expect(set.has(undefined)).toBe(true);
    expect(set.delete(undefined)).toBe(true);
    expect(set.size).toBe(0);
  });
});
