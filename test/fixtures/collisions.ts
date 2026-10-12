// Values whose structural hashes collide, so tests can reach MapSet's multi-value bucket paths.
// They depend on the current hash; extra.spec.ts asserts that they still collide, so a hash change
// fails there by name rather than leaving the bucket tests silently testing nothing.
//
// The pairs were found by brute force: hash (i * 2654435761 >>> 0).toString(36), alone or as
// { s: ... }, for increasing i until a hash repeats. The undefined family was found meet-in-the-middle:
// FNV-1a's multiply is invertible mod 2^32, so hash a table of 4-character prefixes forward from the
// string tag, unwind the last 3 characters backwards from the hash of `undefined`, and look for a
// state both directions reach.

/** Two distinct strings with the same hash. */
export const collidingStrings = ["1lhyg3m", "prr3b2"] as const;

/** Two distinct plain objects with the same hash. */
export const collidingObjects = [{ s: "5wzl9" }, { s: "aimo63" }] as const;

/** Three distinct strings that share a hash with `undefined`. */
export const collidingWithUndefined = ["1isi6pa", "wctr20c", "fuw8gce"] as const;
