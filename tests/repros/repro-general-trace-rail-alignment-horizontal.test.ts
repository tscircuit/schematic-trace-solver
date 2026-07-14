import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import "tests/fixtures/matcher"
import horizontalInput from "./assets/repro-component-side-horizontal-trace-rail-alignment.input.json"

test("aligns horizontal rails shared by a net on one component side", () => {
  const solver = new SchematicTracePipelineSolver(horizontalInput as any, {
    hideRatsNet: true,
  })
  solver.solve()

  const routedTraceIds = new Set(
    solver
      .traceCleanupSolver!.getOutput()
      .traces.map((trace) => trace.mspPairId),
  )
  const traces = solver
    .finalTraceCleanupSolver!.getOutput()
    .traces.filter((trace) => routedTraceIds.has(trace.mspPairId))
  const railCoordinates = new Set(traces.map((trace) => trace.tracePath[1]!.y))

  expect(railCoordinates.size).toBe(1)
  expect(solver.finalTraceCleanupSolver!.stats).toMatchObject({
    alignedRailGroupCount: 1,
    alignedTraceCount: 3,
  })
  expect(solver).toMatchSolverSnapshot(
    import.meta.path,
    "repro-general-trace-rail-alignment-horizontal",
  )
})
