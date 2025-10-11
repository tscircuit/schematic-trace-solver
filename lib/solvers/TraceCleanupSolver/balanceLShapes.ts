import type { Point } from "graphics-debug"
import type { InputProblem } from "lib/types/InputProblem"
import type { NetLabelPlacement } from "../NetLabelPlacementSolver/NetLabelPlacementSolver"
import { getObstacleRects } from "../SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { segmentIntersectsRect } from "../SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import { simplifyPath } from "./simplifyPath"

export const balanceLShapes = ({
  traces,
  problem,
  allLabelPlacements,
}: {
  traces: SolvedTracePath[]
  problem: InputProblem
  allLabelPlacements: NetLabelPlacement[]
}): SolvedTracePath[] | null => {
  const TOLERANCE = 1e-5
  let changesMade = false

  for (const trace of traces) {
    if (trace.tracePath.length === 4) {
      const [p0, p1, p2, p3] = trace.tracePath
      const isHVHShape = p0.y === p1.y && p1.x === p2.x && p2.y === p3.y
      const isVHVShape = p0.x === p1.x && p1.y === p2.y && p2.x === p3.x

      const isCollinearHorizontal =
        p0.y === p1.y && p1.y === p2.y && p2.y === p3.y
      const isCollinearVertical =
        p0.x === p1.x && p1.x === p2.x && p2.x === p3.x
      const isCollinear = isCollinearHorizontal || isCollinearVertical

      let isSameDirection = false
      if (isHVHShape) {
        isSameDirection = Math.sign(p1.x - p0.x) === Math.sign(p3.x - p2.x)
      } else if (isVHVShape) {
        isSameDirection = Math.sign(p1.y - p0.y) === Math.sign(p3.y - p2.y)
      }

      const isValidZShape =
        (isHVHShape || isVHVShape) && !isCollinear && isSameDirection

      if (!isValidZShape) {
        return null
      }
    }
  }

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
    let newPath = [...trace.tracePath]

    if (newPath.length < 4) {
      return { ...trace }
    }

    const labelBounds = getLabelBounds(
      allLabelPlacements,
      trace.globalConnNetId,
    )

    if (newPath.length === 4) {
      const [p0, p1, p2, p3] = newPath
      let p1New: Point, p2New: Point

      const isHVHShape = p0.y === p1.y && p1.x === p2.x && p2.y === p3.y

      if (isHVHShape) {
        const idealX = (p0.x + p3.x) / 2
        p1New = { x: idealX, y: p1.y }
        p2New = { x: idealX, y: p2.y }
      } else {
        const idealY = (p0.y + p3.y) / 2
        p1New = { x: p1.x, y: idealY }
        p2New = { x: p2.x, y: idealY }
      }

      const collides =
        segmentIntersectsAnyRect(p0, p1New, obstacles) ||
        segmentIntersectsAnyRect(p1New, p2New, obstacles) ||
        segmentIntersectsAnyRect(p2New, p3, obstacles) ||
        segmentIntersectsAnyRect(p0, p1New, labelBounds) ||
        segmentIntersectsAnyRect(p1New, p2New, labelBounds) ||
        segmentIntersectsAnyRect(p2New, p3, labelBounds)

      if (!collides) {
        newPath[1] = p1New
        newPath[2] = p2New
        changesMade = true
      }

      return { ...trace, tracePath: simplifyPath(newPath) }
    }

    for (let i = 1; i < newPath.length - 4; i++) {
      const p1 = newPath[i]
      const p2 = newPath[i + 1]
      const p3 = newPath[i + 2]
      const p4 = newPath[i + 3]

      const isHVHZShape = p1.y === p2.y && p2.x === p3.x && p3.y === p4.y
      const isVHVZShape = p1.x === p2.x && p2.y === p3.y && p3.x === p4.x

      const isCollinearHorizontal =
        p1.y === p2.y && p2.y === p3.y && p3.y === p4.y
      const isCollinearVertical =
        p1.x === p2.x && p2.x === p3.x && p3.x === p4.x
      const isCollinear = isCollinearHorizontal || isCollinearVertical

      let isSameDirection = false
      if (isHVHZShape) {
        isSameDirection = Math.sign(p2.x - p1.x) === Math.sign(p4.x - p3.x)
      } else if (isVHVZShape) {
        isSameDirection = Math.sign(p2.y - p1.y) === Math.sign(p4.y - p3.y)
      }

      const isValidZShape =
        (isHVHZShape || isVHVZShape) && !isCollinear && isSameDirection

      if (!isValidZShape) {
        continue
      }

      let p2New: Point, p3New: Point
      const len1Original = isHVHZShape
        ? Math.abs(p1.x - p2.x)
        : Math.abs(p1.y - p2.y)
      const len2Original = isHVHZShape
        ? Math.abs(p3.x - p4.x)
        : Math.abs(p3.y - p4.y)

      if (Math.abs(len1Original - len2Original) < 0.001) {
        continue
      }

      if (isHVHZShape) {
        const idealX = (p1.x + p4.x) / 2
        p2New = { x: idealX, y: p2.y }
        p3New = { x: idealX, y: p3.y }
      } else {
        const idealY = (p1.y + p4.y) / 2
        p2New = { x: p2.x, y: idealY }
        p3New = { x: p3.x, y: idealY }
      }

      const collides =
        segmentIntersectsAnyRect(p1, p2New, obstacles) ||
        segmentIntersectsAnyRect(p2New, p3New, obstacles) ||
        segmentIntersectsAnyRect(p3New, p4, obstacles) ||
        segmentIntersectsAnyRect(p1, p2New, labelBounds) ||
        segmentIntersectsAnyRect(p2New, p3New, labelBounds) ||
        segmentIntersectsAnyRect(p3New, p4, labelBounds)

      if (!collides) {
        newPath[i + 1] = p2New
        newPath[i + 2] = p3New
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
