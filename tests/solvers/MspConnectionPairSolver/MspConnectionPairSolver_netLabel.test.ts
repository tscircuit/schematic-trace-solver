import { expect, test } from "bun:test"
import { MspConnectionPairSolver } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import type { InputProblem } from "lib/types/InputProblem"

// A direct connection with a netLabelWidth is a net label, not a wire. Even
// when its two pins are close enough to pass maxMspPairDistance,
// MspConnectionPairSolver must not turn it into a routed pair — otherwise
// SchematicTraceLinesSolver draws a wire alongside the net label.
const buildProblem = (netLabelWidth?: number): InputProblem => ({
  chips: [
    {
      chipId: "A",
      center: { x: 0, y: 0 },
      width: 1,
      height: 1,
      pins: [{ pinId: "A.1", x: 0, y: 0 }],
    },
    {
      chipId: "B",
      center: { x: 1, y: 0 },
      width: 1,
      height: 1,
      pins: [{ pinId: "B.1", x: 1, y: 0 }],
    },
  ],
  directConnections: [{ pinIds: ["A.1", "B.1"], netId: "NL", netLabelWidth }],
  netConnections: [],
  availableNetLabelOrientations: {},
  maxMspPairDistance: 2.4,
})

test("MspConnectionPairSolver skips a close net-label direct connection", () => {
  const solver = new MspConnectionPairSolver({
    inputProblem: buildProblem(2),
  })
  solver.solve()

  expect(solver.mspConnectionPairs).toHaveLength(0)
})

test("MspConnectionPairSolver still pairs a close normal direct connection", () => {
  const solver = new MspConnectionPairSolver({
    inputProblem: buildProblem(undefined),
  })
  solver.solve()

  expect(solver.mspConnectionPairs).toHaveLength(1)
})
