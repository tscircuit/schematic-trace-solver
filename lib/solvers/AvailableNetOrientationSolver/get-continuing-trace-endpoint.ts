import type { Point } from "@tscircuit/math-utils"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { dir } from "lib/utils/dir"
import { EPS } from "./constants"

export const getContinuingTraceEndpoint = ({
  label,
  orientation,
  traceMap,
}: {
  label: NetLabelPlacement
  orientation: "y+" | "y-"
  traceMap: Readonly<Record<string, SolvedTracePath>>
}): Point | null => {
  const direction = dir(orientation)
  let bestEndpoint: Point | null = null

  for (const trace of Object.values(traceMap)) {
    if (trace.globalConnNetId !== label.globalConnNetId) continue
    const path = trace.tracePath
    for (let pointIndex = 0; pointIndex < path.length; pointIndex++) {
      const point = path[pointIndex]
      if (
        !point ||
        Math.abs(point.x - label.anchorPoint.x) > EPS ||
        Math.abs(point.y - label.anchorPoint.y) > EPS
      ) {
        continue
      }
      for (const neighbor of [path[pointIndex - 1], path[pointIndex + 1]]) {
        if (
          neighbor &&
          Math.abs(neighbor.x - point.x) <= EPS &&
          (neighbor.y - point.y) * direction.y > EPS &&
          (!bestEndpoint || (neighbor.y - bestEndpoint.y) * direction.y > EPS)
        ) {
          bestEndpoint = neighbor
        }
      }
    }
  }

  return bestEndpoint
}
