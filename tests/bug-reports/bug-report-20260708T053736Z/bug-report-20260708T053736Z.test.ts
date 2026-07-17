import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type {
  InputDirectConnection,
  InputProblem,
} from "lib/types/InputProblem"
import inputProblemJson from "./bug-report-20260708T053736Z.json"
import "tests/fixtures/matcher"

const inputProblem: InputProblem = {
  ...inputProblemJson,
  directConnections: inputProblemJson.directConnections.map(
    (directConnection): InputDirectConnection => ({
      ...directConnection,
      pinIds: [directConnection.pinIds[0]!, directConnection.pinIds[1]!],
    }),
  ),
}

test("bug-report-20260708T053736Z", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem)

  solver.solve()

  expect(
    solver.schematicTraceLinesSolver!.solvedTracePaths.some(
      (trace) =>
        trace.pinIds.includes("L1.2") && trace.pinIds.includes("R1.1"),
    ),
  ).toBeTrue()
  expect(
    solver.schematicTraceLinesSolver!.failedConnectionPairs.some(
      (pair) =>
        pair.pins.some((pin) => pin.pinId === "L1.2") &&
        pair.pins.some((pin) => pin.pinId === "R1.1"),
    ),
  ).toBeFalse()
  expect(
    solver.netLabelNetLabelCollisionSolver!.outputNetLabelPlacements.some(
      (label) =>
        label.pinIds.includes("L1.2") || label.pinIds.includes("R1.1"),
    ),
  ).toBeFalse()
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
