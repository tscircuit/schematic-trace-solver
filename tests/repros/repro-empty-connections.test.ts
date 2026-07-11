import { expect, test } from "bun:test"
import { MspConnectionPairSolver } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"

/**
 * Regression test for issue #657:
 * Solver crashed with "TypeError: inputProblem.directConnections is not iterable"
 * when connections arrays were empty or undefined.
 */

test("solver handles empty connections without crashing", () => {
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

test("solver handles undefined connections without crashing", () => {
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

test("solver handles all fields undefined without crashing", () => {
  const solver = new SchematicTracePipelineSolver({
    chips: undefined,
    directConnections: undefined,
    netConnections: undefined,
    availableNetLabelOrientations: {},
  })
  solver.solve()
  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  expect(Array.isArray(solver.schematicTraceLinesSolver?.solvedTracePaths)).toBe(true)
})

test("solver handles missing availableNetLabelOrientations without crashing", () => {
  const solver = new SchematicTracePipelineSolver({
    chips: [],
    directConnections: [],
    netConnections: [],
    availableNetLabelOrientations: undefined,
  })
  solver.solve()
  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  expect(Array.isArray(solver.schematicTraceLinesSolver?.solvedTracePaths)).toBe(true)
})

test("MspConnectionPairSolver handles undefined connections directly without crashing", () => {
  const solver = new MspConnectionPairSolver({
    inputProblem: {
      chips: undefined,
      directConnections: undefined,
      netConnections: undefined,
      availableNetLabelOrientations: {},
    },
  })
  solver.solve()
  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  expect(Array.isArray(solver.mspConnectionPairs)).toBe(true)
})

test("solver handles directConnections array with undefined elements without crashing", () => {
  // Intentional as any: we deliberately pass a sparse/corrupted array to prove
  // the element-level null guards (Fix E) protect against individual null entries.
  const solver = new SchematicTracePipelineSolver({
    chips: [],
    directConnections: [undefined] as any,
    netConnections: [],
    availableNetLabelOrientations: {},
  })
  solver.solve()
  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  expect(Array.isArray(solver.schematicTraceLinesSolver?.solvedTracePaths)).toBe(true)
})
