import { test, expect } from "bun:test"
import { MspConnectionPairSolver } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import type { InputProblem } from "lib/types/InputProblem"

test("MspConnectionPairSolver_sameNetIdNoMerge", () => {
  const inputProblem: InputProblem = {
    chips: [
      {
        chipId: "U1",
        center: { x: 0, y: 0 },
        width: 1,
        height: 1,
        pins: [{ pinId: "U1.1", x: -0.5, y: 0 }],
      },
      {
        chipId: "U2",
        center: { x: 2, y: 0 },
        width: 1,
        height: 1,
        pins: [{ pinId: "U2.1", x: 1.5, y: 0 }],
      },
      {
        chipId: "U3",
        center: { x: 0, y: 5 },
        width: 1,
        height: 1,
        pins: [{ pinId: "U3.1", x: -0.5, y: 5 }],
      },
      {
        chipId: "U4",
        center: { x: 2, y: 5 },
        width: 1,
        height: 1,
        pins: [{ pinId: "U4.1", x: 1.5, y: 5 }],
      },
    ],
    directConnections: [],
    netConnections: [
      {
        netId: "GND",
        pinIds: ["U1.1", "U2.1"],
      },
      {
        netId: "GND",
        pinIds: ["U3.1", "U4.1"],
      },
    ],
    availableNetLabelOrientations: {},
    maxMspPairDistance: 10,
    obstacles: [],
  }

  const solver = new MspConnectionPairSolver({ inputProblem })
  solver.solve()

  // We expect TWO separate connection pairs: (U1.1, U2.1) and (U3.1, U4.1)
  // NOT a single MST connecting all four (which would have 3 pairs)
  // And definitely not a jump between the two groups.
  expect(solver.mspConnectionPairs.length).toBe(2)
  
  const pairIds = solver.mspConnectionPairs.map(p => p.mspPairId)
  expect(pairIds).toContain("U1.1-U2.1")
  expect(pairIds).toContain("U3.1-U4.1")
})
