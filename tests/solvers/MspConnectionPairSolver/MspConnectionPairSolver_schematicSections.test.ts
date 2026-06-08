import { test, expect } from "bun:test"
import { LongDistancePairSolver } from "lib/solvers/LongDistancePairSolver/LongDistancePairSolver"
import { MspConnectionPairSolver } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import { getConnectivityMapsFromInputProblem } from "lib/solvers/MspConnectionPairSolver/getConnectivityMapFromInputProblem"
import { NetLabelPlacementSolver } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import { visualizeInputProblem } from "lib/solvers/SchematicTracePipelineSolver/visualizeInputProblem"
import type { InputProblem } from "lib/types/InputProblem"

const createInputProblem = (): InputProblem => ({
  chips: [
    {
      chipId: "schematic_component_0",
      center: { x: 0, y: 0 },
      width: 1,
      height: 1,
      sectionId: "section-a",
      pins: [{ pinId: "U1.1", x: 0.5, y: 0, _facingDirection: "x+" }],
    },
    {
      chipId: "schematic_component_1",
      center: { x: 2, y: 0 },
      width: 1,
      height: 1,
      sectionId: "section-b",
      pins: [{ pinId: "U2.1", x: 1.5, y: 0, _facingDirection: "x-" }],
    },
  ],
  directConnections: [{ pinIds: ["U1.1", "U2.1"], netId: "SIG" }],
  netConnections: [],
  availableNetLabelOrientations: {},
  maxMspPairDistance: 10,
})

test("MspConnectionPairSolver skips pairs between different schematic sections", () => {
  const solver = new MspConnectionPairSolver({
    inputProblem: createInputProblem(),
  })

  solver.solve()

  expect(solver.mspConnectionPairs).toHaveLength(0)
})

test("cross-section skipped trace is replaced by port net labels", () => {
  const inputProblem = createInputProblem()
  const solver = new NetLabelPlacementSolver({
    inputProblem,
    inputTraceMap: {},
  })

  solver.solve()

  expect(solver.netLabelPlacements).toHaveLength(2)
  expect(solver.netLabelPlacements.map((p) => p.pinIds[0]).sort()).toEqual([
    "U1.1",
    "U2.1",
  ])
  expect(solver.netLabelPlacements.every((p) => p.netId === "SIG")).toBe(true)
})

test("cross-section input connections are not visualized as future traces", () => {
  const directConnectionProblem = createInputProblem()
  expect(visualizeInputProblem(directConnectionProblem).lines).toHaveLength(0)

  const netConnectionProblem = createInputProblem()
  netConnectionProblem.directConnections = []
  netConnectionProblem.netConnections = [
    { netId: "SIG", pinIds: ["U1.1", "U2.1"] },
  ]

  expect(visualizeInputProblem(netConnectionProblem).lines).toHaveLength(0)
})

const createNetLabelOnlyInputProblem = (): InputProblem => ({
  chips: [
    {
      chipId: "schematic_component_0",
      center: { x: 0, y: 0 },
      width: 1,
      height: 1,
      pins: [{ pinId: "U1.1", x: 0.5, y: 0, _facingDirection: "x+" }],
    },
    {
      chipId: "schematic_component_1",
      center: { x: 2, y: 0 },
      width: 1,
      height: 1,
      pins: [{ pinId: "U2.1", x: 1.5, y: 0, _facingDirection: "x-" }],
    },
  ],
  directConnections: [],
  netConnections: [{ netId: "SIG", pinIds: ["U1.1", "U2.1"] }],
  availableNetLabelOrientations: {
    SIG: ["x+", "x-"],
  },
  maxMspPairDistance: 10,
})

test("net-label-only connections do not mutate direct connectivity", () => {
  const { directConnMap, netConnMap } = getConnectivityMapsFromInputProblem(
    createNetLabelOnlyInputProblem(),
  )

  expect(Object.keys(directConnMap.netMap)).toHaveLength(0)
  const netId = netConnMap.getNetConnectedToId("U1.1")
  expect(netConnMap.getIdsConnectedToNet(netId!)).toEqual([
    "SIG",
    "U1.1",
    "U2.1",
  ])
})

test("net connections do not extend the direct connectivity map", () => {
  const { directConnMap, netConnMap } = getConnectivityMapsFromInputProblem({
    ...createInputProblem(),
    chips: [
      ...createInputProblem().chips,
      {
        chipId: "schematic_component_2",
        center: { x: 4, y: 0 },
        width: 1,
        height: 1,
        pins: [{ pinId: "U3.1", x: 3.5, y: 0, _facingDirection: "x-" }],
      },
    ],
    netConnections: [{ netId: "SIG", pinIds: ["U3.1"] }],
  })

  const directNetId = directConnMap.getNetConnectedToId("U1.1")
  expect(directConnMap.getIdsConnectedToNet(directNetId!)).toEqual([
    "SIG",
    "U1.1",
    "U2.1",
  ])

  const globalNetId = netConnMap.getNetConnectedToId("U1.1")
  expect(netConnMap.getIdsConnectedToNet(globalNetId!)).toEqual([
    "SIG",
    "U1.1",
    "U2.1",
    "U3.1",
  ])
})

test("MspConnectionPairSolver does not physically route two-pin net-label-only nets", () => {
  const solver = new MspConnectionPairSolver({
    inputProblem: createNetLabelOnlyInputProblem(),
  })

  solver.solve()

  expect(solver.mspConnectionPairs).toHaveLength(0)
})

test("LongDistancePairSolver does not queue two-pin net-label-only pairs", () => {
  const solver = new LongDistancePairSolver({
    inputProblem: createNetLabelOnlyInputProblem(),
    primaryMspConnectionPairs: [],
    alreadySolvedTraces: [],
  })

  expect((solver as any).queuedCandidatePairs).toHaveLength(0)
})
