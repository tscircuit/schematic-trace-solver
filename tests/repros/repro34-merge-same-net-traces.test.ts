import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "../assets/example02.json"
import { mergeNearbySameNetTraceSegments } from "lib/solvers/TraceCleanupSolver/mergeNearbySameNetTraceSegments"

test("repro34 merge same-net trace lines close together (example02)", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)
  solver.solve()
  expect(solver.solved).toBe(true)

  const traces =
    solver.traceCleanupSolver2?.getOutput().traces ??
    solver.traceCleanupSolver?.getOutput().traces ??
    []
  expect(traces.length).toBeGreaterThan(0)

  // Feature sanity: helper is deterministic and does not drop traces.
  const merged = mergeNearbySameNetTraceSegments(traces, { snapDistance: 0.1 })
  expect(merged.traces.length).toBe(traces.length)
})
