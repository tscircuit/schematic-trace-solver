import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import "tests/fixtures/matcher"
import inputProblem from "./assets/repro-mcp73831-charger-traces.input.json"

// Captured from @tscircuit/core 0.0.1829 at commit b761dc8.
// The source circuit contains only the MCP73831 charger, its programming
// resistor, VBAT capacitor, and their external net connections.
test("repro MCP73831 charger traces", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
