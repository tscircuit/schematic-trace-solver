import type { Point } from "@tscircuit/math-utils"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"
import type { FacingDirection } from "lib/utils/dir"

export interface TraceAnchoredNetLabelOverlapSolverParams {
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

export type LabelOverlap = {
  firstLabelIndex: number
  secondLabelIndex: number
}

export type TraceLocation = {
  trace: SolvedTracePath
  distance: number
}

export type CandidateStatus =
  | "valid"
  | "chip-collision"
  | "trace-collision"
  | "netlabel-collision"

export type LabelCandidate = {
  anchorPoint: Point
  center: Point
  width: number
  height: number
  orientation: FacingDirection
  traceId: string
  pathDistance: number
  distanceFromOriginal: number
  status: CandidateStatus
  selected: boolean
}
