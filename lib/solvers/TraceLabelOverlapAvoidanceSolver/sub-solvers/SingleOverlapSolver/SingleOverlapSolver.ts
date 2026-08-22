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
import { doesPathCoincideWithTraces } from "lib/utils/doesPathCoincideWithTraces"

interface SingleOverlapSolverInput {
  trace: SolvedTracePath
  label: NetLabelPlacement
  problem: InputProblem
  paddingBuffer: number
  detourCount: number
  tracesToAvoidOverlapping?: SolvedTracePath[]
  netLabelPlacements?: NetLabelPlacement[]
}

const MAX_TRIES = 5
const PATH_LENGTH_EPSILON = 1e-9

const getPathLength = (points: Point[]) => {
  let length = 0
  for (let pointIndex = 0; pointIndex < points.length - 1; pointIndex++) {
    const point = points[pointIndex]!
    const nextPoint = points[pointIndex + 1]!
    length += Math.abs(nextPoint.x - point.x) + Math.abs(nextPoint.y - point.y)
  }
  return length
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
  netLabelPlacements: NetLabelPlacement[]
  detourCount: number
  _tried: number = 0

  constructor(solverInput: SingleOverlapSolverInput) {
    super()
    this.initialTrace = solverInput.trace
    this.problem = solverInput.problem
    this.label = solverInput.label
    this.detourCount = solverInput.detourCount
    this.tracesToAvoidOverlapping = (
      solverInput.tracesToAvoidOverlapping ?? []
    ).filter((t) => t.globalConnNetId !== solverInput.trace.globalConnNetId)
    this.netLabelPlacements = solverInput.netLabelPlacements ?? [
      solverInput.label,
    ]
    this.obstacles = getObstacleRects(this.problem)

    // Calculate an effective padding for this specific run based on the detourCount.
    const effectivePadding =
      solverInput.paddingBuffer +
      solverInput.detourCount * solverInput.paddingBuffer

    const candidates = generateRerouteCandidates({
      ...solverInput,
      paddingBuffer: effectivePadding, // Use the calculated, larger padding
    })

    const getLabelOverlapCount = (path: Point[]) =>
      detectTraceLabelOverlap({
        traces: [{ ...this.initialTrace, tracePath: path }],
        netLabels: this.netLabelPlacements,
      }).length

    const candidateByPath = new Map<string, Point[]>()
    for (const candidate of candidates) {
      const simplifiedCandidate = simplifyPath(candidate)
      candidateByPath.set(
        simplifiedCandidate.map((point) => `${point.x},${point.y}`).join(";"),
        simplifiedCandidate,
      )
    }

    this.queuedCandidatePaths = [...candidateByPath.values()].sort((a, b) => {
      const pathLengthDifference = getPathLength(a) - getPathLength(b)
      if (Math.abs(pathLengthDifference) >= PATH_LENGTH_EPSILON) {
        return pathLengthDifference
      }

      const overlapCountDifference =
        getLabelOverlapCount(a) - getLabelOverlapCount(b)
      if (overlapCountDifference !== 0) return overlapCountDifference

      return a.length - b.length
    })
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
    const initialPath = simplifyPath(this.initialTrace.tracePath)
    const initialLabelOverlaps = detectTraceLabelOverlap({
      traces: [{ ...this.initialTrace, tracePath: initialPath }],
      netLabels: this.netLabelPlacements,
    })
    const candidateLabelOverlaps = detectTraceLabelOverlap({
      traces: [{ ...this.initialTrace, tracePath: simplifiedPath }],
      netLabels: this.netLabelPlacements,
    })

    if (
      !stillOverlapsLabel &&
      candidateLabelOverlaps.length <= initialLabelOverlaps.length &&
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
    if (!this.solvedTracePath && this.queuedCandidatePaths.length > 0) {
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
