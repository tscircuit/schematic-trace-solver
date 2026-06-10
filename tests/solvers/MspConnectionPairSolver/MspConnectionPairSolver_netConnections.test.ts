import { expect, test } from "bun:test"
import { getConnectivityMapsFromInputProblem } from "lib/solvers/MspConnectionPairSolver/getConnectivityMapFromInputProblem"
import { MspConnectionPairSolver } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import type { InputProblem } from "lib/types/InputProblem"

const createThreePinProblem = (): InputProblem => ({
  chips: [
    {
      chipId: "A",
      center: { x: 0, y: 0 },
      width: 0.2,
      height: 0.2,
      pins: [{ pinId: "A.1", x: 0, y: 0 }],
    },
    {
      chipId: "B",
      center: { x: 1, y: 0 },
      width: 0.2,
      height: 0.2,
      pins: [{ pinId: "B.1", x: 1, y: 0 }],
    },
    {
      chipId: "C",
      center: { x: 2, y: 0 },
      width: 0.2,
      height: 0.2,
      pins: [{ pinId: "C.1", x: 2, y: 0 }],
    },
  ],
  directConnections: [],
  netConnections: [],
  availableNetLabelOrientations: {},
  maxMspPairDistance: 10,
})

test("net connections do not mutate the direct connectivity map", () => {
  const inputProblem = createThreePinProblem()
  inputProblem.directConnections = [{ pinIds: ["A.1", "B.1"], netId: "SIG" }]
  inputProblem.netConnections = [{ netId: "SIG", pinIds: ["C.1"] }]

  const { directConnMap, netConnMap } =
    getConnectivityMapsFromInputProblem(inputProblem)
  const directNetId = directConnMap.getNetConnectedToId("A.1")!
  const globalNetId = netConnMap.getNetConnectedToId("A.1")!

  expect([...directConnMap.getIdsConnectedToNet(directNetId)].sort()).toEqual([
    "A.1",
    "B.1",
    "SIG",
  ])
  expect([...netConnMap.getIdsConnectedToNet(globalNetId)].sort()).toEqual([
    "A.1",
    "B.1",
    "C.1",
    "SIG",
  ])
})

test("MSP solver does not route pure net-label-only connections", () => {
  const inputProblem = createThreePinProblem()
  inputProblem.netConnections = [{ netId: "SIG", pinIds: ["A.1", "B.1"] }]

  const solver = new MspConnectionPairSolver({ inputProblem })
  solver.solve()

  expect(solver.mspConnectionPairs).toHaveLength(0)
})

test("MSP solver routes only directly connected pins on a mixed direct and net-label net", () => {
  const inputProblem = createThreePinProblem()
  inputProblem.directConnections = [{ pinIds: ["A.1", "B.1"], netId: "SIG" }]
  inputProblem.netConnections = [{ netId: "SIG", pinIds: ["C.1"] }]

  const solver = new MspConnectionPairSolver({ inputProblem })
  solver.solve()

  expect(solver.mspConnectionPairs).toHaveLength(1)
  expect(
    solver.mspConnectionPairs[0]!.pins.map((pin) => pin.pinId).sort(),
  ).toEqual(["A.1", "B.1"])
})
