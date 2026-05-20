import { expect, test } from "bun:test"
import { MspConnectionPairSolver } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import type { InputProblem } from "lib/types/InputProblem"

const createMixedInputProblem = (): InputProblem => ({
  chips: [
    {
      chipId: "A",
      center: { x: 0, y: 0 },
      width: 1,
      height: 1,
      pins: [
        { pinId: "A.1", x: -0.5, y: 0 },
        { pinId: "A.2", x: 0.5, y: 0 },
      ],
    },
    {
      chipId: "B",
      center: { x: 4, y: 0 },
      width: 1,
      height: 1,
      pins: [{ pinId: "B.1", x: 3.5, y: 0 }],
    },
  ],
  directConnections: [{ pinIds: ["A.1", "A.2"], netId: "SIG" }],
  netConnections: [{ netId: "SIG", pinIds: ["A.1", "B.1"] }],
  availableNetLabelOrientations: { SIG: ["x+", "x-", "y+", "y-"] },
  maxMspPairDistance: 10,
})

test("MspConnectionPairSolver does not pull net-label-only pins into direct routes", () => {
  const solver = new MspConnectionPairSolver({
    inputProblem: createMixedInputProblem(),
  })

  solver.solve()

  expect(solver.mspConnectionPairs).toHaveLength(1)
  expect(
    solver.mspConnectionPairs[0]!.pins.map((pin) => pin.pinId).sort(),
  ).toEqual(["A.1", "A.2"])
})

test("MspConnectionPairSolver does not route pure net-label-only nets", () => {
  const inputProblem = createMixedInputProblem()
  inputProblem.directConnections = []
  inputProblem.netConnections = [{ netId: "SIG", pinIds: ["A.1", "B.1"] }]

  const solver = new MspConnectionPairSolver({ inputProblem })
  solver.solve()

  expect(solver.mspConnectionPairs).toEqual([])
})
