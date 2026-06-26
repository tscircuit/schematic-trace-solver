(function(global, factory) {
	typeof exports === "object" && typeof module !== "undefined" ? module.exports = factory() : typeof define === "function" && define.amd ? define([], factory) : (global = typeof globalThis !== "undefined" ? globalThis : global || self, global.Flatbush = factory());
})(this, function() {
	//#region node_modules/flatqueue/index.js
	/**
	* @typedef {Float64ArrayConstructor | Float32ArrayConstructor |
	*   Uint32ArrayConstructor | Int32ArrayConstructor | Uint16ArrayConstructor |
	*   Int16ArrayConstructor | Uint8ArrayConstructor | Int8ArrayConstructor} TypedArrayConstructor
	*/
	/** @template [T=number] */
	var FlatQueue = class {
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
		constructor(capacity = Infinity, ValuesArray = Float64Array, IdsArray = Uint32Array) {
			const fixed = capacity !== Infinity;
			/** @type {T[]} */
			this.ids = fixed ? new IdsArray(capacity) : [];
			/** @type {number[]} */
			this.values = fixed ? new ValuesArray(capacity) : [];
			/** Maximum number of items the queue can hold; `Infinity` for regular-array queues, which grow on demand. */
			this.capacity = capacity;
			/** Number of items in the queue. */
			this.length = 0;
		}
		/** Removes all items from the queue. */
		clear() {
			this.length = 0;
		}
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
		push(item, priority) {
			if (this.length === this.capacity) throw new RangeError("Queue is at capacity.");
			let pos = this.length++;
			while (pos > 0) {
				const parent = pos - 1 >> 1;
				const parentValue = this.values[parent];
				if (priority >= parentValue) break;
				this.ids[pos] = this.ids[parent];
				this.values[pos] = parentValue;
				pos = parent;
			}
			this.ids[pos] = item;
			this.values[pos] = priority;
		}
		/**
		* Removes and returns the item from the head of this queue, which is one of
		* the items with the lowest priority. If this queue is empty, returns `undefined`.
		*/
		pop() {
			if (this.length === 0) return void 0;
			const ids = this.ids, values = this.values, top = ids[0], last = --this.length;
			if (last > 0) {
				const id = ids[last];
				const value = values[last];
				let pos = 0;
				const halfLen = last >> 1;
				while (pos < halfLen) {
					const left = (pos << 1) + 1;
					const right = left + 1;
					const child = left + (+(right < last) & +(values[right] < values[left]));
					if (values[child] >= value) break;
					ids[pos] = ids[child];
					values[pos] = values[child];
					pos = child;
				}
				ids[pos] = id;
				values[pos] = value;
			}
			return top;
		}
		/** Returns the item from the head of this queue without removing it. If this queue is empty, returns `undefined`. */
		peek() {
			return this.length > 0 ? this.ids[0] : void 0;
		}
		/**
		* Returns the priority value of the item at the head of this queue without
		* removing it. If this queue is empty, returns `undefined`.
		*/
		peekValue() {
			return this.length > 0 ? this.values[0] : void 0;
		}
		/**
		* Shrinks the internal arrays to `this.length`. No-op for queues with fixed capacity.
		*
		* `pop()` and `clear()` calls don't free memory automatically to avoid unnecessary resize operations.
		* This also means that items that have been added to the queue can't be garbage collected until
		* a new item is pushed in their place, or this method is called.
		*/
		shrink() {
			if (Array.isArray(this.ids)) this.ids.length = this.length;
			if (Array.isArray(this.values)) this.values.length = this.length;
		}
	};
	//#endregion
	//#region index.js
	const ARRAY_TYPES = [
		Int8Array,
		Uint8Array,
		Uint8ClampedArray,
		Int16Array,
		Uint16Array,
		Int32Array,
		Uint32Array,
		Float32Array,
		Float64Array
	];
	const VERSION = 3;
	/** @typedef {Int8ArrayConstructor | Uint8ArrayConstructor | Uint8ClampedArrayConstructor | Int16ArrayConstructor | Uint16ArrayConstructor | Int32ArrayConstructor | Uint32ArrayConstructor | Float32ArrayConstructor | Float64ArrayConstructor} TypedArrayConstructor */
	/** @typedef {Int8Array | Uint8Array | Uint8ClampedArray | Int16Array | Uint16Array | Int32Array | Uint32Array | Float32Array | Float64Array} TypedArray */
	var Flatbush = class Flatbush {
		/**
		* Recreate a Flatbush index from raw `ArrayBuffer` or `SharedArrayBuffer` data.
		* @param {ArrayBufferLike} data
		* @param {number} [byteOffset=0] byte offset to the start of the Flatbush buffer in the referenced ArrayBuffer.
		* @returns {Flatbush} index
		*/
		static from(data, byteOffset = 0) {
			if (byteOffset % 8 !== 0) throw new Error("byteOffset must be 8-byte aligned.");
			if (!data || data.byteLength === void 0 || "buffer" in data) throw new Error("Data must be an instance of ArrayBuffer or SharedArrayBuffer.");
			const [magic, versionAndType] = new Uint8Array(data, byteOffset + 0, 2);
			if (magic !== 251) throw new Error("Data does not appear to be in a Flatbush format.");
			const version = versionAndType >> 4;
			if (version !== VERSION) throw new Error(`Got v${version} data when expected v${VERSION}.`);
			const ArrayType = ARRAY_TYPES[versionAndType & 15];
			if (!ArrayType) throw new Error("Unrecognized array type.");
			const [nodeSize] = new Uint16Array(data, byteOffset + 2, 1);
			const [numItems] = new Uint32Array(data, byteOffset + 4, 1);
			return new Flatbush(numItems, nodeSize, ArrayType, void 0, data, byteOffset);
		}
		/**
		* Create a Flatbush index that will hold a given number of items.
		* @param {number} numItems
		* @param {number} [nodeSize=16] Size of the tree node (16 by default).
		* @param {TypedArrayConstructor} [ArrayType=Float64Array] The array type used for coordinates storage (`Float64Array` by default).
		* @param {ArrayBufferConstructor | SharedArrayBufferConstructor} [ArrayBufferType=ArrayBuffer] The array buffer type used to store data (`ArrayBuffer` by default).
		* @param {ArrayBufferLike} [data] (Only used internally)
		* @param {number} [byteOffset=0] (Only used internally)
		*/
		constructor(numItems, nodeSize = 16, ArrayType = Float64Array, ArrayBufferType = ArrayBuffer, data, byteOffset = 0) {
			if (numItems === void 0) throw new Error("Missing required argument: numItems.");
			if (isNaN(numItems) || numItems <= 0) throw new Error(`Unexpected numItems value: ${numItems}.`);
			this.numItems = +numItems;
			this.nodeSize = Math.min(Math.max(+nodeSize, 2), 65535);
			this.byteOffset = byteOffset;
			let n = numItems;
			let numNodes = n;
			this._levelBounds = [n * 4];
			do {
				n = Math.ceil(n / this.nodeSize);
				numNodes += n;
				this._levelBounds.push(numNodes * 4);
			} while (n !== 1);
			this.ArrayType = ArrayType;
			this.IndexArrayType = numNodes < 16384 ? Uint16Array : Uint32Array;
			const arrayTypeIndex = ARRAY_TYPES.indexOf(ArrayType);
			const nodesByteSize = numNodes * 4 * ArrayType.BYTES_PER_ELEMENT;
			if (arrayTypeIndex < 0) throw new Error(`Unexpected typed array class: ${ArrayType}.`);
			/** @type {new(b: ArrayBufferLike, o: number, l: number) => TypedArray} */
			const BoxCtor = ArrayType;
			/** @type {new(b: ArrayBufferLike, o: number, l: number) => Uint16Array | Uint32Array} */
			const IdxCtor = this.IndexArrayType;
			if (data) {
				this.data = data;
				this._boxes = new BoxCtor(data, byteOffset + 8, numNodes * 4);
				this._indices = new IdxCtor(data, byteOffset + 8 + nodesByteSize, numNodes);
				this._pos = numNodes * 4;
				this.minX = this._boxes[this._pos - 4];
				this.minY = this._boxes[this._pos - 3];
				this.maxX = this._boxes[this._pos - 2];
				this.maxY = this._boxes[this._pos - 1];
			} else {
				const data = this.data = new ArrayBufferType(8 + nodesByteSize + numNodes * this.IndexArrayType.BYTES_PER_ELEMENT);
				this._boxes = new BoxCtor(data, 8, numNodes * 4);
				this._indices = new IdxCtor(data, 8 + nodesByteSize, numNodes);
				this._pos = 0;
				this.minX = Infinity;
				this.minY = Infinity;
				this.maxX = -Infinity;
				this.maxY = -Infinity;
				new Uint8Array(data, 0, 2).set([251, (VERSION << 4) + arrayTypeIndex]);
				new Uint16Array(data, 2, 1)[0] = nodeSize;
				new Uint32Array(data, 4, 1)[0] = numItems;
			}
			/** @type FlatQueue<number> */
			this._queue = new FlatQueue();
		}
		/**
		* Add a given rectangle to the index.
		* @param {number} minX
		* @param {number} minY
		* @param {number} maxX
		* @param {number} maxY
		* @returns {number} A zero-based, incremental number that represents the newly added rectangle.
		*/
		add(minX, minY, maxX = minX, maxY = minY) {
			const pos = this._pos;
			const index = pos >> 2;
			const boxes = this._boxes;
			this._indices[index] = index;
			boxes[pos] = minX;
			boxes[pos + 1] = minY;
			boxes[pos + 2] = maxX;
			boxes[pos + 3] = maxY;
			this._pos = pos + 4;
			if (minX < this.minX) this.minX = minX;
			if (minY < this.minY) this.minY = minY;
			if (maxX > this.maxX) this.maxX = maxX;
			if (maxY > this.maxY) this.maxY = maxY;
			return index;
		}
		/** Perform indexing of the added rectangles. */
		finish() {
			if (this._pos >> 2 !== this.numItems) throw new Error(`Added ${this._pos >> 2} items when expected ${this.numItems}.`);
			const boxes = this._boxes;
			if (this.numItems <= this.nodeSize) {
				boxes[this._pos++] = this.minX;
				boxes[this._pos++] = this.minY;
				boxes[this._pos++] = this.maxX;
				boxes[this._pos++] = this.maxY;
				return;
			}
			const { numItems, minX, minY, nodeSize, _indices: indices, _levelBounds: levelBounds } = this;
			const width = this.maxX - minX || 1;
			const height = this.maxY - minY || 1;
			const hilbertValues = new Int32Array(numItems);
			const hilbertMax = 65535;
			const sx = hilbertMax / width;
			const sy = hilbertMax / height;
			for (let i = 0, pos = 0; i < numItems; i++) {
				const itemMinX = boxes[pos++];
				const itemMinY = boxes[pos++];
				const itemMaxX = boxes[pos++];
				const itemMaxY = boxes[pos++];
				hilbertValues[i] = hilbert(sx * ((itemMinX + itemMaxX) / 2 - minX) | 0, sy * ((itemMinY + itemMaxY) / 2 - minY) | 0);
			}
			sort(hilbertValues, boxes, indices, 0, numItems - 1, nodeSize);
			let pos = numItems * 4;
			for (let i = 0, readPos = 0; i < levelBounds.length - 1; i++) {
				const end = levelBounds[i];
				while (readPos < end) {
					const nodeIndex = readPos;
					let nodeMinX = boxes[readPos++];
					let nodeMinY = boxes[readPos++];
					let nodeMaxX = boxes[readPos++];
					let nodeMaxY = boxes[readPos++];
					for (let j = 1; j < nodeSize && readPos < end; j++) {
						nodeMinX = Math.min(nodeMinX, boxes[readPos++]);
						nodeMinY = Math.min(nodeMinY, boxes[readPos++]);
						nodeMaxX = Math.max(nodeMaxX, boxes[readPos++]);
						nodeMaxY = Math.max(nodeMaxY, boxes[readPos++]);
					}
					indices[pos >> 2] = nodeIndex;
					boxes[pos++] = nodeMinX;
					boxes[pos++] = nodeMinY;
					boxes[pos++] = nodeMaxX;
					boxes[pos++] = nodeMaxY;
				}
			}
			this._pos = pos;
		}
		/**
		* Search the index by a bounding box.
		* @param {number} minX
		* @param {number} minY
		* @param {number} maxX
		* @param {number} maxY
		* @param {(index: number, x0: number, y0: number, x1: number, y1: number) => boolean} [filterFn] An optional function that is called on every found item; if supplied, only items for which this function returns true will be included in the results array.
		* @returns {number[]} An array of indices of items intersecting or touching the given bounding box.
		*/
		search(minX, minY, maxX, maxY, filterFn) {
			if (this._pos !== this._boxes.length) throw new Error("Data not yet indexed - call index.finish().");
			const { _boxes: boxes, _levelBounds: levelBounds, _indices: indices, nodeSize } = this;
			const numItems4 = this.numItems * 4;
			/** @type number | undefined */
			let nodeIndex = boxes.length - 4;
			let level = levelBounds.length - 1;
			const q = [];
			const results = [];
			let contained = false;
			while (nodeIndex !== void 0) {
				const end = Math.min(nodeIndex + nodeSize * 4, levelBounds[level]);
				const isNode = nodeIndex >= numItems4;
				if (contained) this._collectContained(nodeIndex, end, level, numItems4, results, filterFn);
				else for (let pos = nodeIndex; pos < end; pos += 4) {
					const x0 = boxes[pos];
					if (maxX < x0) continue;
					const y0 = boxes[pos + 1];
					if (maxY < y0) continue;
					const x1 = boxes[pos + 2];
					if (minX > x1) continue;
					const y1 = boxes[pos + 3];
					if (minY > y1) continue;
					const index = indices[pos >> 2] | 0;
					if (isNode) {
						const c = +(minX <= x0 && minY <= y0 && maxX >= x1 && maxY >= y1);
						q.push(index | c, level - 1);
					} else if (filterFn === void 0 || filterFn(index, x0, y0, x1, y1)) results.push(index);
				}
				level = q.pop();
				nodeIndex = q.pop();
				if (nodeIndex !== void 0) {
					contained = (nodeIndex & 1) === 1;
					nodeIndex &= -2;
				}
			}
			return results;
		}
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
		_collectContained(nodeIndex, end, level, numItems4, results, filterFn) {
			const boxes = this._boxes;
			const indices = this._indices;
			let pos = nodeIndex;
			for (let l = level; l > 0; l--) pos = indices[pos >> 2];
			const leafEnd = Math.min(pos + (end - nodeIndex) * this.nodeSize ** level, numItems4);
			if (filterFn === void 0) for (; pos < leafEnd; pos += 4) results.push(indices[pos >> 2] | 0);
			else for (; pos < leafEnd; pos += 4) {
				const index = indices[pos >> 2] | 0;
				if (filterFn(index, boxes[pos], boxes[pos + 1], boxes[pos + 2], boxes[pos + 3])) results.push(index);
			}
		}
		/**
		* Search items in order of distance from the given point.
		* @param {number} x
		* @param {number} y
		* @param {number} [maxResults=Infinity]
		* @param {number} [maxDistance=Infinity]
		* @param {(index: number) => boolean} [filterFn] An optional function for filtering the results.
		* @returns {number[]} An array of indices of items found.
		*/
		neighbors(x, y, maxResults = Infinity, maxDistance = Infinity, filterFn) {
			if (this._pos !== this._boxes.length) throw new Error("Data not yet indexed - call index.finish().");
			const { _boxes: boxes, _levelBounds: levelBounds, _indices: indices, _queue: q, nodeSize } = this;
			const numItems4 = this.numItems * 4;
			const nodeSize4 = nodeSize * 4;
			const results = [];
			const maxDistSquared = maxDistance * maxDistance;
			const trackNearest = maxResults === 1;
			let bound = maxDistSquared;
			q.push(boxes.length - 4 << 1, 0);
			while (q.length) {
				const top = q.ids[0];
				if (top & 1) {
					q.pop();
					results.push(top >> 1);
					if (results.length === maxResults) break;
					continue;
				}
				q.pop();
				const nodeIndex = top >> 1;
				const isLeafLevel = nodeIndex < numItems4;
				const end = Math.min(nodeIndex + nodeSize4, upperBound(nodeIndex, levelBounds));
				for (let pos = nodeIndex; pos < end; pos += 4) {
					const minX = boxes[pos];
					const minY = boxes[pos + 1];
					const maxX = boxes[pos + 2];
					const maxY = boxes[pos + 3];
					const dx = Math.max(Math.max(minX - x, x - maxX), 0);
					const dy = Math.max(Math.max(minY - y, y - maxY), 0);
					const dist = dx * dx + dy * dy;
					if (dist > bound) continue;
					const childIndex = indices[pos >> 2] | 0;
					if (isLeafLevel) {
						if (filterFn === void 0 || filterFn(childIndex)) {
							q.push(childIndex << 1 | 1, dist);
							if (trackNearest && dist < bound) bound = dist;
						}
					} else q.push(childIndex << 1, dist);
				}
			}
			q.clear();
			return results;
		}
	};
	/**
	* Binary search for the first value in the array bigger than the given.
	* @param {number} value
	* @param {number[]} arr
	*/
	function upperBound(value, arr) {
		let i = 0;
		let j = arr.length - 1;
		while (i < j) {
			const m = i + j >> 1;
			if (arr[m] > value) j = m;
			else i = m + 1;
		}
		return arr[i];
	}
	/**
	* Custom quicksort that partially sorts bbox data alongside the hilbert values.
	* @param {Int32Array} values
	* @param {TypedArray} boxes
	* @param {Uint16Array | Uint32Array} indices
	* @param {number} left
	* @param {number} right
	* @param {number} nodeSize
	*/
	function sort(values, boxes, indices, left, right, nodeSize) {
		const stack = [left, right];
		while (stack.length) {
			const r = stack.pop() || 0;
			const l = stack.pop() || 0;
			if (r - l <= nodeSize && Math.floor(l / nodeSize) >= Math.floor(r / nodeSize)) continue;
			const a = values[l];
			const b = values[l + r >> 1];
			const c = values[r];
			const pivot = a > b !== a > c ? a : b < a !== b < c ? b : c;
			let i = l - 1;
			let j = r + 1;
			while (true) {
				do
					i++;
				while (values[i] < pivot);
				do
					j--;
				while (values[j] > pivot);
				if (i >= j) break;
				swap(values, boxes, indices, i, j);
			}
			stack.push(l, j, j + 1, r);
		}
	}
	/**
	* Swap two values and two corresponding boxes.
	* @param {Int32Array} values
	* @param {TypedArray} boxes
	* @param {Uint16Array | Uint32Array} indices
	* @param {number} i
	* @param {number} j
	*/
	function swap(values, boxes, indices, i, j) {
		const temp = values[i];
		values[i] = values[j];
		values[j] = temp;
		const k = 4 * i;
		const m = 4 * j;
		const a = boxes[k];
		const b = boxes[k + 1];
		const c = boxes[k + 2];
		const d = boxes[k + 3];
		boxes[k] = boxes[m];
		boxes[k + 1] = boxes[m + 1];
		boxes[k + 2] = boxes[m + 2];
		boxes[k + 3] = boxes[m + 3];
		boxes[m] = a;
		boxes[m + 1] = b;
		boxes[m + 2] = c;
		boxes[m + 3] = d;
		const e = indices[i];
		indices[i] = indices[j];
		indices[j] = e;
	}
	/**
	* Fast Hilbert curve algorithm by http://threadlocalmutex.com/
	* Ported from C++ https://github.com/rawrunprotected/hilbert_curves (public domain)
	* @param {number} x
	* @param {number} y
	*/
	function hilbert(x, y) {
		let a = x ^ y;
		let b = 65535 ^ a;
		let c = 65535 ^ (x | y);
		let d = x & (y ^ 65535);
		let A = a | b >> 1;
		let B = a >> 1 ^ a;
		let C = c ^ (c >> 1 ^ b & d >> 1);
		let D = d ^ (a & c >> 1 ^ d >> 1);
		a = A & A >> 2 ^ B & B >> 2;
		b = A & B >> 2 ^ B & (A ^ B) >> 2;
		c = C ^ (A & C >> 2 ^ B & D >> 2);
		d = D ^ (B & C >> 2 ^ (A ^ B) & D >> 2);
		A = a & a >> 4 ^ b & b >> 4;
		B = a & b >> 4 ^ b & (a ^ b) >> 4;
		C = c ^ (a & c >> 4 ^ b & d >> 4);
		D = d ^ (b & c >> 4 ^ (a ^ b) & d >> 4);
		c = C ^ (A & C >> 8 ^ B & D >> 8);
		d = D ^ (B & C >> 8 ^ (A ^ B) & D >> 8);
		c ^= c >> 1;
		d ^= d >> 1;
		a = x ^ y;
		b = d | 65535 ^ (a | c);
		a = (a | a << 8) & 16711935;
		a = (a | a << 4) & 252645135;
		a = (a | a << 2) & 858993459;
		a = (a | a << 1) & 1431655765;
		b = (b | b << 8) & 16711935;
		b = (b | b << 4) & 252645135;
		b = (b | b << 2) & 858993459;
		b = (b | b << 1) & 1431655765;
		return ((b << 1 | a) >>> 0) - 2147483648;
	}
	//#endregion
	return Flatbush;
});
