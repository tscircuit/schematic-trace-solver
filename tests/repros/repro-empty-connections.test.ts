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
})

test("solver handles undefined connections without crashing", () => {
  const solver = new SchematicTracePipelineSolver({
    chips: [],
    directConnections: undefined as any,
    netConnections: undefined as any,
    availableNetLabelOrientations: {},
  })
  solver.solve()
  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
})

test("solver handles all fields undefined without crashing", () => {
  const solver = new SchematicTracePipelineSolver({
    chips: undefined as any,
    directConnections: undefined as any,
    netConnections: undefined as any,
    availableNetLabelOrientations: {},
  })
  solver.solve()
  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
})

test("solver handles missing availableNetLabelOrientations without crashing", () => {
  const solver = new SchematicTracePipelineSolver({
    chips: [],
    directConnections: [],
    netConnections: [],
    availableNetLabelOrientations: undefined as any,
  })
  solver.solve()
  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
})

test("MspConnectionPairSolver handles undefined connections directly without crashing", () => {
  const solver = new MspConnectionPairSolver({
    inputProblem: {
      chips: undefined as any,
      directConnections: undefined as any,
      netConnections: undefined as any,
      availableNetLabelOrientations: {},
    },
  })
  solver.solve()
  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
})
