import type { Point } from "@tscircuit/math-utils"
import { getSideDistances } from "./geometry"
import type { Bounds, ChipSide } from "./types"

export const getNearestChipSide = (
  point: Point,
  chips: readonly { bounds: Bounds }[],
): ChipSide | null => {
  let nearestSide: ChipSide | null = null
  let nearestDistance = Number.POSITIVE_INFINITY

  for (const chip of chips) {
    for (const [side, distance] of getSideDistances(point, chip.bounds)) {
      if (distance < nearestDistance) {
        nearestSide = side
        nearestDistance = distance
      }
    }
  }

  return nearestSide
}
