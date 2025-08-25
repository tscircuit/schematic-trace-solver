import type { InputChip, InputProblem } from "lib/types/InputProblem"

/**
 * Creates a generator function that yields all possible pairs of chips from the given array.
 * Each pair consists of two different chips (a chip is never paired with itself).
 *
 * @param chips - Array of chips to generate pairs from
 * @returns A generator function that yields [chip, otherChip] tuples
 *
 * @example
 * ```typescript
 * const chips = [chip1, chip2, chip3];
 * const pairGenerator = getGeneratorForAllChipPairs(chips);
 *
 * for (const [chip, otherChip] of pairGenerator()) {
 *   console.log(`Pair: ${chip.id} -> ${otherChip.id}`);
 * }
 * // Output:
 * // Pair: chip1 -> chip2
 * // Pair: chip1 -> chip3
 * // Pair: chip2 -> chip1
 * // Pair: chip2 -> chip3
 * // Pair: chip3 -> chip1
 * // Pair: chip3 -> chip2
 * ```
 */
export const getGeneratorForAllChipPairs = (
  chips: InputChip[],
): Generator<readonly [InputChip, InputChip]> => {
  return (function* () {
    for (let i = 0; i < chips.length; i++) {
      for (let j = 0; j < chips.length; j++) {
        if (i !== j) {
          yield [chips[i], chips[j]] as const
        }
      }
    }
  })()
}
