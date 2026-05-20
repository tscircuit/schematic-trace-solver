import { expect, test } from "bun:test"
import { LongDistancePairSolver } from "lib/solvers/LongDistancePairSolver/LongDistancePairSolver"
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
        { pinId: "A.1", x: -0.5, y: 0, _facingDirection: "x-" },
        { pinId: "A.2", x: 0.5, y: 0, _facingDirection: "x+" },
      ],
    },
    {
      chipId: "B",
      center: { x: 4, y: 0 },
      width: 1,
      height: 1,
      pins: [{ pinId: "B.1", x: 3.5, y: 0, _facingDirection: "x-" }],
    },
  ],
  directConnections: [{ pinIds: ["A.1", "A.2"], netId: "SIG" }],
  netConnections: [{ netId: "SIG", pinIds: ["A.1", "B.1"] }],
  availableNetLabelOrientations: { SIG: ["x+", "x-", "y+", "y-"] },
  maxMspPairDistance: 10,
})

test("LongDistancePairSolver does not route pins connected only through net labels", () => {
  const inputProblem = createMixedInputProblem()
  const mspSolver = new MspConnectionPairSolver({ inputProblem })
  mspSolver.solve()

  const solver = new LongDistancePairSolver({
    inputProblem,
    alreadySolvedTraces: [],
    primaryMspConnectionPairs: mspSolver.mspConnectionPairs,
  })
  solver.solve()

  expect(solver.solvedLongDistanceTraces).toEqual([])
})

test("LongDistancePairSolver does not route pure net-label-only nets", () => {
  const inputProblem = createMixedInputProblem()
  inputProblem.directConnections = []
  inputProblem.netConnections = [{ netId: "SIG", pinIds: ["A.1", "B.1"] }]

  const solver = new LongDistancePairSolver({
    inputProblem,
    alreadySolvedTraces: [],
    primaryMspConnectionPairs: [],
  })
  solver.solve()

  expect(solver.solvedLongDistanceTraces).toEqual([])
})
