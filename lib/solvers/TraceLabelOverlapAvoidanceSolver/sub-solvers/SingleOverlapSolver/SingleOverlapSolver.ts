import type { Point } from "@tscircuit/math-utils"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { NetLabelPlacement } from "../../../NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { InputProblem } from "lib/types/InputProblem"
import type { GraphicsObject } from "graphics-debug"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { isPathCollidingWithObstacles } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import { getObstacleRects } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect"
import { visualizeInputProblem } from "lib/solvers/SchematicTracePipelineSolver/visualizeInputProblem"
import { generateRerouteCandidates } from "../../rerouteCollidingTrace"
import { simplifyPath } from "lib/solvers/TraceCleanupSolver/simplifyPath"

interface SingleOverlapSolverInput {
  trace: SolvedTracePath
  label: NetLabelPlacement
  problem: InputProblem
  paddingBuffer: number
  detourCount: number
  otherTraces?: SolvedTracePath[]
}

const MAX_TRIES = 5

const EPSILON = 1e-9

const isSamePoint = (a: Point, b: Point) =>
  Math.abs(a.x - b.x) < EPSILON && Math.abs(a.y - b.y) < EPSILON

const orientation = (a: Point, b: Point, c: Point) => {
  const value = (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y)
  if (Math.abs(value) < EPSILON) return 0
  return value > 0 ? 1 : 2
}

const isPointOnSegment = (a: Point, b: Point, c: Point) =>
  b.x <= Math.max(a.x, c.x) + EPSILON &&
  b.x + EPSILON >= Math.min(a.x, c.x) &&
  b.y <= Math.max(a.y, c.y) + EPSILON &&
  b.y + EPSILON >= Math.min(a.y, c.y)

const segmentsIntersect = (a1: Point, a2: Point, b1: Point, b2: Point) => {
  if (
    isSamePoint(a1, b1) ||
    isSamePoint(a1, b2) ||
    isSamePoint(a2, b1) ||
    isSamePoint(a2, b2)
  ) {
    return false
  }

  const o1 = orientation(a1, a2, b1)
  const o2 = orientation(a1, a2, b2)
  const o3 = orientation(b1, b2, a1)
  const o4 = orientation(b1, b2, a2)

  if (o1 !== o2 && o3 !== o4) return true

  return (
    (o1 === 0 && isPointOnSegment(a1, b1, a2)) ||
    (o2 === 0 && isPointOnSegment(a1, b2, a2)) ||
    (o3 === 0 && isPointOnSegment(b1, a1, b2)) ||
    (o4 === 0 && isPointOnSegment(b1, a2, b2))
  )
}

const countTraceCrossings = (
  candidatePath: Point[],
  otherTraces: SolvedTracePath[],
) => {
  let crossings = 0
  for (let i = 0; i < candidatePath.length - 1; i++) {
    for (const otherTrace of otherTraces) {
      for (let j = 0; j < otherTrace.tracePath.length - 1; j++) {
        if (
          segmentsIntersect(
            candidatePath[i],
            candidatePath[i + 1],
            otherTrace.tracePath[j],
            otherTrace.tracePath[j + 1],
          )
        ) {
          crossings++
        }
      }
    }
  }
  return crossings
}

/**
 * This solver attempts to find a valid rerouting for a single trace that is
 * overlapping with a net label. It tries various candidate paths until it
 * finds one that does not introduce new collisions.
 */
export class SingleOverlapSolver extends BaseSolver {
  queuedCandidatePaths: Point[][]
  solvedTracePath: Point[] | null = null
  initialTrace: SolvedTracePath
  problem: InputProblem
  obstacles: ReturnType<typeof getObstacleRects>
  label: NetLabelPlacement
  _tried: number = 0

  constructor(solverInput: SingleOverlapSolverInput) {
    super()
    this.initialTrace = solverInput.trace
    this.problem = solverInput.problem
    this.label = solverInput.label

    // Calculate an effective padding for this specific run based on the detourCount.
    const effectivePadding =
      solverInput.paddingBuffer +
      solverInput.detourCount * solverInput.paddingBuffer

    const candidates = generateRerouteCandidates({
      ...solverInput,
      paddingBuffer: effectivePadding, // Use the calculated, larger padding
    })

    const getPathLength = (pts: Point[]) => {
      let len = 0
      for (let i = 0; i < pts.length - 1; i++) {
        const dx = pts[i + 1].x - pts[i].x
        const dy = pts[i + 1].y - pts[i].y
        len += Math.sqrt(dx * dx + dy * dy)
      }
      return len
    }

    const otherTraces = solverInput.otherTraces ?? []
    this.queuedCandidatePaths = candidates.sort((a, b) => {
      const crossingDelta =
        countTraceCrossings(a, otherTraces) -
        countTraceCrossings(b, otherTraces)
      if (crossingDelta !== 0) return crossingDelta
      return getPathLength(a) - getPathLength(b)
    })
    this.obstacles = getObstacleRects(this.problem)
  }

  override _step() {
    // Failure conditions: no more candidates or exceeded max tries
    if (this.queuedCandidatePaths.length === 0 || this._tried >= MAX_TRIES) {
      this.failed = true
      return
    }

    this._tried++
    const nextCandidatePath = this.queuedCandidatePaths.shift()!
    const simplifiedPath = simplifyPath(nextCandidatePath)

    if (!isPathCollidingWithObstacles(simplifiedPath, this.obstacles)) {
      this.solvedTracePath = simplifiedPath
      this.solved = true
    }
    // If the path collides, we simply do nothing and let the next step try another candidate.
  }

  override visualize(): GraphicsObject {
    const graphics = visualizeInputProblem(this.problem, {
      chipAlpha: 0.1,
      connectionAlpha: 0.1,
    })

    if (!graphics.lines) graphics.lines = []
    if (!graphics.rects) graphics.rects = []

    // Draw initial trace
    graphics.lines.push({
      points: this.initialTrace.tracePath,
      strokeColor: "red",
      strokeDash: "4 4",
    })

    // Draw label
    graphics.rects.push({
      center: this.label.center,
      width: this.label.width,
      height: this.label.height,
      fill: "rgba(255, 0, 0, 0.2)",
    })

    // Draw next candidate
    if (this.queuedCandidatePaths.length > 0) {
      graphics.lines.push({
        points: this.queuedCandidatePaths[0],
        strokeColor: "orange",
      })
    }

    // Draw solved path
    if (this.solvedTracePath) {
      graphics.lines.push({
        points: this.solvedTracePath,
        strokeColor: "green",
      })
    }

    return graphics
  }
}
