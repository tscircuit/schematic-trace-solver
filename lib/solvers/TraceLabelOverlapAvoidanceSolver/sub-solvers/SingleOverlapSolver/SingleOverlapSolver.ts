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
import { detectTraceLabelOverlap } from "../../detectTraceLabelOverlap"

interface SingleOverlapSolverInput {
  trace: SolvedTracePath
  label: NetLabelPlacement
  problem: InputProblem
  paddingBuffer: number
  detourCount: number
  tracesToAvoidOverlapping?: SolvedTracePath[]
}

const MAX_TRIES = 5
const COINCIDENT_EPS = 2e-3

/**
 * Returns true if any segment of the path is parallel and coincident
 * (within COINCIDENT_EPS) with a segment of one of the given traces.
 * Perpendicular crossings are allowed.
 */
const doesPathCoincideWithTraces = (
  path: Point[],
  traces: SolvedTracePath[],
): boolean => {
  const rangesOverlap1D = (a1: number, a2: number, b1: number, b2: number) =>
    Math.min(Math.max(a1, a2), Math.max(b1, b2)) -
      Math.max(Math.min(a1, a2), Math.min(b1, b2)) >
    COINCIDENT_EPS

  for (let i = 0; i < path.length - 1; i++) {
    const pathSegStart = path[i]!
    const pathSegEnd = path[i + 1]!
    const isVertical = Math.abs(pathSegStart.x - pathSegEnd.x) < COINCIDENT_EPS
    const isHorizontal =
      Math.abs(pathSegStart.y - pathSegEnd.y) < COINCIDENT_EPS
    if (!isVertical && !isHorizontal) continue

    // For a vertical segment, coincidence is measured in x and overlap in y
    // (and vice versa for horizontal)
    const crossAxis = isVertical ? "x" : "y"
    const alongAxis = isVertical ? "y" : "x"

    for (const trace of traces) {
      for (let j = 0; j < trace.tracePath.length - 1; j++) {
        const traceSegStart = trace.tracePath[j]!
        const traceSegEnd = trace.tracePath[j + 1]!

        const isParallel =
          Math.abs(traceSegStart[crossAxis] - traceSegEnd[crossAxis]) <
          COINCIDENT_EPS
        if (!isParallel) continue

        const isCoincident =
          Math.abs(pathSegStart[crossAxis] - traceSegStart[crossAxis]) <
          COINCIDENT_EPS
        if (!isCoincident) continue

        if (
          rangesOverlap1D(
            pathSegStart[alongAxis],
            pathSegEnd[alongAxis],
            traceSegStart[alongAxis],
            traceSegEnd[alongAxis],
          )
        ) {
          return true
        }
      }
    }
  }
  return false
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
  tracesToAvoidOverlapping: SolvedTracePath[]
  _tried: number = 0

  constructor(solverInput: SingleOverlapSolverInput) {
    super()
    this.initialTrace = solverInput.trace
    this.problem = solverInput.problem
    this.label = solverInput.label
    this.tracesToAvoidOverlapping = (
      solverInput.tracesToAvoidOverlapping ?? []
    ).filter((t) => t.globalConnNetId !== solverInput.trace.globalConnNetId)

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

    this.queuedCandidatePaths = candidates.sort(
      (a, b) => getPathLength(a) - getPathLength(b),
    )
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

    // A candidate is only valid if it actually clears the label it is meant to
    // avoid. Without this check a "detour" that still grazes the label (e.g. one
    // built around the wrong segment) would be accepted as solved.
    const stillOverlapsLabel =
      detectTraceLabelOverlap({
        traces: [{ ...this.initialTrace, tracePath: simplifiedPath }],
        netLabels: [this.label],
      }).length > 0

    if (
      !stillOverlapsLabel &&
      !isPathCollidingWithObstacles(simplifiedPath, this.obstacles) &&
      !doesPathCoincideWithTraces(simplifiedPath, this.tracesToAvoidOverlapping)
    ) {
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
