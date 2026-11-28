import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { Bounds } from "./types"

export const includeHorizontalConstraintMismatches = ({
  labelIndices,
  include,
  outputNetLabelPlacements,
  getHorizontalConstraintMismatchBounds,
}: {
  labelIndices: readonly number[]
  include: boolean
  outputNetLabelPlacements: readonly NetLabelPlacement[]
  getHorizontalConstraintMismatchBounds: (
    label: NetLabelPlacement,
  ) => Bounds | null
}): number[] => {
  if (!include) return [...labelIndices].sort((a, b) => a - b)

  const result = new Set(labelIndices)
  for (let index = 0; index < outputNetLabelPlacements.length; index++) {
    const placement = outputNetLabelPlacements[index]
    if (placement && getHorizontalConstraintMismatchBounds(placement)) {
      result.add(index)
    }
  }
  return [...result].sort((a, b) => a - b)
}
