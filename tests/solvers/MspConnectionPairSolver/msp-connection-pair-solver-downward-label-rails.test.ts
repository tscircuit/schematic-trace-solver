import { expect, test } from "bun:test"
import { MspConnectionPairSolver } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import type { InputProblem } from "lib/types/InputProblem"
import inputProblemJson from "../../repros/assets/repro-bluetooth-controller-ground-decoupling-groups.input.json"

test("keeps downward-only net label rails in separate rows", () => {
  const inputProblem = inputProblemJson as InputProblem
  const downwardOnlyConnection = inputProblem.netConnections.find(
    (connection) => {
      const orientations =
        inputProblem.availableNetLabelOrientations[connection.netId]
      return orientations?.length === 1 && orientations[0] === "y-"
    },
  )!
  const downwardOnlyPinIds = new Set(downwardOnlyConnection.pinIds)
  const solver = new MspConnectionPairSolver({ inputProblem })

  solver.solve()

  const downwardOnlyPairs = solver.mspConnectionPairs.filter((pair) =>
    pair.pins.every((pin) => downwardOnlyPinIds.has(pin.pinId)),
  )
  const crossRowPairs = downwardOnlyPairs.filter(
    (pair) => pair.pins[0].y !== pair.pins[1].y,
  )

  expect(downwardOnlyPairs).toHaveLength(5)
  expect(crossRowPairs).toHaveLength(0)
})
