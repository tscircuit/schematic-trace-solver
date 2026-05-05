import { test, expect } from "bun:test"
import { MspConnectionPairSolver } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
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
