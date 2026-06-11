import { expect, test } from "bun:test"
import { LongDistancePairSolver } from "lib/solvers/LongDistancePairSolver/LongDistancePairSolver"
import type { InputProblem } from "lib/types/InputProblem"

const createInputProblem = (
  connectionType: "direct" | "net",
): InputProblem => ({
  chips: [
    {
      chipId: "schematic_component_0",
      center: { x: -2, y: 0 },
      width: 1,
      height: 1,
      pins: [{ pinId: "U1.1", x: -1.5, y: 0, _facingDirection: "x+" }],
    },
    {
      chipId: "schematic_component_1",
      center: { x: 2, y: 0 },
      width: 1,
      height: 1,
      pins: [{ pinId: "U2.1", x: 1.5, y: 0, _facingDirection: "x-" }],
    },
  ],
  directConnections:
    connectionType === "direct"
      ? [{ netId: "SIG", pinIds: ["U1.1", "U2.1"] }]
      : [],
  netConnections:
    connectionType === "net"
      ? [{ netId: "SIG", pinIds: ["U1.1", "U2.1"] }]
      : [],
  availableNetLabelOrientations: {},
  maxMspPairDistance: 1,
})

test("LongDistancePairSolver does not route net-label-only connections", () => {
  const solver = new LongDistancePairSolver({
    inputProblem: createInputProblem("net"),
    alreadySolvedTraces: [],
    primaryMspConnectionPairs: [],
  })

  solver.solve()

  expect(solver.getOutput().newTraces).toHaveLength(0)
})

test("LongDistancePairSolver still routes direct connections", () => {
  const solver = new LongDistancePairSolver({
    inputProblem: createInputProblem("direct"),
    alreadySolvedTraces: [],
    primaryMspConnectionPairs: [],
  })

  solver.solve()

  expect(solver.getOutput().newTraces).toHaveLength(1)
})
