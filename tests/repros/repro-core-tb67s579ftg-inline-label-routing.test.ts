import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import inputProblem from "./assets/repro-core-tb67s579ftg-inline-label-routing.input.json"
import "tests/fixtures/matcher"

const getPinPair = (pinIds: string[]): [string, string] => {
  if (pinIds.length !== 2) {
    throw new Error(`Expected two pin IDs, received ${pinIds.length}`)
  }

  return [pinIds[0]!, pinIds[1]!]
}

// Captured from @tscircuit/core@12b2ef60's TB67S579FTG breakout repro. The
// anchored-label widths supplied for inline labels must not affect the routed
// traces beside J4.
test("core TB67S579FTG inline label routing", () => {
  const solverInput: InputProblem = {
    ...inputProblem,
    directConnections: inputProblem.directConnections.map((connection) => ({
      ...connection,
      pinIds: getPinPair(connection.pinIds),
    })),
  }
  const solver = new SchematicTracePipelineSolver(solverInput)

  solver.solve()

  expect(
    solver.schematicTraceLinesSolver!.failedConnectionPairs.map(
      (connection) => connection.userNetId,
    ),
  ).toEqual(["AGC_OUT"])
  expect(
    inputProblem.directConnections.find(
      (connection) => connection.netId === "AGC_OUT",
    )?.anchoredNetLabelWidth,
  ).toBe(0.96)
  expect(solver.inlineNetLabelSolver!.stats.pushedAnchoredNetLabelCount).toBe(0)
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
