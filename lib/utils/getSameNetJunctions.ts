import { getSegmentIntersection } from "@tscircuit/math-utils/line-intersections"
import { tracePathContainsPoint } from "lib/solvers/RailNetLabelCornerPlacementSolver/geometry"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

export const getSameNetJunctions = (
  trace: SolvedTracePath,
  traces: SolvedTracePath[],
) =>
  traces
    .filter(
      (other) =>
        other.mspPairId !== trace.mspPairId &&
        other.globalConnNetId === trace.globalConnNetId,
    )
    .flatMap((other) => [
      ...other.tracePath.filter((point) =>
        tracePathContainsPoint(trace.tracePath, point),
      ),
      ...trace.tracePath.slice(1).flatMap((end, index) =>
        other.tracePath.slice(1).flatMap((otherEnd, otherIndex) => {
          const junction = getSegmentIntersection(
            trace.tracePath[index]!,
            end,
            other.tracePath[otherIndex]!,
            otherEnd,
          )
          return junction ? [junction] : []
        }),
      ),
    ])
