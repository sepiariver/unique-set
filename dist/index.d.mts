/** Utility functions */
declare const serialize: (item: any | number | object) => string;
declare const fnv1a: (str: string) => number;
declare const fnv1a64: (str: string) => bigint;
declare const findNextPrime: (num: number) => number;
/** A `Set` extension that ensures uniqueness of items using deep equality checks. */
declare class UniqueSet<T> extends Set<T> {
    /*** @throws TypeError If the input is not iterable. */
    constructor(iterable?: Iterable<T>);
    /**
     * Determines whether an object is in the UniqueSet using deep equality.
     * @param o The object to check for presence in the UniqueSet.
     * @returns `true` if the object is found, `false` otherwise.
     */
    has(o: T): boolean;
    /**
     * Adds a new object to the UniqueSet if it is not already present.
     * @param o The object to add to the UniqueSet.
     * @returns The `UniqueSet` instance, allowing for chaining.
     */
    add(o: T): this;
}
/** A `Set` extension that uses a Bloom filter for fast existence checks combined with deep equality for accuracy. */
declare class BloomSet<T> extends Set<T> {
    #private;
    /**
     * Creates a new `BloomSet` instance.
     * @param iterable Optional: an iterable object with which to initialize the BloomSet.
     * @param options Bloom filter configuration options.
     * @param options.size The size of the Bloom filter's bit array. Defaults to 6553577.
     * @param options.hashCount The number of hash functions to use. Defaults to 7.
     * @throws TypeError If the input is not iterable.
     */
    constructor(iterable?: Iterable<T>, options?: {
        size?: number;
        hashCount?: number;
    });
    /** Determines existence of an object in the BloomSet using the Bloom filter and deep equality */
    has(o: T): boolean;
    /** Adds a new object to the BloomSet if it is not already present.
     * @returns The `BloomSet` instance, allowing for chaining.
     */
    add(o: T): this;
}
declare class MapSet<T> {
    #private;
    constructor(iterable?: Iterable<T>, options?: {
        hashFunction?: (value: T) => number | bigint;
    });
    add(value: T): this;
    has(value: T): boolean;
    delete(value: T): boolean;
    get size(): number;
    clear(): void;
    forEach(callback: (value: T, valueAgain: T, set: this) => void, thisArg?: any): void;
    values(): IterableIterator<T>;
    [Symbol.iterator](): IterableIterator<T>;
}

export { BloomSet, MapSet, UniqueSet, findNextPrime, fnv1a, fnv1a64, serialize };
