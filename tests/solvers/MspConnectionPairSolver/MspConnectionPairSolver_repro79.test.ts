import { expect, test } from "bun:test"
import { MspConnectionPairSolver } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import type { InputProblem } from "lib/types/InputProblem"

const createRepro61LabelOnlyProblem = (): InputProblem => ({
  chips: [
    {
      chipId: "C1",
      center: { x: 0, y: 0 },
      width: 0.6,
      height: 1,
      pins: [
        { pinId: "C1.1", x: 0, y: 0.5, _facingDirection: "y+" },
        { pinId: "C1.2", x: 0, y: -0.5, _facingDirection: "y-" },
      ],
    },
    {
      chipId: "C2",
      center: { x: 1.5, y: 0 },
      width: 0.6,
      height: 1,
      pins: [
        { pinId: "C2.1", x: 1.5, y: 0.5, _facingDirection: "y+" },
        { pinId: "C2.2", x: 1.5, y: -0.5, _facingDirection: "y-" },
      ],
    },
  ],
  directConnections: [],
  netConnections: [
    { netId: "VCC", pinIds: ["C1.1", "C2.1"] },
    { netId: "GND", pinIds: ["C1.2", "C2.2"] },
  ],
  availableNetLabelOrientations: {
    VCC: ["y+"],
    GND: ["y-"],
  },
  maxMspPairDistance: 10,
})

test("MspConnectionPairSolver_repro79 skips net-label-only nets", () => {
  const solver = new MspConnectionPairSolver({
    inputProblem: createRepro61LabelOnlyProblem(),
  })

  solver.solve()

  expect(solver.mspConnectionPairs).toHaveLength(0)
  expect(solver.queuedDcNetIds).toHaveLength(0)
})

test("MspConnectionPairSolver_repro79 keeps direct traces separate from same-name net labels", () => {
  const inputProblem = createRepro61LabelOnlyProblem()
  inputProblem.directConnections = [{ netId: "VCC", pinIds: ["C1.1", "C2.1"] }]
  inputProblem.netConnections = [{ netId: "VCC", pinIds: ["C1.1", "C1.2"] }]
  inputProblem.availableNetLabelOrientations = { VCC: ["y+"] }

  const solver = new MspConnectionPairSolver({ inputProblem })
  solver.solve()

  expect(solver.mspConnectionPairs).toHaveLength(1)
  expect(solver.mspConnectionPairs[0]!.pins.map((pin) => pin.pinId)).toEqual([
    "C1.1",
    "C2.1",
  ])
})
