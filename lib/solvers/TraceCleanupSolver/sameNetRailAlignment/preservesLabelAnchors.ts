import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import { tracePathContainsPoint } from "lib/solvers/RailNetLabelCornerPlacementSolver/geometry"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

const labelIsAnchored = (label: NetLabelPlacement, traces: SolvedTracePath[]) =>
  traces.some(
    (trace) =>
      trace.globalConnNetId === label.globalConnNetId &&
      tracePathContainsPoint(trace.tracePath, label.anchorPoint),
  )

export const preservesLabelAnchors = (
  labels: NetLabelPlacement[],
  before: SolvedTracePath[],
  after: SolvedTracePath[],
) =>
  labels.every(
    (label) => !labelIsAnchored(label, before) || labelIsAnchored(label, after),
  )
