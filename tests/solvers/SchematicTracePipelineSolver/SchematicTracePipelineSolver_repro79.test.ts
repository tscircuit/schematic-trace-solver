import type { InputProblem } from "lib/types/InputProblem"
import { test, expect } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/index"

// Full-pipeline reproduction of tscircuit/schematic-trace-solver#79 (repro61 in
// tscircuit/core). Two capacitors are connected ONLY through net labels:
//   - C1.pin1 (top) + C2.pin1 (top) share net "GND"
//   - C1.pin2 (bottom) + C2.pin2 (bottom) share net "VCC"
// There are no direct (wire) connections.
//
// Per the README, net connections must NOT be routed as traces -- net labels
// are placed instead. The bug routed the GND pins (and the VCC pins) to each
// other, producing spurious traces and dropping net labels (the "extra net
// label / remove trace" issue).
//
// A fix that only patches MspConnectionPairSolver is NOT enough: the
// LongDistancePairSolver would then pick up the now-unpaired net-only pins and
// draw the traces anyway. This test exercises the whole pipeline so it can only
// pass if both routing paths leave net-label-only nets alone.
const inputProblem: InputProblem = {
  chips: [
    {
      chipId: "C2",
      center: { x: 0, y: 0 },
      width: 0.5,
      height: 1,
      pins: [
        { pinId: "C2.1", x: 0, y: 0.5 },
        { pinId: "C2.2", x: 0, y: -0.5 },
      ],
    },
    {
      chipId: "C1",
      center: { x: 2, y: 0 },
      width: 0.5,
      height: 1,
      pins: [
        { pinId: "C1.1", x: 2, y: 0.5 },
        { pinId: "C1.2", x: 2, y: -0.5 },
      ],
    },
  ],
  directConnections: [],
  netConnections: [
    { netId: "GND", pinIds: ["C1.1", "C2.1"] },
    { netId: "VCC", pinIds: ["C1.2", "C2.2"] },
  ],
  availableNetLabelOrientations: {
    GND: ["y+"],
    VCC: ["y-"],
  },
  maxMspPairDistance: 2,
}

test("SchematicTracePipelineSolver_repro79: net-label-only nets produce labels, not traces", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem)
  solver.solve()

  expect(solver.solved).toBe(true)

  // No pin-to-pin traces should be drawn for a net-label-only problem.
  const finalTraces = solver
    .netLabelTraceCollisionSolver!.getOutput()
    .traces.filter((t) => (t.pinIds?.length ?? 0) >= 2)
  expect(finalTraces.length).toBe(0)

  // Every pin should instead receive a net label (2x GND + 2x VCC = 4).
  const netLabelPlacements =
    solver.netLabelNetLabelCollisionSolver!.getOutput().netLabelPlacements
  expect(netLabelPlacements.length).toBe(4)

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
