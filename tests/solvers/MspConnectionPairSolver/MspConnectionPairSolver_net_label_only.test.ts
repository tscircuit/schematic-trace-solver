import { expect, test } from "bun:test"
import { MspConnectionPairSolver } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import type { InputProblem } from "lib/types/InputProblem"

test("does not route pins connected only by net labels", () => {
  const inputProblem: InputProblem = {
    chips: [
      {
        chipId: "C1",
        center: { x: 0, y: 0 },
        width: 0.5,
        height: 1,
        pins: [
          { pinId: "C1.1", x: 0, y: 0.5 },
          { pinId: "C1.2", x: 0, y: -0.5 },
        ],
      },
      {
        chipId: "C2",
        center: { x: 1, y: 0 },
        width: 0.5,
        height: 1,
        pins: [
          { pinId: "C2.1", x: 1, y: 0.5 },
          { pinId: "C2.2", x: 1, y: -0.5 },
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
  }

  const solver = new MspConnectionPairSolver({ inputProblem })
  solver.solve()

  expect(solver.mspConnectionPairs).toEqual([])
})

test("does not pull net-label-only pins into direct-wire pairs", () => {
  const inputProblem: InputProblem = {
    chips: [
      {
        chipId: "U1",
        center: { x: 0, y: 0 },
        width: 1,
        height: 1,
        pins: [
          { pinId: "U1.1", x: -0.5, y: 0 },
          { pinId: "U1.2", x: 0.5, y: 0 },
        ],
      },
      {
        chipId: "C1",
        center: { x: 1, y: 0 },
        width: 0.5,
        height: 1,
        pins: [{ pinId: "C1.1", x: 1, y: 0 }],
      },
    ],
    directConnections: [{ pinIds: ["U1.1", "U1.2"], netId: "VCC" }],
    netConnections: [{ netId: "VCC", pinIds: ["U1.1", "C1.1"] }],
    availableNetLabelOrientations: {
      VCC: ["x+", "x-", "y+", "y-"],
    },
  }

  const solver = new MspConnectionPairSolver({ inputProblem })
  solver.solve()

  expect(solver.mspConnectionPairs).toHaveLength(1)
  expect(solver.mspConnectionPairs[0]!.pins.map((pin) => pin.pinId)).toEqual([
    "U1.1",
    "U1.2",
  ])
})
