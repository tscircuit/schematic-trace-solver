import { test, expect } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "../assets/empty-connections.json"

test("empty-connections: solver does not crash on empty connections array", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  // Should not throw
  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.failed).toBeFalsy()
})

test("empty-connections: solver handles completely empty input", () => {
  const emptyInput = {
    chips: [],
    directConnections: [],
    netConnections: [],
    availableNetLabelOrientations: {},
  }

  const solver = new SchematicTracePipelineSolver(emptyInput as any)

  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.failed).toBeFalsy()
})
