import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputProblemJson from "./assets/repro-core-usbc-flashlight-long-ground-trace.input.json"

const inputProblem = inputProblemJson as unknown as InputProblem

test("keeps the USB-C flashlight ground connection on local labels", () => {
  const downwardConnection = inputProblem.netConnections.find((connection) => {
    const orientations =
      inputProblem.availableNetLabelOrientations[connection.netId]
    return orientations?.length === 1 && orientations[0] === "y-"
  })!
  const downwardConnectionPinIds = new Set(downwardConnection.pinIds)
  const solver = new SchematicTracePipelineSolver(inputProblem)

  solver.solve()

  const longDownwardTraces =
    solver.longDistancePairSolver!.solvedLongDistanceTraces.filter((trace) =>
      trace.pinIds.every((pinId) => downwardConnectionPinIds.has(pinId)),
    )
  const downwardLabels = solver
    .netLabelNetLabelCollisionSolver!.getOutput()
    .netLabelPlacements.filter((placement) =>
      placement.pinIds.some((pinId) => downwardConnectionPinIds.has(pinId)),
    )

  expect(longDownwardTraces).toHaveLength(0)
  expect(downwardLabels).toHaveLength(2)
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
