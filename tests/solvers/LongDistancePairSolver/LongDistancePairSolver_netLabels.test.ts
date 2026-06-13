import { test, expect } from "bun:test"
import { LongDistancePairSolver } from "lib/solvers/LongDistancePairSolver/LongDistancePairSolver"
import type { InputProblem } from "lib/types/InputProblem"

const createInputProblem = (): InputProblem => ({
  chips: [
    {
      chipId: "schematic_component_0",
      center: { x: 0, y: 0 },
      width: 1,
      height: 1,
      pins: [{ pinId: "U1.1", x: 0.5, y: 0, _facingDirection: "x+" }],
    },
    {
      chipId: "schematic_component_1",
      center: { x: 2, y: 0 },
      width: 1,
      height: 1,
      pins: [{ pinId: "U2.1", x: 1.5, y: 0, _facingDirection: "x-" }],
    },
  ],
  directConnections: [],
  netConnections: [{ netId: "SIG", pinIds: ["U1.1", "U2.1"] }],
  availableNetLabelOrientations: {},
  maxMspPairDistance: 10,
})

test("LongDistancePairSolver does not route net-label-only pins", () => {
  const solver = new LongDistancePairSolver({
    inputProblem: createInputProblem(),
    alreadySolvedTraces: [],
    primaryMspConnectionPairs: [],
  })

  solver.solve()

  expect(solver.solvedLongDistanceTraces).toHaveLength(0)
})
