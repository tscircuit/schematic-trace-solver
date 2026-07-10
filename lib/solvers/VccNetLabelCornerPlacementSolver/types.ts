import type { Point } from "@tscircuit/math-utils"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"

export interface VccNetLabelCornerPlacementSolverParams {
  inputProblem: InputProblem
  traces: SolvedTracePath[]
  netLabelPlacements: NetLabelPlacement[]
}

export type Bounds = {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export type TraceCornerCandidate = {
  anchorPoint: Point
  traceId: string
  distance: number
  /**
   * True when the corner lines up with one of the trace's pins along the
   * label's stub axis (same x for a vertical rail label), so the label reads as
   * a clean stub off that pin rather than floating over a mid-trace bend.
   */
  pinAligned: boolean
}

export type CornerCandidateStatus =
  | "valid"
  | "chip-collision"
  | "text-collision"
  | "trace-collision"
  | "netlabel-collision"

export type EvaluatedCornerCandidate = TraceCornerCandidate & {
  center: Point
  width: number
  height: number
  status: CornerCandidateStatus
  selected: boolean
}
