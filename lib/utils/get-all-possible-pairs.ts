/**
 * Generates all unique pairs from an array of items.
 * For an input of [A, B, C], it will produce [[A, B], [A, C], [B, C]].
 */
export function getAllPossiblePairs<T>(arr: T[]): Array<[T, T]> {
  const pairs: Array<[T, T]> = []
  for (let i = 0; i < arr.length; i++) {
    for (let j = i + 1; j < arr.length; j++) {
      pairs.push([arr[i], arr[j]])
    }
  }
  return pairs
}
