import { expect, test } from "bun:test"
import { MspConnectionPairSolver } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import type {
  InputNetConnection,
  InputProblem,
  PinId,
} from "lib/types/InputProblem"
import inputProblemJson from "../../repros/assets/repro-bluetooth-controller-ground-decoupling-groups.input.json"

function cloneInputProblem(): InputProblem {
  return JSON.parse(JSON.stringify(inputProblemJson))
}

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

function expectSeparatedGroundRows({
  removedPinIds,
  expectedPairCount,
}: {
  removedPinIds: PinId[]
  expectedPairCount: number
}) {
  const inputProblem = cloneInputProblem()
  const groundConnection = inputProblem.netConnections.find(
    (connection) => connection.isGround,
  )!
  const removedPinIdSet = new Set(removedPinIds)
  groundConnection.pinIds = groundConnection.pinIds.filter(
    (pinId) => !removedPinIdSet.has(pinId),
  )
  const groundPairs = solveNetPairs({
    inputProblem,
    netConnection: groundConnection,
  })
  const crossRowPairs = groundPairs.filter(
    (pair) => pair.pins[0].y !== pair.pins[1].y,
  )

  expect(groundPairs).toHaveLength(expectedPairCount)
  expect(crossRowPairs).toHaveLength(0)
}

test("keeps grouped ground rails in separate rows", () => {
  expectSeparatedGroundRows({ removedPinIds: [], expectedPairCount: 5 })
})

test("keeps a two-component ground rail separate from another row", () => {
  expectSeparatedGroundRows({
    removedPinIds: ["schematic_port_13"],
    expectedPairCount: 4,
  })
})

test("does not bridge a grouped ground rail through a singleton", () => {
  expectSeparatedGroundRows({
    removedPinIds: ["schematic_port_11", "schematic_port_13"],
    expectedPairCount: 3,
  })
})

test("does not separate rows without ground metadata", () => {
  const inputProblem = cloneInputProblem()
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
