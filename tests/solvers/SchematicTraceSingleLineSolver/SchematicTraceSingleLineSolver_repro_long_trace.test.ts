import { test, expect } from "bun:test"
import input from "./SchematicTraceSingleLineSolver_repro_long_trace.json"
import { SchematicTraceSingleLineSolver } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver/SchematicTraceSingleLineSolver"

test("SchematicTraceSingleLineSolver_repro_long_trace", () => {
  const solver = new SchematicTraceSingleLineSolver(input as any)
  solver.solve()

  expect(solver.failed).toBe(false)
  expect(solver.solvedTracePath).not.toBe(null)
})
