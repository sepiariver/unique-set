declare module "unique-set" {
  /**
   * A `Set` extension that ensures uniqueness of items using deep equality checks.
   */
  export class UniqueSet<T> extends Set<T> {
    /**
     * Creates a new `UniqueSet` instance.
     * @param iterable An iterable object to initialize the set with.
     * @throws TypeError If the input is not iterable.
     */
    constructor(iterable?: Iterable<T>);

    /**
     * Determines whether an object is in the set using deep equality.
     * @param o The object to check for presence in the set.
     * @returns `true` if the object is found, `false` otherwise.
     */
    has(o: T): boolean;

    /**
     * Adds a new object to the set if it is not already present, using deep equality to check uniqueness.
     * @param o The object to add to the set.
     * @returns The `UniqueSet` instance, allowing for chaining.
     */
    add(o: T): this;
  }

  export default UniqueSet;
}
