import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { FacingDirection } from "lib/utils/dir"

export type RailOrientation = "horizontal" | "vertical"

export interface RailSegment {
  traceId: string
  segmentIndex: number
  globalConnNetId: string
  orientation: RailOrientation
  coordinate: number
  minAlong: number
  maxAlong: number
  componentId: string
  componentFacingDirection: FacingDirection
}

export interface TraceGeometryMetrics {
  turnCount: number
  visibleLength: number
  pathLength: number
  otherNetCrossings: number
}

export interface AlignmentScore extends TraceGeometryMetrics {
  displacement: number
  coordinate: number
}

export interface AlignmentCandidate {
  traces: SolvedTracePath[]
  changedTraceIds: string[]
  score: AlignmentScore
}
