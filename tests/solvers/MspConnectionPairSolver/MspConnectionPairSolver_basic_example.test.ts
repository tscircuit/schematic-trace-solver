import { MspConnectionPairSolver } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import type { InputProblem } from "lib/types/InputProblem"
import { test, expect } from "bun:test"

const inputProblem: InputProblem = {
  chips: [
    {
      chipId: "chip",
      center: { x: 0, y: 0 },
      width: 2,
      height: 2,
      pins: [
        { pinId: "A", x: -1, y: 0.5 },
        { pinId: "B", x: -1, y: -0.5 },
      ],
    },
  ],
  directConnections: [],
  netConnections: [{ netId: "N1", pinIds: ["A", "B"] }],
  availableNetLabelOrientations: {},
  maxMspPairDistance: 5,
}

test("MspConnectionPairSolver basic MSP pair", () => {
  const solver = new MspConnectionPairSolver({ inputProblem })
  solver.solve()
  expect(solver.mspConnectionPairs).toHaveLength(1)
  const [pair] = solver.mspConnectionPairs
  const ids = pair.pins.map((p) => p.pinId).sort()
  expect(ids).toEqual(["A", "B"])
})
