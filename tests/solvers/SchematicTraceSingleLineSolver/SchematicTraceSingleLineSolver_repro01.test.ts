import { test, expect } from "bun:test"
import input from "./SchematicTraceSingleLineSolver_repro01.json"
import { SchematicTraceSingleLineSolver } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver/SchematicTraceSingleLineSolver"

test("SchematicTraceSingleLineSolver_repro01", () => {
  const solver = new SchematicTraceSingleLineSolver(input as any)
  solver.solve()

  // TODO check the output to make sure the traces don't go through the chip

  expect(solver.solvedTracePath).toMatchInlineSnapshot(`
    [
      {
        "x": 0.30397715550000004,
        "y": 0.5800832909999993,
      },
      {
        "x": 0.30397715550000004,
        "y": 0.7800832909999994,
      },
      {
        "x": 0.3073264555000007,
        "y": 0.7800832909999994,
      },
      {
        "x": 0.3073264555000007,
        "y": -0.7800832909999995,
      },
      {
        "x": 0.31067575550000137,
        "y": -0.7800832909999995,
      },
      {
        "x": 0.31067575550000137,
        "y": -0.5800832909999993,
      },
    ]
  `)
})
