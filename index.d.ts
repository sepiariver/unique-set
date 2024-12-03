declare module "unique-set" {
  /**
   * A `Set` extension that ensures uniqueness of items using deep equality checks.
   */
  export class UniqueSet<T> extends Set<T> {
    /**
     * Creates a new `UniqueSet` instance.
     * @param iterable Optional: an iterable with which to initialize the UniqueSet.
     * @throws TypeError If the input is not iterable.
     */
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

  /**
   * A `Set` extension that uses a Bloom filter for fast existence checks combined with deep equality for accuracy.
   */
  export class BloomSet<T> extends Set<T> {
    /**
     * Creates a new `BloomSet` instance.
     * @param iterable Optional: an iterable object with which to initialize the BloomSet.
     * @param options Bloom filter configuration options.
     * @param options.size The size of the Bloom filter's bit array. Defaults to 28,755,000.
     * @param options.hashCount The number of hash functions to use. Defaults to 20.
     * @throws TypeError If the input is not iterable.
     */
    constructor(
      iterable?: Iterable<T>,
      options?: { size?: number; hashCount?: number }
    );

    /**
     * Determines existence of an object in the BloomSet using the Bloom filter and deep equality.
     * @param o The object to check for presence in the BloomSet.
     * @returns `true` if the object is found, `false` otherwise.
     */
    has(o: T): boolean;

    /**
     * Adds a new object to the BloomSet  if it is not already present.
     * @param o The object to add to the BloomSet.
     * @returns The `BloomSet` instance, allowing for chaining.
     */
    add(o: T): this;
  }

}
