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
        { pinId: "L", x: -1, y: 0 }, // left side
        { pinId: "T", x: 0, y: 1 }, // top side
        { pinId: "R", x: 1, y: 0 }, // right side
      ],
    },
  ],
  directConnections: [],
  netConnections: [{ netId: "N1", pinIds: ["L", "T", "R"] }],
  availableNetLabelOrientations: {},
  maxMspPairDistance: 5,
}

test("MspConnectionPairSolver allows indirect cross-chip traces", () => {
  const solver = new MspConnectionPairSolver({ inputProblem })
  solver.solve()
  expect(solver.mspConnectionPairs).toHaveLength(2)
  const pairIds = solver.mspConnectionPairs.map(({ pins }) =>
    pins
      .map((p) => p.pinId)
      .sort()
      .join("-"),
  )
  expect(pairIds).toContain("L-T")
  expect(pairIds).toContain("R-T")
  expect(pairIds).not.toContain("L-R")
})
