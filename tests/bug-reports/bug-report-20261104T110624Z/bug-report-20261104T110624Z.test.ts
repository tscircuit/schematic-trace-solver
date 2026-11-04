import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import { findPerpendicularPathCrossings } from "lib/solvers/TraceCleanupSolver/sub-solver/findIntersectionsWithObstacles"
import inputProblem from "./bug-report-20261104T110624Z.json"
import "tests/fixtures/matcher"

test("bug-report-20261104T110624Z", async () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)
  solver.solve()
  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)

  const { traces, netLabelPlacements } =
    solver.netLabelToTraceSolver!.getOutput()
  const vref = netLabelPlacements.find((label) => label.netId === "VREF")!
  const supply = netLabelPlacements.find((label) => label.netId === "VCC_CHG")!
  expect(vref.orientation).toBe("y+")
  expect(vref.globalConnNetId).not.toBe(supply.globalConnNetId)
  const vrefTraces = traces.filter(
    (trace) => trace.globalConnNetId === vref.globalConnNetId,
  )
  const supplyTraces = traces.filter(
    (trace) => trace.globalConnNetId === supply.globalConnNetId,
  )
  const crossings = vrefTraces.flatMap((trace) =>
    supplyTraces.flatMap((other) =>
      findPerpendicularPathCrossings(trace.tracePath, other.tracePath, {
        includeTerminalSegments: true,
      }),
    ),
  )
  expect(crossings).toHaveLength(0)

  await expect(solver).toMatchSolverSnapshot(import.meta.path)
})
