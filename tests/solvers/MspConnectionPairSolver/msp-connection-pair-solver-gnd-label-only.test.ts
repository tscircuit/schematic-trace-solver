import { expect, test } from "bun:test"
import { MspConnectionPairSolver } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"

test("GND pins on different chips are not routed together", () => {
  const solver = new MspConnectionPairSolver({
    inputProblem: {
      chips: [
        {
          chipId: "U1",
          center: { x: 0, y: 0 },
          width: 1,
          height: 1,
          pins: [{ pinId: "U1.1", x: 0.2, y: 0 }],
        },
        {
          chipId: "U2",
          center: { x: 0.5, y: 0 },
          width: 1,
          height: 1,
          pins: [{ pinId: "U2.1", x: 0.3, y: 0 }],
        },
      ],
      directConnections: [],
      netConnections: [{ netId: "GND", pinIds: ["U1.1", "U2.1"] }],
      availableNetLabelOrientations: { GND: ["y-"] },
    },
  })

  solver.solve()

  expect(solver.mspConnectionPairs).toHaveLength(0)
})

test("GND pins on the same chip are routed together", () => {
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

  expect(solver.mspConnectionPairs).toHaveLength(1)
  expect(solver.mspConnectionPairs[0]!.userNetId).toBe("GND")
})

test("GND routing forms separate local groups on multiple chips", () => {
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
        {
          chipId: "U2",
          center: { x: 2, y: 0 },
          width: 1,
          height: 1,
          pins: [
            { pinId: "U2.1", x: 1.8, y: 0 },
            { pinId: "U2.2", x: 2.2, y: 0 },
          ],
        },
      ],
      directConnections: [],
      netConnections: [
        { netId: "GND", pinIds: ["U1.1", "U1.2", "U2.1", "U2.2"] },
      ],
      availableNetLabelOrientations: { GND: ["y-"] },
    },
  })

  solver.solve()

  expect(solver.mspConnectionPairs).toHaveLength(2)
  expect(
    solver.mspConnectionPairs.every(
      (pair) => pair.pins[0].chipId === pair.pins[1].chipId,
    ),
  ).toBe(true)
})
