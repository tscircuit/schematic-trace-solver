import type { Point } from "@tscircuit/math-utils"
import type { NetLabelPlacement } from "../NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "../../types/InputProblem"
import type { FacingDirection } from "../../utils/dir"

export interface AvailableNetOrientationSolverParams {
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

export type ChipSide = "left" | "right" | "top" | "bottom"

export type CandidateLabel = {
  orientation: FacingDirection
  anchorPoint: Point
  center: Point
  width: number
  height: number
}

export type CandidateStatus =
  | "valid"
  | "chip-collision"
  | "trace-collision"
  | "netlabel-collision"

export type CandidatePhase = "rotate" | "shift"

export type EvaluatedCandidate = CandidateLabel & {
  status: CandidateStatus
  selected: boolean
  phase: CandidatePhase
  distance?: number
  outwardDistance?: number
}
