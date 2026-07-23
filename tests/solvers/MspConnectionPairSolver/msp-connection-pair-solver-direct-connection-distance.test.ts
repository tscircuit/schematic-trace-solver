import { expect, test } from "bun:test"
import { MspConnectionPairSolver } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import type { InputProblem } from "lib/types/InputProblem"

const createInputProblem = (): InputProblem => ({
  chips: [
    {
      chipId: "U1",
      center: { x: 0, y: 0 },
      width: 1,
      height: 1,
      pins: [{ pinId: "U1.1", x: 0, y: 0, _facingDirection: "x+" }],
    },
    {
      chipId: "U2",
      center: { x: 2, y: 2 },
      width: 1,
      height: 1,
      pins: [{ pinId: "U2.1", x: 2, y: 2, _facingDirection: "x-" }],
    },
  ],
  directConnections: [{ pinIds: ["U1.1", "U2.1"] }],
  netConnections: [],
  availableNetLabelOrientations: {},
  maxMspPairDistance: 3,
})

test("two-pin direct connections use Euclidean max distance", () => {
  const directConnectionSolver = new MspConnectionPairSolver({
    inputProblem: createInputProblem(),
  })
  directConnectionSolver.solve()

  const netConnectionProblem = createInputProblem()
  netConnectionProblem.directConnections = []
  netConnectionProblem.netConnections = [
    { pinIds: ["U1.1", "U2.1"], netId: "SIG" },
  ]
  const netConnectionSolver = new MspConnectionPairSolver({
    inputProblem: netConnectionProblem,
  })
  netConnectionSolver.solve()

  expect(directConnectionSolver.mspConnectionPairs).toHaveLength(1)
  expect(netConnectionSolver.mspConnectionPairs).toHaveLength(0)
})
