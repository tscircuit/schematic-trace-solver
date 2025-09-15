import type { Point } from "graphics-debug"
import type { InputProblem } from "lib/types/InputProblem"
import type { NetLabelPlacement } from "../NetLabelPlacementSolver/NetLabelPlacementSolver"
import { getObstacleRects } from "../SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { segmentIntersectsRect } from "../SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import { simplifyPath } from "./pathUtils"

export const balanceLShapes = (
  traces: SolvedTracePath[],
  problem: InputProblem,
  allLabelPlacements: NetLabelPlacement[],
): SolvedTracePath[] | null => {
  const TOLERANCE = 1e-5
  let changesMade = false

  const obstacles = getObstacleRects(problem).map((obs) => ({
    ...obs,
    minX: obs.minX + TOLERANCE,
    maxX: obs.maxX - TOLERANCE,
    minY: obs.minY + TOLERANCE,
    maxY: obs.maxY - TOLERANCE,
  }))

  const segmentIntersectsAnyRect = (
    p1: Point,
    p2: Point,
    rects: any[],
  ): boolean => {
    for (const rect of rects) {
      if (segmentIntersectsRect(p1, p2, rect)) {
        return true
      }
    }
    return false
  }

  const getLabelBounds = (labels: NetLabelPlacement[], traceNetId: string) => {
    const filteredLabels = labels.filter(
      (label) => label.globalConnNetId !== traceNetId,
    )

    return filteredLabels.map((nl) => ({
      minX: nl.center.x - nl.width / 2 + TOLERANCE,
      maxX: nl.center.x + nl.width / 2 - TOLERANCE,
      minY: nl.center.y - nl.height / 2 + TOLERANCE,
      maxY: nl.center.y + nl.height / 2 - TOLERANCE,
    }))
  }

  const newTraces = traces.map((trace) => {
    const newPath = [...trace.tracePath]

    if (newPath.length < 6) {
      return { ...trace }
    }

    const labelBounds = getLabelBounds(
      allLabelPlacements,
      trace.globalConnNetId,
    )

    for (let i = 1; i < newPath.length - 4; i++) {
      const p1 = newPath[i]
      const p2 = newPath[i + 1]
      const p3 = newPath[i + 2]
      const p4 = newPath[i + 3]

      const is_H_V_H_Z_shape = p1.y === p2.y && p2.x === p3.x && p3.y === p4.y
      const is_V_H_V_Z_shape = p1.x === p2.x && p2.y === p3.y && p3.x === p4.x

      if (!is_H_V_H_Z_shape && !is_V_H_V_Z_shape) {
        continue
      }

      let p2_new: Point, p3_new: Point
      const len1_original = is_H_V_H_Z_shape
        ? Math.abs(p1.x - p2.x)
        : Math.abs(p1.y - p2.y)
      const len2_original = is_H_V_H_Z_shape
        ? Math.abs(p3.x - p4.x)
        : Math.abs(p3.y - p4.y)

      if (Math.abs(len1_original - len2_original) < 0.001) {
        continue
      }

      if (is_H_V_H_Z_shape) {
        const ideal_x = (p1.x + p4.x) / 2
        p2_new = { x: ideal_x, y: p2.y }
        p3_new = { x: ideal_x, y: p3.y }
      } else {
        const ideal_y = (p1.y + p4.y) / 2
        p2_new = { x: p2.x, y: ideal_y }
        p3_new = { x: p3.x, y: ideal_y }
      }

      const collides =
        segmentIntersectsAnyRect(p1, p2_new, obstacles) ||
        segmentIntersectsAnyRect(p2_new, p3_new, obstacles) ||
        segmentIntersectsAnyRect(p3_new, p4, obstacles) ||
        segmentIntersectsAnyRect(p1, p2_new, labelBounds) ||
        segmentIntersectsAnyRect(p2_new, p3_new, labelBounds) ||
        segmentIntersectsAnyRect(p3_new, p4, labelBounds)

      if (!collides) {
        newPath[i + 1] = p2_new
        newPath[i + 2] = p3_new
        changesMade = true
        i = 0
      }
    }

    const finalSimplifiedPath = simplifyPath(newPath)

    return {
      ...trace,
      tracePath: finalSimplifiedPath,
    }
  })

  if (changesMade) {
    return newTraces
  } else {
    return null
  }
}
