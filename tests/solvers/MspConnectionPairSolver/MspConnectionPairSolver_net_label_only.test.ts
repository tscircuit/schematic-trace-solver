import { expect, test } from "bun:test"
import { getConnectivityMapsFromInputProblem } from "lib/solvers/MspConnectionPairSolver/getConnectivityMapFromInputProblem"
import { MspConnectionPairSolver } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import type { InputProblem } from "lib/types/InputProblem"

const createProblem = ({
  directConnections,
  netConnections,
}: Pick<
  InputProblem,
  "directConnections" | "netConnections"
>): InputProblem => ({
  chips: [
    {
      chipId: "U1",
      center: { x: 0, y: 0 },
      width: 1,
      height: 1,
      pins: [{ pinId: "U1.1", x: 0, y: 0 }],
    },
    {
      chipId: "U2",
      center: { x: 1, y: 0 },
      width: 1,
      height: 1,
      pins: [{ pinId: "U2.1", x: 1, y: 0 }],
    },
    {
      chipId: "U3",
      center: { x: 2, y: 0 },
      width: 1,
      height: 1,
      pins: [{ pinId: "U3.1", x: 2, y: 0 }],
    },
  ],
  directConnections,
  netConnections,
  availableNetLabelOrientations: {},
  maxMspPairDistance: 10,
})

test("global net labels do not mutate the direct connectivity map", () => {
  const { directConnMap, netConnMap } = getConnectivityMapsFromInputProblem(
    createProblem({
      directConnections: [{ pinIds: ["U1.1", "U2.1"], netId: "SIG" }],
      netConnections: [{ pinIds: ["U3.1"], netId: "SIG" }],
    }),
  )

  const directNetId = directConnMap.getNetConnectedToId("SIG")!
  const globalNetId = netConnMap.getNetConnectedToId("SIG")!

  expect(directConnMap.getIdsConnectedToNet(directNetId).sort()).toEqual([
    "SIG",
    "U1.1",
    "U2.1",
  ])
  expect(netConnMap.getIdsConnectedToNet(globalNetId).sort()).toEqual([
    "SIG",
    "U1.1",
    "U2.1",
    "U3.1",
  ])
})

test("MSP solver skips pure net-label-only connectivity", () => {
  const solver = new MspConnectionPairSolver({
    inputProblem: createProblem({
      directConnections: [],
      netConnections: [{ pinIds: ["U1.1", "U2.1"], netId: "SIG" }],
    }),
  })

  solver.solve()

  expect(solver.mspConnectionPairs).toHaveLength(0)
})

test("MSP solver routes direct pins without adding same-net label pins", () => {
  const solver = new MspConnectionPairSolver({
    inputProblem: createProblem({
      directConnections: [{ pinIds: ["U1.1", "U2.1"], netId: "SIG" }],
      netConnections: [{ pinIds: ["U3.1"], netId: "SIG" }],
    }),
  })

  solver.solve()

  expect(solver.mspConnectionPairs.map((pair) => pair.mspPairId)).toEqual([
    "U1.1-U2.1",
  ])
})
