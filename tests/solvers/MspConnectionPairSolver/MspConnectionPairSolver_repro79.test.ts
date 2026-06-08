import { test, expect } from "bun:test"
import { MspConnectionPairSolver } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import type { InputProblem } from "lib/types/InputProblem"

// Reproduces tscircuit/schematic-trace-solver#79 (repro61 in tscircuit/core).
//
// Two capacitors C1 and C2 are connected ONLY through net labels:
//   - C1.pin1 (top) and C2.pin1 (top) share net "GND"
//   - C1.pin2 (bottom) and C2.pin2 (bottom) share net "VCC"
// There are no direct (wire) connections at all.
//
// Per the README, net connections must NOT be routed as traces -- net labels
// are placed instead. The MspConnectionPairSolver should therefore produce
// zero msp connection pairs (and hence zero traces) for a net-label-only
// problem. The bug routed the GND pins (and VCC pins) to each other, producing
// a spurious trace + an extra net label.
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
    {
      netId: "GND",
      pinIds: ["C1.1", "C2.1"],
    },
    {
      netId: "VCC",
      pinIds: ["C1.2", "C2.2"],
    },
  ],
  availableNetLabelOrientations: {
    GND: ["y+"],
    VCC: ["y-"],
  },
  maxMspPairDistance: 2,
}

test("MspConnectionPairSolver_repro79: net-label-only nets do not produce msp pairs", () => {
  const solver = new MspConnectionPairSolver({ inputProblem })
  solver.solve()

  expect(solver.mspConnectionPairs.length).toBe(0)
})
