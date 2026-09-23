import type { Point } from "@tscircuit/math-utils"
import { tracePathContainsPoint } from "lib/solvers/RailNetLabelCornerPlacementSolver/geometry"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { simplifyPath } from "../simplifyPath"
import { getRailOrientation } from "./geometry"
import type { RailSegment } from "./types"

export const hasLabelOnAdjacentInteriorLeg = (
  segment: RailSegment,
  trace: SolvedTracePath,
  anchorPoint: Point,
) => {
  // Follow each end away from the rail. Collinear subdivisions do not
  // change whether the adjoining leg ends at a bend or at a pin.
  const pathsFromRailEnds = [
    trace.tracePath.slice(0, segment.segmentIndex + 1).reverse(),
    trace.tracePath.slice(segment.segmentIndex + 1),
  ]
  return pathsFromRailEnds.some((path) => {
    const [railEnd, bend, next] = simplifyPath(path)
    if (!railEnd || !bend || !next) return false

    const legOrientation = getRailOrientation(railEnd, bend)
    return (
      legOrientation !== null &&
      legOrientation !== segment.orientation &&
      getRailOrientation(bend, next) === segment.orientation &&
      tracePathContainsPoint([railEnd, bend], anchorPoint)
    )
  })
}
