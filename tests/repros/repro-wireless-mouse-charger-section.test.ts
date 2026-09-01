import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "./assets/repro-wireless-mouse-charger-section.input.json"
import "tests/fixtures/matcher"

// Generated from @tscircuit/core 0.0.1817 at commit 45888ed648781adfd34e7078c4d4b336133cbbe9.
// The circuit reproduces the wireless mouse's MCP73831 charger, charge LED
// loop, programming resistor, VBAT capacitor, and protected battery connector.
// The fixture is the solverParams payload emitted by core's solver:started event.
test("repro wireless mouse charger section", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
