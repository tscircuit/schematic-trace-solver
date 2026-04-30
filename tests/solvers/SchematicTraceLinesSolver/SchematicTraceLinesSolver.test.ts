import { test, expect } from "bun:test"
import { SchematicTraceLinesSolver } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { MspConnectionPairSolver } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import { getConnectivityMapsFromInputProblem } from "lib/solvers/MspConnectionPairSolver/getConnectivityMapFromInputProblem"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "../../assets/example01.json"

test("SchematicTraceLinesSolver initializes correctly", () => {
  const pipeline = new SchematicTracePipelineSolver(inputProblem as any)
  pipeline.solve()

  const mspSolver = new MspConnectionPairSolver({
    inputProblem: inputProblem as any,
  })
  mspSolver.solve()

  const { dcConnMap, globalConnMap } = getConnectivityMapsFromInputProblem(
    inputProblem as any,
  )

  const solver = new SchematicTraceLinesSolver({
    mspConnectionPairs: mspSolver.mspConnectionPairs,
    chipMap: mspSolver.chipMap,
    dcConnMap,
    globalConnMap,
    inputProblem: inputProblem as any,
  })

  expect(solver.mspConnectionPairs).toBeDefined()
  expect(solver.chipMap).toBeDefined()
})

test("SchematicTraceLinesSolver solves without error", () => {
  const pipeline = new SchematicTracePipelineSolver(inputProblem as any)
  pipeline.solve()

  const mspSolver = new MspConnectionPairSolver({
    inputProblem: inputProblem as any,
  })
  mspSolver.solve()

  const { dcConnMap, globalConnMap } = getConnectivityMapsFromInputProblem(
    inputProblem as any,
  )

  const solver = new SchematicTraceLinesSolver({
    mspConnectionPairs: mspSolver.mspConnectionPairs,
    chipMap: mspSolver.chipMap,
    dcConnMap,
    globalConnMap,
    inputProblem: inputProblem as any,
  })

  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
})
