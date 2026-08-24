import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import inputProblem from "./assets/repro-core-tb67s579ftg-inline-label-routing.input.json"
import "tests/fixtures/matcher"

// Captured from @tscircuit/core@12b2ef60's TB67S579FTG breakout repro. The
// fallback widths supplied for inline labels affect the routed traces beside J4.
test("core TB67S579FTG inline label routing", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as InputProblem)

  solver.solve()

  expect(
    solver.schematicTraceLinesSolver!.failedConnectionPairs.map(
      (connection) => connection.userNetId,
    ),
  ).toEqual(["AGC_OUT"])
  expect(
    inputProblem.directConnections.find(
      (connection) => connection.netId === "AGC_OUT",
    )?.fallbackNetLabelWidth,
  ).toBe(0.96)
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
