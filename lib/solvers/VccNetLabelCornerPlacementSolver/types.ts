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
}

export type CornerCandidateStatus =
  | "valid"
  | "chip-collision"
  | "trace-collision"
  | "netlabel-collision"

export type EvaluatedCornerCandidate = TraceCornerCandidate & {
  center: Point
  width: number
  height: number
  status: CornerCandidateStatus
  selected: boolean
}
