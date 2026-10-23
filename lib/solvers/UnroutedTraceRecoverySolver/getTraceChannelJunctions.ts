import type { Point } from "@tscircuit/math-utils"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import {
  isHorizontal,
  isVertical,
} from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import type { ObstacleRect } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect"

export const getTraceChannelJunctions = ({
  sameNetTraces,
  obstacles,
  clearance,
}: {
  sameNetTraces: SolvedTracePath[]
  obstacles: ObstacleRect[]
  clearance: number
}): Point[] => {
  const verticalChannels = new Set(
    obstacles.flatMap((obstacle) => [
      obstacle.minX - clearance,
      obstacle.maxX + clearance,
    ]),
  )
  const horizontalChannels = new Set(
    obstacles.flatMap((obstacle) => [
      obstacle.minY - clearance,
      obstacle.maxY + clearance,
    ]),
  )
  const junctionPoints: Point[] = []
  for (const trace of sameNetTraces) {
    for (let index = 0; index < trace.tracePath.length - 1; index++) {
      const start = trace.tracePath[index]!
      const end = trace.tracePath[index + 1]!
      if (isHorizontal(start, end)) {
        for (const x of verticalChannels) {
          if (x > Math.min(start.x, end.x) && x < Math.max(start.x, end.x)) {
            junctionPoints.push({ x, y: start.y })
          }
        }
      } else if (isVertical(start, end)) {
        for (const y of horizontalChannels) {
          if (y > Math.min(start.y, end.y) && y < Math.max(start.y, end.y)) {
            junctionPoints.push({ x: start.x, y })
          }
        }
      }
    }
  }
  return junctionPoints
}
