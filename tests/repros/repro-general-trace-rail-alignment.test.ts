import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import "tests/fixtures/matcher"
import horizontalInput from "./assets/repro-component-side-horizontal-trace-rail-alignment.input.json"
import verticalInput from "./assets/repro-component-side-vertical-trace-rail-alignment.input.json"

const solve = (inputProblem: unknown) => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any, {
    hideRatsNet: true,
  })
  solver.solve()
  return solver
}

test("aligns vertical rails shared by a net on one component side", () => {
  const solver = solve(verticalInput)
  const traces = solver
    .finalTraceCleanupSolver!.getOutput()
    .traces.filter((trace) =>
      solver
        .traceCleanupSolver!.getOutput()
        .traces.some(
          (routedTrace) => routedTrace.mspPairId === trace.mspPairId,
        ),
    )
  const railCoordinates = new Set(traces.map((trace) => trace.tracePath[1]!.x))

  expect(railCoordinates.size).toBe(1)
  expect(solver.finalTraceCleanupSolver!.stats).toMatchObject({
    alignedRailGroupCount: 1,
    alignedTraceCount: 3,
  })
  expect(solver).toMatchSolverSnapshot(
    import.meta.path,
    "repro-general-trace-rail-alignment-vertical",
  )
})

test("aligns horizontal rails shared by a net on one component side", () => {
  const solver = solve(horizontalInput)
  const traces = solver
    .finalTraceCleanupSolver!.getOutput()
    .traces.filter((trace) =>
      solver
        .traceCleanupSolver!.getOutput()
        .traces.some(
          (routedTrace) => routedTrace.mspPairId === trace.mspPairId,
        ),
    )
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
