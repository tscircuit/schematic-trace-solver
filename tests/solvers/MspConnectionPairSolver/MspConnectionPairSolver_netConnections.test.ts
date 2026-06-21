import { expect, test } from "bun:test"
import { LongDistancePairSolver } from "lib/solvers/LongDistancePairSolver/LongDistancePairSolver"
import { getConnectivityMapsFromInputProblem } from "lib/solvers/MspConnectionPairSolver/getConnectivityMapFromInputProblem"
import { MspConnectionPairSolver } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import type { InputProblem } from "lib/types/InputProblem"

const createNetLabelOnlyProblem = (): InputProblem => ({
  chips: [
    {
      chipId: "R1",
      center: { x: 0, y: 0 },
      width: 1,
      height: 1,
      pins: [{ pinId: "R1.1", x: 0.5, y: 0, _facingDirection: "x+" }],
    },
    {
      chipId: "R2",
      center: { x: 3, y: 0 },
      width: 1,
      height: 1,
      pins: [{ pinId: "R2.1", x: 2.5, y: 0, _facingDirection: "x-" }],
    },
  ],
  directConnections: [],
  netConnections: [{ netId: "GND", pinIds: ["R1.1", "R2.1"] }],
  availableNetLabelOrientations: { GND: ["x+"] },
  maxMspPairDistance: 10,
})

test("net-label connections do not mutate direct connectivity", () => {
  const { directConnMap, netConnMap } = getConnectivityMapsFromInputProblem(
    createNetLabelOnlyProblem(),
  )

  expect(Object.keys(directConnMap.netMap)).toHaveLength(0)
  expect(netConnMap.getNetConnectedToId("R1.1")).toBeDefined()
  expect(netConnMap.getNetConnectedToId("R2.1")).toBeDefined()
})

test("net-label-only pins do not create a primary physical trace pair", () => {
  const solver = new MspConnectionPairSolver({
    inputProblem: createNetLabelOnlyProblem(),
  })

  solver.solve()

  expect(solver.mspConnectionPairs).toHaveLength(0)
})

test("net-label-only pins do not create a long-distance trace", () => {
  const solver = new LongDistancePairSolver({
    inputProblem: createNetLabelOnlyProblem(),
    alreadySolvedTraces: [],
    primaryMspConnectionPairs: [],
  })

  solver.solve()

  expect(solver.getOutput().newTraces).toHaveLength(0)
})
