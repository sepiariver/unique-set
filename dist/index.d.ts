/**
 * A 32-bit FNV-1a hash computed by traversing the value, without building an intermediate
 * string. Hashes of objects compared by reference hold only within one process (README.md,
 * "Objects compared by reference").
 */
declare const structuralHash: (value: unknown) => number;
/**
 * What the set-algebra methods accept as their argument, as in the ES2025 `Set` methods: any
 * object with a numeric `size`, a `has()` and a `keys()`, such as a `MapSet`, `Set` or `Map`.
 */
interface SetLike<T> {
    readonly size: number;
    has(value: T): boolean;
    keys(): Iterator<T>;
}
declare class MapSet<T> {
    #private;
    constructor(iterable?: Iterable<T> | null);
    add(value: T): this;
    has(value: T): boolean;
    delete(value: T): boolean;
    get size(): number;
    clear(): void;
    forEach(callback: (value: T, valueAgain: T, set: this) => void, thisArg?: any): void;
    values(): IterableIterator<T>;
    /** The same as `values()`, as on `Set`. */
    keys(): IterableIterator<T>;
    /** Yields `[value, value]` for each value, as on `Set`. */
    entries(): IterableIterator<[T, T]>;
    [Symbol.iterator](): IterableIterator<T>;
    get [Symbol.toStringTag](): string;
    /** A new set with the values of this set, then those of `other` that it lacks. */
    union<U>(other: SetLike<U>): MapSet<T | U>;
    /** A new set with the values of this set that `other` also has. */
    intersection<U>(other: SetLike<U>): MapSet<T & U>;
    /** A new set with the values of this set that `other` does not have. */
    difference<U>(other: SetLike<U>): MapSet<T>;
    /** A new set with the values in exactly one of this set and `other`. */
    symmetricDifference<U>(other: SetLike<U>): MapSet<T | U>;
    /** Whether `other` has every value of this set. */
    isSubsetOf(other: SetLike<unknown>): boolean;
    /** Whether this set has every value of `other`. */
    isSupersetOf(other: SetLike<unknown>): boolean;
    /** Whether this set and `other` have no value in common. */
    isDisjointFrom(other: SetLike<unknown>): boolean;
}

export { MapSet, type SetLike, MapSet as UniqueSet, structuralHash };
