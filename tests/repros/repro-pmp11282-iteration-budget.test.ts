import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputProblemJson from "./assets/repro-pmp11282-isolated-dcdc.input.json"

// Captured from the InputProblem emitted by @tscircuit/core while rendering
// the PMP11282 isolated DC/DC reference schematic.
test("repro PMP11282 completes the trace queue beyond its parent budget", () => {
  const inputProblem: InputProblem = JSON.parse(
    JSON.stringify(inputProblemJson),
  )
  const solver = new SchematicTracePipelineSolver(inputProblem, {
    hideRatsNet: true,
  })

  solver.solve()

  expect(inputProblem.chips).toHaveLength(113)
  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  expect(solver.schematicTraceLinesSolver?.queuedConnectionPairs).toHaveLength(
    0,
  )
  expect(solver.schematicTraceLinesSolver?.iterations).toBeGreaterThan(
    solver.schematicTraceLinesSolver!.MAX_ITERATIONS,
  )
  expect(
    solver.schematicTraceLinesSolver?.iterationsWithoutActiveSubSolver,
  ).toBeLessThanOrEqual(solver.schematicTraceLinesSolver!.MAX_ITERATIONS)
  expect(solver.schematicTraceLinesSolver!).toMatchSolverSnapshot(
    import.meta.path,
  )
}, 15_000)
