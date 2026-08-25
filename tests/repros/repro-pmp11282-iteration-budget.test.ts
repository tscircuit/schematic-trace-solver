import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputProblemJson from "./assets/repro-pmp11282-isolated-dcdc.input.json"

// Captured from the InputProblem emitted by @tscircuit/core while rendering
// the PMP11282 isolated DC/DC reference schematic.
test("repro PMP11282 exhausts the parent trace budget with pairs queued", () => {
  const inputProblem: InputProblem = JSON.parse(
    JSON.stringify(inputProblemJson),
  )
  const solver = new SchematicTracePipelineSolver(inputProblem, {
    hideRatsNet: true,
  })

  solver.solve()

  expect(inputProblem.chips).toHaveLength(113)
  expect(solver.failed).toBe(true)
  expect(solver.error).toBe("SchematicTraceLinesSolver ran out of iterations")
  expect(solver.schematicTraceLinesSolver?.queuedConnectionPairs).toHaveLength(
    22,
  )
  expect(solver.schematicTraceLinesSolver!).toMatchSolverSnapshot(
    import.meta.path,
  )
})
