import type { Point } from "@tscircuit/math-utils"
import type { GraphicsObject } from "graphics-debug"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { isPathCollidingWithObstacles } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import { getObstacleRects } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect"
import { visualizeInputProblem } from "lib/solvers/SchematicTracePipelineSolver/visualizeInputProblem"
import { preservesLabelAnchors } from "lib/solvers/TraceCleanupSolver/sameNetRailAlignment/preservesLabelAnchors"
import { simplifyPath } from "lib/solvers/TraceCleanupSolver/simplifyPath"
import { detectTraceLabelOverlap } from "lib/solvers/TraceLabelOverlapAvoidanceSolver/detectTraceLabelOverlap"
import type { InputProblem } from "lib/types/InputProblem"
import { doesPathCoincideWithTraces } from "lib/utils/doesPathCoincideWithTraces"
import type { CompletedTraceReroute } from "./types"
import { generateElbowTransitionSimplificationCandidates } from "./generateElbowTransitionSimplificationCandidates"

interface TraceElbowTransitionSimplificationSolverInput {
  inputProblem: InputProblem
  traces: SolvedTracePath[]
  completedReroutes: CompletedTraceReroute[]
  netLabelPlacements: NetLabelPlacement[]
  paddingBuffer: number
}

const PATH_LENGTH_EPSILON = 1e-9

const getPathLength = (points: Point[]) =>
  points.slice(1).reduce((length, point, pointIndex) => {
    const previousPoint = points[pointIndex]!
    return (
      length +
      Math.abs(point.x - previousPoint.x) +
      Math.abs(point.y - previousPoint.y)
    )
  }, 0)

/**
 * Post-processes traces after trace/label overlap avoidance. It removes
 * redundant elbow transitions and, when needed, shifts a simplified elbow
 * around a rendered label. Every replacement is revalidated against labels,
 * components, other-net traces, and label anchors.
 */
export class TraceElbowTransitionSimplificationSolver extends BaseSolver {
  private input: TraceElbowTransitionSimplificationSolverInput
  private outputTraces: SolvedTracePath[]
  private traceIdQueue: string[]
  private obstacles: ReturnType<typeof getObstacleRects>

  constructor(input: TraceElbowTransitionSimplificationSolverInput) {
    super()
    this.input = input
    this.outputTraces = [...input.traces]
    const reroutedTraceIds = new Set(
      input.completedReroutes.map(
        (completedReroute) => completedReroute.initialTrace.mspPairId,
      ),
    )
    this.traceIdQueue = input.traces
      .map((trace) => trace.mspPairId)
      .filter((traceId) => reroutedTraceIds.has(traceId))
    this.obstacles = getObstacleRects(input.inputProblem)
  }

  override _step() {
    const traceId = this.traceIdQueue.shift()
    if (!traceId) {
      this.solved = true
      return
    }

    const traceIndex = this.outputTraces.findIndex(
      (trace) => trace.mspPairId === traceId,
    )
    const trace = this.outputTraces[traceIndex]!
    const tracePath = simplifyPath(trace.tracePath)
    const initialOverlaps = detectTraceLabelOverlap({
      traces: [{ ...trace, tracePath }],
      netLabels: this.input.netLabelPlacements,
    })
    const otherNetTraces = this.outputTraces.filter(
      (otherTrace) =>
        otherTrace.mspPairId !== trace.mspPairId &&
        otherTrace.globalConnNetId !== trace.globalConnNetId,
    )
    const candidateByPath = new Map<string, Point[]>()
    const completedReroutes = this.input.completedReroutes.filter(
      (completedReroute) =>
        completedReroute.initialTrace.mspPairId === trace.mspPairId,
    )

    for (const completedReroute of completedReroutes) {
      const initialReroutePath = simplifyPath(
        completedReroute.initialTrace.tracePath,
      )
      const reroutedPath = simplifyPath(completedReroute.reroutedTracePath)
      const initialRerouteOverlapCount = detectTraceLabelOverlap({
        traces: [
          { ...completedReroute.initialTrace, tracePath: initialReroutePath },
        ],
        netLabels: this.input.netLabelPlacements,
      }).length

      const candidates = generateElbowTransitionSimplificationCandidates({
        trace: completedReroute.initialTrace,
        label: completedReroute.label,
        netLabelPlacements: this.input.netLabelPlacements,
        paddingBuffer: this.input.paddingBuffer,
        detourCount: completedReroute.detourCount,
      })
      for (const candidate of candidates) {
        const simplifiedCandidate = simplifyPath(candidate)
        const candidateTrace = {
          ...completedReroute.initialTrace,
          tracePath: simplifiedCandidate,
        }
        const candidateOverlapCount = detectTraceLabelOverlap({
          traces: [candidateTrace],
          netLabels: this.input.netLabelPlacements,
        }).length
        const isSimplerEquivalentReroute =
          candidateOverlapCount < initialRerouteOverlapCount &&
          Math.abs(
            getPathLength(simplifiedCandidate) - getPathLength(reroutedPath),
          ) < PATH_LENGTH_EPSILON &&
          simplifiedCandidate.length < reroutedPath.length &&
          preservesLabelAnchors(
            this.input.netLabelPlacements,
            [completedReroute.initialTrace],
            [candidateTrace],
          )

        if (isSimplerEquivalentReroute) {
          candidateByPath.set(
            simplifiedCandidate
              .map((point) => `${point.x},${point.y}`)
              .join(";"),
            simplifiedCandidate,
          )
        }
      }
    }

    const initialOverlapIds = new Set(
      initialOverlaps.map(
        ({ label }) => `${label.globalConnNetId}:${label.netId}`,
      ),
    )
    const initialPathLength = getPathLength(tracePath)

    const validCandidates = [...candidateByPath.values()].filter(
      (candidatePath) => {
        const candidateTrace = { ...trace, tracePath: candidatePath }
        const candidateOverlaps = detectTraceLabelOverlap({
          traces: [candidateTrace],
          netLabels: this.input.netLabelPlacements,
        })
        const candidateOnlyKeepsExistingOverlaps = candidateOverlaps.every(
          ({ label }) =>
            initialOverlapIds.has(`${label.globalConnNetId}:${label.netId}`),
        )
        const reducesCollisions =
          candidateOverlaps.length < initialOverlaps.length
        const simplifiesGeometry =
          candidateOverlaps.length === initialOverlaps.length &&
          getPathLength(candidatePath) <=
            initialPathLength + PATH_LENGTH_EPSILON &&
          candidatePath.length < tracePath.length

        return (
          candidateOnlyKeepsExistingOverlaps &&
          (reducesCollisions || simplifiesGeometry) &&
          preservesLabelAnchors(
            this.input.netLabelPlacements,
            [trace],
            [candidateTrace],
          ) &&
          !isPathCollidingWithObstacles(candidatePath, this.obstacles) &&
          !doesPathCoincideWithTraces(candidatePath, otherNetTraces)
        )
      },
    )

    const getOverlapCount = (candidatePath: Point[]) =>
      detectTraceLabelOverlap({
        traces: [{ ...trace, tracePath: candidatePath }],
        netLabels: this.input.netLabelPlacements,
      }).length
    validCandidates.sort((a, b) => {
      const overlapDifference = getOverlapCount(a) - getOverlapCount(b)
      if (overlapDifference !== 0) return overlapDifference
      return getPathLength(a) - getPathLength(b) || a.length - b.length
    })

    const bestCandidate = validCandidates[0]
    if (!bestCandidate) return

    this.outputTraces[traceIndex] = { ...trace, tracePath: bestCandidate }
    this.stats.simplifiedTraceCount = (this.stats.simplifiedTraceCount ?? 0) + 1
  }

  getOutput() {
    return {
      traces: this.outputTraces,
      netLabelPlacements: this.input.netLabelPlacements,
    }
  }

  override visualize(): GraphicsObject {
    const graphics = visualizeInputProblem(this.input.inputProblem)
    graphics.lines ??= []
    for (const trace of this.outputTraces) {
      graphics.lines.push({ points: trace.tracePath, strokeColor: "purple" })
    }
    return graphics
  }
}
