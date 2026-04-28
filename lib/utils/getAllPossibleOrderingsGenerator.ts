/**
 * Lazily generates **all permutations** (orderings) of the given array.
 *
 * This is a generator: it yields one permutation at a time without allocating
 * the full result set up front, which is helpful because there are `n!`
 * permutations for `n` items.
 *
 * - The input array is **not mutated**.
 * - If `items` contains duplicates, duplicate permutations will be yielded.
 * - For an empty array, it yields a single empty permutation `[]`.
 *
 * @typeParam T - Element type.
 * @param items - The array whose permutations to generate.
 * @yields A new array representing one permutation of `items`.
 *
 * @example
 * for (const perm of getAllPossibleOrderingsGenerator([1, 2, 3])) {
 *   console.log(perm);
 *   // -> [1, 2, 3]
 *   // -> [1, 3, 2]
 *   // -> [2, 1, 3]
 *   // -> [2, 3, 1]
 *   // -> [3, 1, 2]
 *   // -> [3, 2, 1]
 * }
 *
 * @remarks
 * Complexity:
 * - Time: Θ(n!) permutations, each of length n.
 * - Additional space: O(n) for recursion + the arrays yielded.
 */
export function* getAllPossibleOrderingsGenerator<T>(
  items: T[],
): Generator<T[], void, void> {
  if (items.length === 0) {
    yield []
    return
  }

  for (let i = 0; i < items.length; i++) {
    const head = items[i]
    const rest = items.slice(0, i).concat(items.slice(i + 1))
    for (const tail of getAllPossibleOrderingsGenerator(rest)) {
      yield [head, ...tail]
    }
  }
}
