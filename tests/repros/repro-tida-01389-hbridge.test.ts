import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputProblem from "./assets/repro-tida-01389-hbridge.input.json"

// Reduced from the TIDA-01389 H-bridge in tscircuit/ti#116. It retains only
// the four components on the enclosing loop and the two nested capacitors.
test("repro: enclosing rectangle collapses into two smaller loops", () => {
  expect(inputProblem.chips).toHaveLength(6)
  expect(inputProblem.directConnections).toHaveLength(8)
  expect(inputProblem.netConnections).toHaveLength(0)

  const solver = new SchematicTracePipelineSolver(
    inputProblem as unknown as InputProblem,
    { hideRatsNet: true },
  )

  solver.solve()

  const pairKeys = new Set(
    solver.mspConnectionPairSolver!.mspConnectionPairs.map((pair) =>
      pair.pins
        .map((pin) => pin.pinId)
        .sort()
        .join("::"),
    ),
  )
  expect(
    pairKeys.has("schematic_port_q1a_drain::schematic_port_q1b_source"),
  ).toBe(false)
  expect(
    pairKeys.has("schematic_port_q2a_source::schematic_port_q2b_drain"),
  ).toBe(false)
  expect(pairKeys.has("schematic_port_c18_1::schematic_port_q1a_drain")).toBe(
    true,
  )
  expect(pairKeys.has("schematic_port_c18_2::schematic_port_q2b_drain")).toBe(
    true,
  )

  expect(solver.solved).toBe(true)
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
