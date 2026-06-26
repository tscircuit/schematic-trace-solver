/**
 * @typedef {Float64ArrayConstructor | Float32ArrayConstructor |
 *   Uint32ArrayConstructor | Int32ArrayConstructor | Uint16ArrayConstructor |
 *   Int16ArrayConstructor | Uint8ArrayConstructor | Int8ArrayConstructor} TypedArrayConstructor
 */
/** @template [T=number] */
export default class FlatQueue<T = number> {
    /**
     * Creates an empty queue. If `capacity` is provided, the queue is backed by fixed-size typed
     * arrays for better performance and memory use, but can't grow beyond `capacity`. `values` uses
     * `ValuesArray` (default `Float64Array`) and `ids` uses `IdsArray` (default `Uint32Array`); pass
     * narrower constructors like `Uint16Array` if your values or ids are known to fit them.
     *
     * @param {number} [capacity]
     * @param {TypedArrayConstructor} [ValuesArray]
     * @param {TypedArrayConstructor} [IdsArray]
     */
    constructor(capacity?: number, ValuesArray?: TypedArrayConstructor, IdsArray?: TypedArrayConstructor);
    /** @type {T[]} */
    ids: T[];
    /** @type {number[]} */
    values: number[];
    /** Maximum number of items the queue can hold; `Infinity` for regular-array queues, which grow on demand. */
    capacity: number;
    /** Number of items in the queue. */
    length: number;
    /** Removes all items from the queue. */
    clear(): void;
    /**
     * Adds `item` to the queue with the specified `priority`.
     *
     * `priority` must be a number. Items are sorted and returned from low to high priority. Multiple items
     * with the same priority value can be added to the queue, but there is no guaranteed order between these items.
     *
     * For fixed-capacity queues, throws a `RangeError` if the queue is already full.
     *
     * @param {T} item
     * @param {number} priority
     */
    push(item: T, priority: number): void;
    /**
     * Removes and returns the item from the head of this queue, which is one of
     * the items with the lowest priority. If this queue is empty, returns `undefined`.
     */
    pop(): T | undefined;
    /** Returns the item from the head of this queue without removing it. If this queue is empty, returns `undefined`. */
    peek(): T | undefined;
    /**
     * Returns the priority value of the item at the head of this queue without
     * removing it. If this queue is empty, returns `undefined`.
     */
    peekValue(): number | undefined;
    /**
     * Shrinks the internal arrays to `this.length`. No-op for queues with fixed capacity.
     *
     * `pop()` and `clear()` calls don't free memory automatically to avoid unnecessary resize operations.
     * This also means that items that have been added to the queue can't be garbage collected until
     * a new item is pushed in their place, or this method is called.
     */
    shrink(): void;
}
export type TypedArrayConstructor = Float64ArrayConstructor | Float32ArrayConstructor | Uint32ArrayConstructor | Int32ArrayConstructor | Uint16ArrayConstructor | Int16ArrayConstructor | Uint8ArrayConstructor | Int8ArrayConstructor;
