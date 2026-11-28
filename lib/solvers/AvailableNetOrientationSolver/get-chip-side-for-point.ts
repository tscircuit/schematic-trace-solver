import type { Point } from "@tscircuit/math-utils"
import type { ChipObstacleSpatialIndex } from "lib/data-structures/ChipObstacleSpatialIndex"
import { EPS } from "./constants"
import { getContainingChipSide } from "./get-containing-chip-side"
import type { ChipSide } from "./types"

export const getChipSideForPoint = ({
  point,
  chips,
}: {
  point: Point
  chips: ChipObstacleSpatialIndex["chips"]
}): ChipSide | null => {
  const containingSide = getContainingChipSide({ point, chips })
  if (containingSide) return containingSide

  let outsideSide: ChipSide | null = null
  let outsideDistanceSq = Number.POSITIVE_INFINITY
  for (const chip of chips) {
    const { bounds } = chip
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
    if (distanceSq >= outsideDistanceSq) continue

    outsideDistanceSq = distanceSq
    outsideSide =
      dx > 0
        ? point.x < bounds.minX
          ? "left"
          : "right"
        : point.y < bounds.minY
          ? "bottom"
          : "top"
  }
  if (outsideSide) return outsideSide

  let nearestSide: ChipSide | null = null
  let nearestDistance = Number.POSITIVE_INFINITY
  for (const chip of chips) {
    const { bounds } = chip
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
