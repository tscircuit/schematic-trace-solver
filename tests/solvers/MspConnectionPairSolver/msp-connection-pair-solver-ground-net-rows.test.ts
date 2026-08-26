import { expect, test } from "bun:test"
import { MspConnectionPairSolver } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import type { InputProblem } from "lib/types/InputProblem"
import inputProblemJson from "../../repros/assets/repro-bluetooth-controller-ground-decoupling-groups.input.json"

function solveNetPairs({
  inputProblem,
  netId,
}: {
  inputProblem: InputProblem
  netId: string
}) {
  const netConnection = inputProblem.netConnections.find(
    (connection) => connection.netId === netId,
  )!
  const netPinIds = new Set(netConnection.pinIds)
  const solver = new MspConnectionPairSolver({ inputProblem })

  solver.solve()

  return solver.mspConnectionPairs.filter((pair) =>
    pair.pins.every((pin) => netPinIds.has(pin.pinId)),
  )
}

test("keeps grouped ground rails in separate rows", () => {
  const inputProblem = inputProblemJson as InputProblem
  const groundPairs = solveNetPairs({ inputProblem, netId: "GND" })
  const crossRowPairs = groundPairs.filter(
    (pair) => pair.pins[0].y !== pair.pins[1].y,
  )

  expect(groundPairs).toHaveLength(5)
  expect(crossRowPairs).toHaveLength(0)
})

test("does not separate rows without ground metadata", () => {
  const inputProblem = structuredClone(inputProblemJson) as InputProblem
  const connection = inputProblem.netConnections.find(
    (candidate) => candidate.netId === "GND",
  )!
  connection.isGround = false

  const netPairs = solveNetPairs({ inputProblem, netId: "GND" })
  const crossRowPairs = netPairs.filter(
    (pair) => pair.pins[0].y !== pair.pins[1].y,
  )

  expect(netPairs).toHaveLength(6)
  expect(crossRowPairs).toHaveLength(1)
})
