import type { Point } from "@tscircuit/math-utils"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { NetLabelPlacement } from "../../../NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { InputProblem } from "lib/types/InputProblem"
import type { GraphicsObject } from "graphics-debug"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { isPathCollidingWithObstacles } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import { getObstacleRects } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect"
import { visualizeInputProblem } from "lib/solvers/SchematicTracePipelineSolver/visualizeInputProblem"
import {
  generateRerouteCandidates,
  isSimpleFiveSegmentElbow,
} from "../../rerouteCollidingTrace"
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
  netLabelPlacements: NetLabelPlacement[]
}

const MAX_TRIES = 5

const getPathLength = (points: Point[]) => {
  let length = 0
  for (let pointIndex = 0; pointIndex < points.length - 1; pointIndex++) {
    const point = points[pointIndex]!
    const nextPoint = points[pointIndex + 1]!
    length += Math.abs(nextPoint.x - point.x) + Math.abs(nextPoint.y - point.y)
  }
  return length
}

const isMiddleTransitionShift = (
  initialPath: Point[],
  candidatePath: Point[],
) => {
  if (
    !isSimpleFiveSegmentElbow(initialPath) ||
    candidatePath.length !== initialPath.length
  ) {
    return false
  }

  const pointsMatch = (first: Point, second: Point) =>
    Math.abs(first.x - second.x) < 1e-9 && Math.abs(first.y - second.y) < 1e-9
  const unchangedPointIndices = [0, 1, 4, 5]

  return (
    unchangedPointIndices.every((pointIndex) =>
      pointsMatch(initialPath[pointIndex]!, candidatePath[pointIndex]!),
    ) &&
    (!pointsMatch(initialPath[2]!, candidatePath[2]!) ||
      !pointsMatch(initialPath[3]!, candidatePath[3]!))
  )
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
  initialSimplifiedPath: Point[]
  initialLabelOverlapCount: number
  initialPathLength: number
  initialPathPointCount: number
  hasValidCollisionReduction: boolean
  _tried: number = 0

  constructor(solverInput: SingleOverlapSolverInput) {
    super()
    this.initialTrace = solverInput.trace
    this.problem = solverInput.problem
    this.label = solverInput.label
    this.tracesToAvoidOverlapping = (
      solverInput.tracesToAvoidOverlapping ?? []
    ).filter((t) => t.globalConnNetId !== solverInput.trace.globalConnNetId)

    // The target may be a synthetic rectangle that merges several labels.
    // Use it for clearance, but measure improvement against rendered labels so
    // moving a trace from one real label into another is never accepted.
    const labelsByGeometry = new Map<string, NetLabelPlacement>()
    const labelsUsedToMeasureImprovement = solverInput.netLabelPlacements ?? [
      solverInput.label,
    ]
    for (const label of labelsUsedToMeasureImprovement) {
      const key = [
        label.globalConnNetId,
        label.center.x,
        label.center.y,
        label.width,
        label.height,
      ].join(":")
      labelsByGeometry.set(key, label)
    }
    this.netLabelPlacements = [...labelsByGeometry.values()]

    const simplifiedInitialPath = simplifyPath(this.initialTrace.tracePath)
    this.initialSimplifiedPath = simplifiedInitialPath
    this.initialLabelOverlapCount = detectTraceLabelOverlap({
      traces: [{ ...this.initialTrace, tracePath: simplifiedInitialPath }],
      netLabels: this.netLabelPlacements,
    }).length
    this.initialPathLength = getPathLength(simplifiedInitialPath)
    this.initialPathPointCount = simplifiedInitialPath.length
    this.obstacles = getObstacleRects(this.problem)

    // Calculate an effective padding for this specific run based on the detourCount.
    const effectivePadding =
      solverInput.paddingBuffer +
      solverInput.detourCount * solverInput.paddingBuffer

    const candidates = generateRerouteCandidates({
      ...solverInput,
      paddingBuffer: effectivePadding, // Use the calculated, larger padding
    })

    const candidateByKey = new Map<string, Point[]>()
    for (const candidate of candidates) {
      const simplifiedCandidate = simplifyPath(candidate)
      const key = simplifiedCandidate
        .map((point) => `${point.x},${point.y}`)
        .join(";")
      candidateByKey.set(key, simplifiedCandidate)
    }

    this.queuedCandidatePaths = [...candidateByKey.values()].sort((a, b) => {
      const aLabelOverlapCount = detectTraceLabelOverlap({
        traces: [{ ...this.initialTrace, tracePath: a }],
        netLabels: this.netLabelPlacements,
      }).length
      const bLabelOverlapCount = detectTraceLabelOverlap({
        traces: [{ ...this.initialTrace, tracePath: b }],
        netLabels: this.netLabelPlacements,
      }).length

      return (
        aLabelOverlapCount - bLabelOverlapCount ||
        getPathLength(a) - getPathLength(b)
      )
    })
    // Record whether this pass can finish the reroute without transferring the
    // collision to another rendered label.
    this.hasValidCollisionReduction = this.queuedCandidatePaths.some(
      (candidatePath) => this.isValidCollisionReduction(candidatePath),
    )
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

    const candidateLabelOverlapCount = detectTraceLabelOverlap({
      traces: [{ ...this.initialTrace, tracePath: simplifiedPath }],
      netLabels: this.netLabelPlacements,
    }).length
    const reducesWholeRouteLabelOverlaps =
      candidateLabelOverlapCount < this.initialLabelOverlapCount
    // When no complete reduction exists, an equal-cost alternate elbow can
    // expose a local obstacle that a later pass can detour around cleanly.
    const isEquivalentTransitionFallback =
      !this.hasValidCollisionReduction &&
      isMiddleTransitionShift(this.initialSimplifiedPath, simplifiedPath) &&
      candidateLabelOverlapCount === this.initialLabelOverlapCount &&
      simplifiedPath.length <= this.initialPathPointCount &&
      getPathLength(simplifiedPath) <= this.initialPathLength + 1e-9

    if (
      !stillOverlapsLabel &&
      (reducesWholeRouteLabelOverlaps || isEquivalentTransitionFallback) &&
      !isPathCollidingWithObstacles(simplifiedPath, this.obstacles) &&
      !doesPathCoincideWithTraces(simplifiedPath, this.tracesToAvoidOverlapping)
    ) {
      this.solvedTracePath = simplifiedPath
      this.solved = true
    }
    // If the path collides, we simply do nothing and let the next step try another candidate.
  }

  private isValidCollisionReduction(candidatePath: Point[]) {
    const trace = { ...this.initialTrace, tracePath: candidatePath }
    const stillOverlapsTarget =
      detectTraceLabelOverlap({
        traces: [trace],
        netLabels: [this.label],
      }).length > 0
    const realLabelOverlapCount = detectTraceLabelOverlap({
      traces: [trace],
      netLabels: this.netLabelPlacements,
    }).length

    return (
      !stillOverlapsTarget &&
      realLabelOverlapCount < this.initialLabelOverlapCount &&
      !isPathCollidingWithObstacles(candidatePath, this.obstacles) &&
      !doesPathCoincideWithTraces(candidatePath, this.tracesToAvoidOverlapping)
    )
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
