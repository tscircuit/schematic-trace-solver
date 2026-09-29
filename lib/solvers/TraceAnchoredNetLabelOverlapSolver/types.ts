import type { Point } from "@tscircuit/math-utils"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"
import type { FacingDirection } from "lib/utils/dir"

export interface TraceAnchoredNetLabelOverlapSolverParams {
  /** Which obstacles trigger a search along the label's existing host trace. */
  overlapMode?: "labels" | "traces"
  /** Exact identities of the generated label connector traces. */
  netLabelConnectorTraceIds?: ReadonlySet<string>
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

export type LabelOverlap =
  | { type: "labels"; firstLabelIndex: number; secondLabelIndex: number }
  | { type: "trace"; labelIndex: number; traceId: string }

export type TraceLocation = {
  trace: SolvedTracePath
  distance: number
}

export type CandidateStatus =
  | "valid"
  | "chip-collision"
  | "text-collision"
  | "trace-collision"
  | "netlabel-collision"
  | "attachment-loss"

export type LabelConnectorUpdate = {
  traceId: string
  tracePath: Point[]
  replacementHostTraceId?: string
}

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
  connectorUpdates?: LabelConnectorUpdate[]
}
