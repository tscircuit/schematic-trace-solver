import { expect, test } from "bun:test"
import { MspConnectionPairSolver } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import type { InputNetConnection, InputProblem } from "lib/types/InputProblem"
import inputProblemJson from "../../repros/assets/repro-bluetooth-controller-ground-decoupling-groups.input.json"

function solveNetPairs({
  inputProblem,
  netConnection,
}: {
  inputProblem: InputProblem
  netConnection: InputNetConnection
}) {
  const netPinIds = new Set(netConnection.pinIds)
  const solver = new MspConnectionPairSolver({ inputProblem })

  solver.solve()

  return solver.mspConnectionPairs.filter((pair) =>
    pair.pins.every((pin) => netPinIds.has(pin.pinId)),
  )
}

test("keeps grouped ground rails in separate rows", () => {
  const inputProblem = inputProblemJson as InputProblem
  const groundConnection = inputProblem.netConnections.find(
    (connection) => connection.isGround,
  )!
  const groundPairs = solveNetPairs({
    inputProblem,
    netConnection: groundConnection,
  })
  const crossRowPairs = groundPairs.filter(
    (pair) => pair.pins[0].y !== pair.pins[1].y,
  )

  expect(groundPairs).toHaveLength(5)
  expect(crossRowPairs).toHaveLength(0)
})

test("does not separate rows without ground metadata", () => {
  const inputProblem = structuredClone(inputProblemJson) as InputProblem
  const groundConnection = inputProblem.netConnections.find(
    (connection) => connection.isGround,
  )!
  groundConnection.isGround = false

  const netPairs = solveNetPairs({
    inputProblem,
    netConnection: groundConnection,
  })
  const crossRowPairs = netPairs.filter(
    (pair) => pair.pins[0].y !== pair.pins[1].y,
  )

  expect(netPairs).toHaveLength(6)
  expect(crossRowPairs).toHaveLength(1)
})
