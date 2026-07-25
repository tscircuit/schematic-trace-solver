import { expect, test } from "bun:test"
import { MspConnectionPairSolver } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"

test("GND net connections are represented by labels instead of routed pairs", () => {
  const solver = new MspConnectionPairSolver({
    inputProblem: {
      chips: [
        {
          chipId: "U1",
          center: { x: 0, y: 0 },
          width: 1,
          height: 1,
          pins: [
            { pinId: "U1.1", x: -0.2, y: 0 },
            { pinId: "U1.2", x: 0.2, y: 0 },
          ],
        },
      ],
      directConnections: [],
      netConnections: [{ netId: "GND", pinIds: ["U1.1", "U1.2"] }],
      availableNetLabelOrientations: { GND: ["y-"] },
    },
  })

  solver.solve()

  expect(solver.mspConnectionPairs).toHaveLength(0)
})
