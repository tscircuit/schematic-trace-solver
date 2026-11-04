import { expect, test } from "bun:test"
import { tracePathContainsPoint } from "lib/solvers/RailNetLabelCornerPlacementSolver/geometry"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import { findPerpendicularPathCrossings } from "lib/solvers/TraceCleanupSolver/sub-solver/findIntersectionsWithObstacles"
import type { InputProblem } from "lib/types/InputProblem"
import input from "../../bug-reports/bug-report-20261104T110624Z/bug-report-20261104T110624Z.json"

test("places the upward VREF rail without crossing other nets", () => {
  const solver = new SchematicTracePipelineSolver(
    input as unknown as InputProblem,
  )
  solver.solve()
  expect(solver.solved).toBe(true)

  const { traces, netLabelPlacements } =
    solver.netLabelToTraceSolver!.getOutput()
  const label = netLabelPlacements.find((label) => label.netId === "VREF")!
  expect(label.orientation).toBe("y+")
  const local = traces.filter(
    (trace) => trace.globalConnNetId === label.globalConnNetId,
  )
  const other = traces.filter(
    (trace) => trace.globalConnNetId !== label.globalConnNetId,
  )
  const crossings = local.flatMap((trace) =>
    other.flatMap((other) =>
      findPerpendicularPathCrossings(trace.tracePath, other.tracePath, {
        includeTerminalSegments: true,
      }),
    ),
  )
  expect(crossings).toHaveLength(0)
  expect(
    local.some((trace) =>
      tracePathContainsPoint(trace.tracePath, label.anchorPoint),
    ),
  ).toBe(true)
})
