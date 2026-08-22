import type { Point } from "@tscircuit/math-utils"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

export interface CompletedTraceReroute {
  initialTrace: SolvedTracePath
  reroutedTracePath: Point[]
  label: NetLabelPlacement
  detourCount: number
}
