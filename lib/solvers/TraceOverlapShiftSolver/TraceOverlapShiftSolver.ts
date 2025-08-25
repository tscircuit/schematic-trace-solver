import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import { visualizeInputProblem } from "../SchematicTracePipelineSolver/visualizeInputProblem"
import type { InputProblem } from "lib/types/InputProblem"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { ConnectivityMap } from "connectivity-map"
import {
  TraceOverlapIssueSolver,
  type OverlappingTraceSegmentLocator,
} from "./TraceOverlapIssueSolver/TraceOverlapIssueSolver"
import type { MspConnectionPairId } from "../MspConnectionPairSolver/MspConnectionPairSolver"

type ConnNetId = string

/**
 * This solver finds traces that overlap (coincident and parallel) and aren't
 * connected via the globalConnMap, then shifts them to avoid the overlap in
 * such a way that minimizes the resulting intersections
 *
 * All traces are orthogonal, so for traces to be considered overlapping, they
 * need to each have a segment where both are horizontal or both are vertical
 * AND the segments must be within 1e-6 of each other in X (if vertical) or
 * Y (if horizontal)
 *
 * Each iteration, we find overlapping traces that aren't part of the same net.
 * This is the same as finding two "trace net islands" that have an overlap.
 *
 * We then consider all the possible ways to shift the overlapping traces to
 * minimize the intersections. If there are multiple trace segments within the
 * same net island they shift together.
 */
export class TraceOverlapShiftSolver extends BaseSolver {
  inputProblem: InputProblem
  inputTracePaths: Array<SolvedTracePath>
  globalConnMap: ConnectivityMap

  declare activeSubSolver: TraceOverlapIssueSolver | null

  /**
   * A traceNetIsland is a set of traces that are connected via the globalConnMap
   */
  traceNetIslands: Record<ConnNetId, Array<SolvedTracePath>> = {}

  correctedTraceMap: Record<MspConnectionPairId, SolvedTracePath> = {}

  constructor(params: {
    inputProblem: InputProblem
    inputTracePaths: Array<SolvedTracePath>
    globalConnMap: ConnectivityMap
  }) {
    super()
    this.inputProblem = params.inputProblem
    this.inputTracePaths = params.inputTracePaths
    this.globalConnMap = params.globalConnMap

    for (const tracePath of this.inputTracePaths) {
      const { mspPairId } = tracePath
      this.correctedTraceMap[mspPairId] = tracePath
    }

    this.traceNetIslands = this.computeTraceNetIslands()
  }

  override getConstructorParams(): ConstructorParameters<
    typeof TraceOverlapShiftSolver
  >[0] {
    return {
      inputProblem: this.inputProblem,
      inputTracePaths: this.inputTracePaths,
      globalConnMap: this.globalConnMap,
    }
  }

  computeTraceNetIslands(): Record<ConnNetId, Array<SolvedTracePath>> {
    // Compute the trace net islands using the correctedTraceMap
    throw new Error("Not implemented")
  }

  findNextOverlapIssue(): {
    overlappingTraceSegments: Array<OverlappingTraceSegmentLocator>
  } | null {
    throw new Error("Not implemented")
  }

  override _step() {
    if (this.activeSubSolver?.solved) {
      for (const [mspPairId, newTrace] of Object.entries(
        this.activeSubSolver.correctedTraceMap,
      )) {
        this.correctedTraceMap[mspPairId] = newTrace
      }
      this.activeSubSolver = null
      this.computeTraceNetIslands()
    }

    if (this.activeSubSolver) {
      this.activeSubSolver.step()
      return
    }

    // Find the next overlapping trace segment
    const overlapIssue = this.findNextOverlapIssue()

    if (overlapIssue === null) {
      this.solved = true
      return
    }

    const { overlappingTraceSegments } = overlapIssue

    this.activeSubSolver = new TraceOverlapIssueSolver({
      overlappingTraceSegments,
      traceNetIslands: this.traceNetIslands,
    })
  }

  override visualize() {
    if (this.activeSubSolver) {
      return this.activeSubSolver.visualize()
    }

    const graphics = visualizeInputProblem(this.inputProblem)

    // TODO draw the nonOverlappingTraces

    return graphics
  }
}
