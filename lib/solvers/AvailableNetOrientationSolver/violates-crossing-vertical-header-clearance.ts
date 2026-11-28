import { EPS } from "./constants"
import type { Bounds, CrossingVerticalHeaderPair } from "./types"

export const violatesCrossingVerticalHeaderClearance = ({
  bounds,
  labelIndex,
  queuedLabelIndices,
  pairs,
  labelTraceClearance,
}: {
  bounds: Bounds
  labelIndex: number
  queuedLabelIndices: number[]
  pairs: CrossingVerticalHeaderPair[]
  labelTraceClearance: number
}) => {
  for (const pair of pairs) {
    if (
      labelIndex === pair.lowerIdx &&
      queuedLabelIndices.includes(pair.upperIdx) &&
      bounds.minY < pair.upperY + labelTraceClearance - EPS &&
      bounds.maxY > pair.upperY - labelTraceClearance + EPS
    ) {
      return true
    }
  }
  return false
}
