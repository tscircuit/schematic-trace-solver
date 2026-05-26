import { test, expect } from "bun:test"
import { LongDistancePairSolver } from "lib/solvers/LongDistancePairSolver/LongDistancePairSolver"
import {
  getConnectivityMapsFromInputProblem,
  isGlobalNetHandledByLabels,
} from "lib/solvers/MspConnectionPairSolver/getConnectivityMapFromInputProblem"
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
  availableNetLabelOrientations: {
    GND: ["x+"],
  },
  maxMspPairDistance: 10,
})

const createMixedDirectAndLabelAliasProblem = (): InputProblem => ({
  chips: [
    {
      chipId: "U1",
      center: { x: 0, y: 0 },
      width: 1,
      height: 1,
      pins: [{ pinId: "U1.1", x: 0.5, y: 0, _facingDirection: "x+" }],
    },
    {
      chipId: "U2",
      center: { x: 3, y: 0 },
      width: 1,
      height: 1,
      pins: [{ pinId: "U2.1", x: 2.5, y: 0, _facingDirection: "x-" }],
    },
    {
      chipId: "TP1",
      center: { x: 6, y: 0 },
      width: 1,
      height: 1,
      pins: [{ pinId: "TP1.1", x: 5.5, y: 0, _facingDirection: "x-" }],
    },
  ],
  directConnections: [{ netId: "VCC", pinIds: ["U1.1", "U2.1"] }],
  netConnections: [{ netId: "VCC_LABEL", pinIds: ["U2.1", "TP1.1"] }],
  availableNetLabelOrientations: {
    VCC_LABEL: ["x+"],
  },
  maxMspPairDistance: 10,
})

test("netConnections do not mutate direct connectivity map", () => {
  const { directConnMap, netConnMap } = getConnectivityMapsFromInputProblem(
    createNetLabelOnlyProblem(),
  )

  expect(Object.keys(directConnMap.netMap)).toHaveLength(0)
  const globalNetId = netConnMap.getNetConnectedToId("R1.1")
  expect(globalNetId).toBeDefined()
  expect(
    netConnMap
      .getIdsConnectedToNet(globalNetId!)
      .filter((id) => id !== "GND")
      .sort(),
  ).toEqual(["R1.1", "R2.1"])
})

test("MSP solver does not create physical pairs for net-label-only pins", () => {
  const solver = new MspConnectionPairSolver({
    inputProblem: createNetLabelOnlyProblem(),
  })

  solver.solve()

  expect(solver.mspConnectionPairs).toHaveLength(0)
})

test("long distance solver does not route net-label-only pins", () => {
  const solver = new LongDistancePairSolver({
    inputProblem: createNetLabelOnlyProblem(),
    alreadySolvedTraces: [],
    primaryMspConnectionPairs: [],
  })

  solver.solve()

  expect(solver.getOutput().newTraces).toHaveLength(0)
})

test("label-enabled aliases do not mark a directly routed global net as label-only", () => {
  const inputProblem = createMixedDirectAndLabelAliasProblem()
  const { netConnMap } = getConnectivityMapsFromInputProblem(inputProblem)
  const globalNetId = netConnMap.getNetConnectedToId("U1.1")!

  expect(
    isGlobalNetHandledByLabels(inputProblem, netConnMap, globalNetId),
  ).toBe(false)
  expect(
    isGlobalNetHandledByLabels(inputProblem, netConnMap, "VCC_LABEL"),
  ).toBe(true)
})
