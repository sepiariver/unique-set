declare const structuralHash: (value: unknown) => number;
declare class MapSet<T> {
    #private;
    constructor(iterable?: Iterable<T>);
    add(value: T): this;
    has(value: T): boolean;
    delete(value: T): boolean;
    get size(): number;
    clear(): void;
    forEach(callback: (value: T, valueAgain: T, set: this) => void, thisArg?: any): void;
    values(): IterableIterator<T>;
    [Symbol.iterator](): IterableIterator<T>;
}

export { MapSet, structuralHash };
