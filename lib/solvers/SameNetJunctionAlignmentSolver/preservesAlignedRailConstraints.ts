import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import {
  getRailOrientation,
  nearlyEqual,
} from "lib/solvers/TraceCleanupSolver/sameNetRailAlignment/geometry"
import type { AlignedRailConstraint } from "lib/solvers/TraceCleanupSolver/sameNetRailAlignment/types"

export const preservesAlignedRailConstraints = ({
  candidateTrace,
  alignedRailConstraints,
}: {
  candidateTrace: SolvedTracePath
  alignedRailConstraints: AlignedRailConstraint[]
}) =>
  alignedRailConstraints.every((constraint) => {
    if (constraint.traceId !== candidateTrace.mspPairId) return true
    return candidateTrace.tracePath.slice(0, -1).some((start, pointIndex) => {
      const end = candidateTrace.tracePath[pointIndex + 1]!
      if (getRailOrientation(start, end) !== constraint.orientation) {
        return false
      }
      let coordinate = start.x
      if (constraint.orientation === "horizontal") coordinate = start.y
      return nearlyEqual(coordinate, constraint.coordinate)
    })
  })
