import { test, expect } from "bun:test"
import input from "./SchematicTraceSingleLineSolver_repro01.json"
import { SchematicTraceSingleLineSolver } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver/SchematicTraceSingleLineSolver"

test("SchematicTraceSingleLineSolver_repro01", () => {
  const solver = new SchematicTraceSingleLineSolver(input as any)
  solver.solve()

  // The solver should fail because it cannot find a path around the chip
  // without guidelines to help navigate around it
  expect(solver.failed).toBe(true)
  expect(solver.error).toBe(
    "No more candidate elbows, everything had collisions",
  )
  expect(solver.solvedTracePath).toBe(null)
})
