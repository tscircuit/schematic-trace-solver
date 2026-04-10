import { test, expect } from "bun:test"
import { MspConnectionPairSolver } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import type { InputProblem } from "lib/types/InputProblem"

/**
 * Regression tests for issue #79:
 * "Fix extra net label in repro61, or remove trace"
 *
 * Root cause: nets that exist only in `netConnections` and have a configured
 * net-label orientation were incorrectly being added to the MSP pair queue,
 * causing spurious wire traces to be drawn instead of (or in addition to) the
 * net labels that represent the connection.
 */

const baseChips: InputProblem["chips"] = [
  {
    chipId: "U1",
    center: { x: 0, y: 0 },
    width: 1.6,
    height: 0.6,
    pins: [
      { pinId: "U1.1", x: -0.8, y: 0.2 },
      { pinId: "U1.2", x: -0.8, y: 0 },
      { pinId: "U1.3", x: -0.8, y: -0.2 },
    ],
  },
  {
    chipId: "C1",
    center: { x: -2, y: 0 },
    width: 0.5,
    height: 1,
    pins: [
      { pinId: "C1.1", x: -2, y: 0.5 },
      { pinId: "C1.2", x: -2, y: -0.5 },
    ],
  },
]

test("issue #79: net-label-only nets should not generate MSP pairs", () => {
  // GND connects U1.3 and C1.2 via a net label — no wire trace should be drawn.
  const inputProblem: InputProblem = {
    chips: baseChips,
    directConnections: [
      { pinIds: ["U1.1", "C1.1"], netId: "VCC" },
    ],
    netConnections: [
      { pinIds: ["U1.3", "C1.2"], netId: "GND" },
    ],
    availableNetLabelOrientations: {
      VCC: ["y+"],
      GND: ["y-"],
    },
    maxMspPairDistance: 5,
  }

  const solver = new MspConnectionPairSolver({ inputProblem })
  solver.solve()

  // VCC has a directConnection → 1 pair
  // GND is net-label-only → 0 pairs
  expect(solver.mspConnectionPairs.length).toBe(1)

  const pairNets = solver.mspConnectionPairs.map((p) => p.userNetId)
  expect(pairNets).toContain("VCC")
  expect(pairNets).not.toContain("GND")
})

test("issue #79: net-only connections without label orientations still produce MSP pairs", () => {
  // 'signal' has no availableNetLabelOrientations entry, so it must be
  // connected with a wire trace even though it comes from netConnections.
  const inputProblem: InputProblem = {
    chips: baseChips,
    directConnections: [],
    netConnections: [
      { pinIds: ["U1.2", "C1.1"], netId: "signal" },
    ],
    availableNetLabelOrientations: {},
    maxMspPairDistance: 5,
  }

  const solver = new MspConnectionPairSolver({ inputProblem })
  solver.solve()

  // 'signal' has no label orientation → must keep wire trace
  expect(solver.mspConnectionPairs.length).toBe(1)
})

test("issue #79: net with both directConnection and netConnection always keeps trace", () => {
  // VCC appears in both directConnections and availableNetLabelOrientations.
  // The direct wire must still be drawn.
  const inputProblem: InputProblem = {
    chips: baseChips,
    directConnections: [
      { pinIds: ["U1.1", "C1.1"], netId: "VCC" },
    ],
    netConnections: [
      { pinIds: ["U1.1", "C1.1"], netId: "VCC" },
    ],
    availableNetLabelOrientations: {
      VCC: ["y+"],
    },
    maxMspPairDistance: 5,
  }

  const solver = new MspConnectionPairSolver({ inputProblem })
  solver.solve()

  expect(solver.mspConnectionPairs.length).toBe(1)
  expect(solver.mspConnectionPairs[0]?.userNetId).toBe("VCC")
})
