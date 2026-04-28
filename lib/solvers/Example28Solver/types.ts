import type { Point } from "@tscircuit/math-utils"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { getObstacleRects } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { TraceLabelOverlap } from "lib/solvers/TraceLabelOverlapAvoidanceSolver/detectTraceLabelOverlap"
import type { InputProblem } from "lib/types/InputProblem"

export interface Example28SolverParams {
  inputProblem: InputProblem
  traces: SolvedTracePath[]
  netLabelPlacements: NetLabelPlacement[]
}

export type TracePathScore = {
  labelIntersections: number
  labelHugDistance: number
  traceIntersections: number
  pathLength: number
}

export type SegmentOrientation = "horizontal" | "vertical"

export type PathSegment = {
  start: Point
  end: Point
  orientation: SegmentOrientation
}

export type ChipObstacle = ReturnType<typeof getObstacleRects>[number]

export type RerouteCandidateResult = {
  path: Point[]
  score?: TracePathScore
  status: "valid" | "duplicate" | "chip-collision"
  selected: boolean
}

export type Example28VisualizationState = {
  inputProblem: InputProblem
  outputTraces: SolvedTracePath[]
  outputNetLabelPlacements: NetLabelPlacement[]
  solved: boolean
  currentOverlap: TraceLabelOverlap | null
  currentCandidateResults: RerouteCandidateResult[]
}

export const EPS = 1e-9
