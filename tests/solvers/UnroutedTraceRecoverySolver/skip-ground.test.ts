import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "tests/assets/example12.json"

test("does not recover unrouted GND connection pairs", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  expect(
    solver.schematicTraceLinesSolver!.failedConnectionPairs.some(
      (connectionPair) => connectionPair.userNetId === "GND",
    ),
  ).toBe(true)
  expect(
    solver.unroutedTraceRecoverySolver!.solvedUnroutedTraces.some(
      (trace) => trace.userNetId === "GND",
    ),
  ).toBe(false)
})
