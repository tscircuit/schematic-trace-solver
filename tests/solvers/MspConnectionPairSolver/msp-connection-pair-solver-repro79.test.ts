import { expect, test } from "bun:test"
import { MspConnectionPairSolver } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import type { InputProblem } from "lib/types/InputProblem"

const makeInputProblem = (
  directConnections: InputProblem["directConnections"],
  netConnections: InputProblem["netConnections"],
): InputProblem => ({
  chips: [
    {
      chipId: "C1",
      center: { x: 0, y: 0 },
      width: 0.5,
      height: 1,
      pins: [
        { pinId: "C1.1", x: 0, y: 0.25 },
        { pinId: "C1.2", x: 0, y: -0.25 },
      ],
    },
    {
      chipId: "C2",
      center: { x: 0.8, y: 0 },
      width: 0.5,
      height: 1,
      pins: [
        { pinId: "C2.1", x: 0.8, y: 0.25 },
        { pinId: "C2.2", x: 0.8, y: -0.25 },
      ],
    },
    {
      chipId: "C3",
      center: { x: 1.6, y: 0 },
      width: 0.5,
      height: 1,
      pins: [
        { pinId: "C3.1", x: 1.6, y: 0.25 },
        { pinId: "C3.2", x: 1.6, y: -0.25 },
      ],
    },
  ],
  directConnections,
  netConnections,
  availableNetLabelOrientations: {
    GND: ["x+"],
    VCC: ["x+"],
  },
})

test("does not create MSP pairs for net-label-only nets", () => {
  const solver = new MspConnectionPairSolver({
    inputProblem: makeInputProblem(
      [],
      [
        { netId: "GND", pinIds: ["C1.1", "C2.1"] },
        { netId: "VCC", pinIds: ["C1.2", "C2.2"] },
      ],
    ),
  })

  solver.solve()

  expect(solver.mspConnectionPairs).toHaveLength(0)
})

test("does not pull net-labeled-only pins into direct-route MSP pairs", () => {
  const solver = new MspConnectionPairSolver({
    inputProblem: makeInputProblem(
      [{ netId: "GND", pinIds: ["C1.1", "C2.1"] }],
      [{ netId: "GND", pinIds: ["C1.1", "C2.1", "C3.1"] }],
    ),
  })

  solver.solve()

  expect(solver.mspConnectionPairs).toHaveLength(1)
  expect(solver.mspConnectionPairs[0]!.pins.map((pin) => pin.pinId)).toEqual([
    "C1.1",
    "C2.1",
  ])
})
