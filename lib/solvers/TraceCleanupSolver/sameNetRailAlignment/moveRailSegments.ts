import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { simplifyPath } from "../simplifyPath"
import type { RailSegment } from "./types"

export const moveRailSegments = (
  trace: SolvedTracePath,
  segments: RailSegment[],
  coordinate: number,
): SolvedTracePath => {
  const pointsToMove = new Set<number>()
  for (const segment of segments) {
    pointsToMove.add(segment.segmentIndex)
    pointsToMove.add(segment.segmentIndex + 1)
  }

  const orientation = segments[0]!.orientation
  const tracePath = simplifyPath(
    trace.tracePath.map((point, index) => {
      if (!pointsToMove.has(index)) return point
      return orientation === "vertical"
        ? { ...point, x: coordinate }
        : { ...point, y: coordinate }
    }),
  )

  return { ...trace, tracePath }
}
