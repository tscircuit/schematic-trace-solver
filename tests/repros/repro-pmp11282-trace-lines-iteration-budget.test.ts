import { expect, test } from "bun:test"
import { SchematicTraceLinesSolver } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputProblemJson from "./assets/repro-pmp11282-isolated-dcdc.input.json"

const expensivePairIds = new Set([
  "schematic_port_169-schematic_port_255",
  "schematic_port_65-schematic_port_137",
  "schematic_port_170-schematic_port_136",
  "schematic_port_58-schematic_port_141",
  "schematic_port_267-schematic_port_180",
  "schematic_port_225-schematic_port_114",
])

const cloneInputProblem = (): InputProblem =>
  JSON.parse(JSON.stringify(inputProblemJson))

test("PMP11282 trace-line parent budgets for all six children", () => {
  const pipeline = new SchematicTracePipelineSolver(cloneInputProblem(), {
    hideRatsNet: true,
  })
  pipeline.solveUntilPhase("schematicTraceLinesSolver")
  pipeline.step()

  const fullTraceSolver = pipeline.schematicTraceLinesSolver!
  const expensivePairs = fullTraceSolver.mspConnectionPairs.filter((pair) =>
    expensivePairIds.has(pair.mspPairId),
  )
  const solver = new SchematicTraceLinesSolver({
    inputProblem: fullTraceSolver.inputProblem,
    mspConnectionPairs: expensivePairs,
    chipMap: fullTraceSolver.chipMap,
    dcConnMap: fullTraceSolver.dcConnMap,
    globalConnMap: fullTraceSolver.globalConnMap,
  })

  solver.solve()

  expect(expensivePairs).toHaveLength(6)
  expect(solver.MAX_ITERATIONS).toBe(600_013)
  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  expect(solver.error).toBeNull()
  expect(solver.failedConnectionPairs).toHaveLength(6)
  expect(solver.queuedConnectionPairs).toHaveLength(0)
  expect(solver.iterations).toBeLessThan(solver.MAX_ITERATIONS)
  expect(solver).toMatchSolverSnapshot(import.meta.path)
}, 30_000)
