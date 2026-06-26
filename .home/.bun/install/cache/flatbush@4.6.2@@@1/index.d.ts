/** @typedef {Int8ArrayConstructor | Uint8ArrayConstructor | Uint8ClampedArrayConstructor | Int16ArrayConstructor | Uint16ArrayConstructor | Int32ArrayConstructor | Uint32ArrayConstructor | Float32ArrayConstructor | Float64ArrayConstructor} TypedArrayConstructor */
/** @typedef {Int8Array | Uint8Array | Uint8ClampedArray | Int16Array | Uint16Array | Int32Array | Uint32Array | Float32Array | Float64Array} TypedArray */
export default class Flatbush {
    /**
     * Recreate a Flatbush index from raw `ArrayBuffer` or `SharedArrayBuffer` data.
     * @param {ArrayBufferLike} data
     * @param {number} [byteOffset=0] byte offset to the start of the Flatbush buffer in the referenced ArrayBuffer.
     * @returns {Flatbush} index
     */
    static from(data: ArrayBufferLike, byteOffset?: number): Flatbush;
    /**
     * Create a Flatbush index that will hold a given number of items.
     * @param {number} numItems
     * @param {number} [nodeSize=16] Size of the tree node (16 by default).
     * @param {TypedArrayConstructor} [ArrayType=Float64Array] The array type used for coordinates storage (`Float64Array` by default).
     * @param {ArrayBufferConstructor | SharedArrayBufferConstructor} [ArrayBufferType=ArrayBuffer] The array buffer type used to store data (`ArrayBuffer` by default).
     * @param {ArrayBufferLike} [data] (Only used internally)
     * @param {number} [byteOffset=0] (Only used internally)
     */
    constructor(numItems: number, nodeSize?: number, ArrayType?: TypedArrayConstructor, ArrayBufferType?: ArrayBufferConstructor | SharedArrayBufferConstructor, data?: ArrayBufferLike, byteOffset?: number);
    numItems: number;
    nodeSize: number;
    byteOffset: number;
    _levelBounds: number[];
    ArrayType: TypedArrayConstructor;
    IndexArrayType: Uint16ArrayConstructor | Uint32ArrayConstructor;
    data: ArrayBufferLike;
    _boxes: TypedArray;
    _indices: Uint16Array<ArrayBufferLike> | Uint32Array<ArrayBufferLike>;
    _pos: number;
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    /** @type FlatQueue<number> */
    _queue: FlatQueue<number>;
    /**
     * Add a given rectangle to the index.
     * @param {number} minX
     * @param {number} minY
     * @param {number} maxX
     * @param {number} maxY
     * @returns {number} A zero-based, incremental number that represents the newly added rectangle.
     */
    add(minX: number, minY: number, maxX?: number, maxY?: number): number;
    /** Perform indexing of the added rectangles. */
    finish(): void;
    /**
     * Search the index by a bounding box.
     * @param {number} minX
     * @param {number} minY
     * @param {number} maxX
     * @param {number} maxY
     * @param {(index: number, x0: number, y0: number, x1: number, y1: number) => boolean} [filterFn] An optional function that is called on every found item; if supplied, only items for which this function returns true will be included in the results array.
     * @returns {number[]} An array of indices of items intersecting or touching the given bounding box.
     */
    search(minX: number, minY: number, maxX: number, maxY: number, filterFn?: (index: number, x0: number, y0: number, x1: number, y1: number) => boolean): number[];
    /**
     * Collect all leaves of a subtree that's fully inside the query, skipping intersection tests.
     * Because the tree is packed bottom-up, those leaves occupy one contiguous block of the leaf
     * level, so we skip traversal entirely: descend to the first leaf, then sweep the flat range.
     * @param {number} nodeIndex
     * @param {number} end
     * @param {number} level
     * @param {number} numItems4
     * @param {number[]} results
     * @param {((index: number, x0: number, y0: number, x1: number, y1: number) => boolean) | undefined} filterFn
     */
    _collectContained(nodeIndex: number, end: number, level: number, numItems4: number, results: number[], filterFn: ((index: number, x0: number, y0: number, x1: number, y1: number) => boolean) | undefined): void;
    /**
     * Search items in order of distance from the given point.
     * @param {number} x
     * @param {number} y
     * @param {number} [maxResults=Infinity]
     * @param {number} [maxDistance=Infinity]
     * @param {(index: number) => boolean} [filterFn] An optional function for filtering the results.
     * @returns {number[]} An array of indices of items found.
     */
    neighbors(x: number, y: number, maxResults?: number, maxDistance?: number, filterFn?: (index: number) => boolean): number[];
}
export type TypedArrayConstructor = Int8ArrayConstructor | Uint8ArrayConstructor | Uint8ClampedArrayConstructor | Int16ArrayConstructor | Uint16ArrayConstructor | Int32ArrayConstructor | Uint32ArrayConstructor | Float32ArrayConstructor | Float64ArrayConstructor;
export type TypedArray = Int8Array | Uint8Array | Uint8ClampedArray | Int16Array | Uint16Array | Int32Array | Uint32Array | Float32Array | Float64Array;
import FlatQueue from 'flatqueue';
