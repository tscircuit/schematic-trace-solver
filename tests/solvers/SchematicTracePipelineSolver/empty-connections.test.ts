import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"

/**
 * Regression tests for issue #657:
 * Solver crashed with "TypeError: inputProblem.directConnections is not iterable"
 * when directConnections or netConnections were undefined or empty.
 */

test("pipeline solver handles empty directConnections and netConnections", () => {
  const solver = new SchematicTracePipelineSolver({
    chips: [],
    directConnections: [],
    netConnections: [],
    availableNetLabelOrientations: {},
  })
  solver.solve()
  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  expect(Array.isArray(solver.schematicTraceLinesSolver?.solvedTracePaths)).toBe(true)
})

test("pipeline solver handles undefined directConnections and netConnections", () => {
  const solver = new SchematicTracePipelineSolver({
    chips: [],
    directConnections: undefined,
    netConnections: undefined,
    availableNetLabelOrientations: {},
  })
  solver.solve()
  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  expect(Array.isArray(solver.schematicTraceLinesSolver?.solvedTracePaths)).toBe(true)
})
