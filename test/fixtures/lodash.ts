/*
 * Data shapes ported from lodash's `_.isEqual` benchmarks:
 * https://github.com/lodash/lodash/blob/2b5e6f7/perf/perf.js
 *
 * lodash is MIT licensed, Copyright OpenJS Foundation and other contributors
 * <https://openjsf.org/>, based on Underscore.js, copyright Jeremy Ashkenas.
 * Upstream compares pairs that differ only in their final element (`object2` vs `object3`,
 * `numbers2` vs `numbers3`, ...). This port turns that into a set of near-miss values, so a
 * hash or comparator that stops early, or ignores the tail, shows up as a wrong size.
 */
const LIMIT = 50;

/** Four upstream shapes in rotation, each varying only in its last element. */
export function lodashNearMisses(count: number): unknown[] {
  const values: unknown[] = [];
  for (let i = 0; i < count; i++) {
    switch (i % 4) {
      case 0: {
        // `object2` / `object3`: { key0: 0, ..., key49: <varies> }
        const object: Record<string, number> = {};
        for (let k = 0; k < LIMIT; k++) object["key" + k] = k;
        object["key" + (LIMIT - 1)] = -(i + 1);
        values.push(object);
        break;
      }
      case 1:
        // `numbers2` / `numbers3`
        values.push([...Array.from({ length: LIMIT - 1 }, (_, k) => k), -(i + 1)]);
        break;
      case 2:
        // `objects2` / `objects3`
        values.push([...Array.from({ length: LIMIT - 1 }, (_, k) => ({ num: k })), { num: -(i + 1) }]);
        break;
      default:
        // `nestedNumbers2` / `nestedNumbers3`
        values.push([1, [2], [3, [[-(i + 1)]]]]);
    }
  }
  return values;
}
