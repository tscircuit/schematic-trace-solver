import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"

const capacitorPairInput = {
  chips: [
    {
      chipId: "C1",
      center: { x: 2, y: 0 },
      width: 0.5,
      height: 1.1,
      pins: [
        { pinId: "C1.1", x: 2, y: 0.55 },
        { pinId: "C1.2", x: 2, y: -0.55 },
      ],
    },
    {
      chipId: "C2",
      center: { x: 0, y: 0 },
      width: 0.5,
      height: 1.1,
      pins: [
        { pinId: "C2.1", x: 0, y: 0.55 },
        { pinId: "C2.2", x: 0, y: -0.55 },
      ],
    },
  ],
  directConnections: [],
  netConnections: [
    { netId: "GND", pinIds: ["C1.1", "C2.1"], netLabelWidth: 0.3 },
    { netId: "VCC", pinIds: ["C1.2", "C2.2"], netLabelWidth: 0.3 },
  ],
  availableNetLabelOrientations: {
    GND: ["y+"],
    VCC: ["y-"],
  },
  maxMspPairDistance: 5,
}

test("repro61 net-label-only two-pin nets do not create connecting traces", () => {
  const solver = new SchematicTracePipelineSolver(capacitorPairInput as any)

  solver.solve()

  const traces = solver.netLabelTraceCollisionSolver?.getOutput().traces ?? []
  const labels =
    solver.netLabelNetLabelCollisionSolver?.getOutput().netLabelPlacements ?? []

  expect(solver.failed).toBe(false)
  expect(traces).toHaveLength(0)
  expect(labels.map((label) => label.pinIds).sort()).toEqual([
    ["C1.1"],
    ["C1.2"],
    ["C2.1"],
    ["C2.2"],
  ])
})

test("two-pin direct connections still create traces", () => {
  const solver = new SchematicTracePipelineSolver({
    ...capacitorPairInput,
    directConnections: [{ netId: "GND", pinIds: ["C1.1", "C2.1"] }],
    netConnections: [],
  } as any)

  solver.solve()

  const traces = solver.netLabelTraceCollisionSolver?.getOutput().traces ?? []

  expect(solver.failed).toBe(false)
  expect(traces.map((trace) => trace.pinIds).sort()).toEqual([["C1.1", "C2.1"]])
})
