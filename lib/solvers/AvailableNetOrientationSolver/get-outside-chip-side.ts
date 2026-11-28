import type { Point } from "@tscircuit/math-utils"
import type { ChipObstacleSpatialIndex } from "lib/data-structures/ChipObstacleSpatialIndex"
import { EPS } from "./constants"
import type { ChipSide } from "./types"

export const getOutsideChipSide = (
  point: Point,
  chipObstacleSpatialIndex: ChipObstacleSpatialIndex,
): ChipSide | null => {
  let nearestSide: ChipSide | null = null
  let nearestDistanceSq = Number.POSITIVE_INFINITY

  for (const chip of chipObstacleSpatialIndex.chips) {
    const bounds = chip.bounds
    const dx =
      point.x < bounds.minX - EPS
        ? bounds.minX - point.x
        : point.x > bounds.maxX + EPS
          ? point.x - bounds.maxX
          : 0
    const dy =
      point.y < bounds.minY - EPS
        ? bounds.minY - point.y
        : point.y > bounds.maxY + EPS
          ? point.y - bounds.maxY
          : 0

    if (dx === 0 && dy === 0) continue

    const distanceSq = dx ** 2 + dy ** 2
    if (distanceSq >= nearestDistanceSq) continue

    nearestDistanceSq = distanceSq
    if (dx > 0) {
      nearestSide = point.x < bounds.minX ? "left" : "right"
    } else {
      nearestSide = point.y < bounds.minY ? "bottom" : "top"
    }
  }

  return nearestSide
}
