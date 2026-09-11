import type { Point } from "@tscircuit/math-utils"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"

export interface RailNetLabelCornerPlacementSolverParams {
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
   * True when the corner is on a vertical rail that connects directly to one
   * of the trace's endpoint pins, rather than on an arbitrary middle bend.
   */
  pinAligned: boolean
  reroutedTracePath?: Point[]
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
