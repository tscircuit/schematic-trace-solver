import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

export const isLabelAttachedToTrace = (
  label: NetLabelPlacement,
  trace: SolvedTracePath,
) =>
  label.globalConnNetId === trace.globalConnNetId ||
  label.mspConnectionPairIds.includes(trace.mspPairId)
