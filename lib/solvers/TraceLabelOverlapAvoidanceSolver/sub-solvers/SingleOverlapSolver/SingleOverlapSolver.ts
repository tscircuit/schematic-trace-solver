import type { Point } from "@tscircuit/math-utils"
import type { GraphicsObject } from "graphics-debug"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { isPathCollidingWithObstacles } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import { getObstacleRects } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect"
import { visualizeInputProblem } from "lib/solvers/SchematicTracePipelineSolver/visualizeInputProblem"
import { simplifyPath } from "lib/solvers/TraceCleanupSolver/simplifyPath"
import type { InputProblem } from "lib/types/InputProblem"
import { doesPathCoincideWithTraces } from "lib/utils/doesPathCoincideWithTraces"
import type { NetLabelPlacement } from "../../../NetLabelPlacementSolver/NetLabelPlacementSolver"
import { detectTraceLabelOverlap } from "../../detectTraceLabelOverlap"
import { generateRerouteCandidates } from "../../rerouteCollidingTrace"
import { getFallbackSpanningCandidates } from "./getFallbackSpanningCandidates"
import { rankDetourCandidates } from "./rankDetourCandidates"

interface SingleOverlapSolverInput {
  trace: SolvedTracePath
  label: NetLabelPlacement
  problem: InputProblem
  paddingBuffer: number
  detourCount: number
  tracesToAvoidOverlapping?: SolvedTracePath[]
  netLabelPlacements?: NetLabelPlacement[]
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
      paddingBuffer: effectivePadding,
    })

    const candidateByPath = new Map<string, Point[]>()
    for (const candidate of candidates) {
      const simplifiedCandidate = simplifyPath(candidate)
      candidateByPath.set(
        simplifiedCandidate.map((point) => `${point.x},${point.y}`).join(";"),
        simplifiedCandidate,
      )
    }

    const fallbackCandidates = getFallbackSpanningCandidates({
      initialTrace: this.initialTrace,
      label: this.label,
      problem: this.problem,
      paddingBuffer: effectivePadding,
      detourCount: this.detourCount,
    }).filter(
      (candidate) =>
        !candidateByPath.has(
          candidate.map((point) => `${point.x},${point.y}`).join(";"),
        ),
    )

    this.queuedCandidatePaths = [
      ...rankDetourCandidates({
        candidates: [...candidateByPath.values()],
        initialTrace: this.initialTrace,
        tracesToAvoidOverlapping: this.tracesToAvoidOverlapping,
        netLabelPlacements: this.netLabelPlacements,
      }),
      ...rankDetourCandidates({
        candidates: fallbackCandidates,
        initialTrace: this.initialTrace,
        tracesToAvoidOverlapping: this.tracesToAvoidOverlapping,
        netLabelPlacements: this.netLabelPlacements,
      }),
    ]
  }

  override _step() {
    // Ranking expresses preference, not validity. Exhaust the finite candidate
    // queue so invalid preferred paths cannot hide a later valid detour.
    if (this.queuedCandidatePaths.length === 0) {
      this.failed = true
      return
    }

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
