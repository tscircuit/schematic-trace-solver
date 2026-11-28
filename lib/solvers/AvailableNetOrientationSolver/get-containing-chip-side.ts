import type { Point } from "@tscircuit/math-utils"
import type { ChipObstacleSpatialIndex } from "lib/data-structures/ChipObstacleSpatialIndex"
import { EPS } from "./constants"
import type { ChipSide } from "./types"

export const getContainingChipSide = ({
  point,
  chips,
}: {
  point: Point
  chips: ChipObstacleSpatialIndex["chips"]
}): ChipSide | null => {
  let nearestSide: ChipSide | null = null
  let nearestDistance = Number.POSITIVE_INFINITY

  for (const chip of chips) {
    const { bounds } = chip
    if (
      point.x < bounds.minX - EPS ||
      point.x > bounds.maxX + EPS ||
      point.y < bounds.minY - EPS ||
      point.y > bounds.maxY + EPS
    ) {
      continue
    }
    const sideDistances: readonly [ChipSide, number][] = [
      ["left", Math.abs(point.x - bounds.minX)],
      ["right", Math.abs(point.x - bounds.maxX)],
      ["bottom", Math.abs(point.y - bounds.minY)],
      ["top", Math.abs(point.y - bounds.maxY)],
    ]
    for (const [side, distance] of sideDistances) {
      if (distance < nearestDistance) {
        nearestSide = side
        nearestDistance = distance
      }
    }
  }

  return nearestSide
}
