import type { ChipObstacleSpatialIndex } from "lib/data-structures/ChipObstacleSpatialIndex"
import { EPS, WICK_CLEARANCE } from "./constants"
import { rangesOverlap } from "./geometry"
import type { Bounds } from "./types"

export const sharesChipBoundary = ({
  bounds,
  chipObstacleSpatialIndex,
}: {
  bounds: Bounds
  chipObstacleSpatialIndex: ChipObstacleSpatialIndex
}) => {
  const boundarySearchBounds = {
    minX: bounds.minX - WICK_CLEARANCE - EPS,
    minY: bounds.minY - WICK_CLEARANCE - EPS,
    maxX: bounds.maxX + WICK_CLEARANCE + EPS,
    maxY: bounds.maxY + WICK_CLEARANCE + EPS,
  }
  const nearbyChips =
    chipObstacleSpatialIndex.getChipsInBounds(boundarySearchBounds)

  for (const chip of nearbyChips) {
    const chipBounds = chip.bounds
    const adjacentToVerticalSide =
      Math.abs(bounds.minX - chipBounds.maxX) <= WICK_CLEARANCE + EPS ||
      Math.abs(bounds.maxX - chipBounds.minX) <= WICK_CLEARANCE + EPS
    const adjacentToHorizontalSide =
      Math.abs(bounds.minY - chipBounds.maxY) <= WICK_CLEARANCE + EPS ||
      Math.abs(bounds.maxY - chipBounds.minY) <= WICK_CLEARANCE + EPS

    if (
      adjacentToVerticalSide &&
      rangesOverlap(bounds.minY, bounds.maxY, chipBounds.minY, chipBounds.maxY)
    ) {
      return true
    }
    if (
      adjacentToHorizontalSide &&
      rangesOverlap(bounds.minX, bounds.maxX, chipBounds.minX, chipBounds.maxX)
    ) {
      return true
    }
  }

  return false
}
