import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputProblem from "./assets/repro-tida-01389-hbridge.input.json"

// Captured from the TIDA-01389 H-bridge in tscircuit/ti#116. Only display
// metadata was normalized; component positions and connectivity are unchanged.
test("repro: TIDA-01389 H-bridge traces float above MOSFET ports", () => {
  expect(inputProblem.chips).toHaveLength(18)
  expect(inputProblem.directConnections).toHaveLength(21)
  expect(inputProblem.netConnections).toHaveLength(11)

  const solver = new SchematicTracePipelineSolver(
    inputProblem as unknown as InputProblem,
    { hideRatsNet: true },
  )

  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
