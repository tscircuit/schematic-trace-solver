import { expect, test } from "bun:test"
import { MspConnectionPairSolver } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import type { InputProblem } from "lib/types/InputProblem"

const baseChips = [
  {
    chipId: "C1",
    center: { x: 0, y: 0 },
    width: 1,
    height: 2,
    pins: [
      { pinId: "C1.1", x: -0.5, y: -0.5, _facingDirection: "x-" as const },
      { pinId: "C1.2", x: -0.5, y: 0.5, _facingDirection: "x-" as const },
    ],
  },
  {
    chipId: "C2",
    center: { x: 3, y: 0 },
    width: 1,
    height: 2,
    pins: [
      { pinId: "C2.1", x: 3.5, y: -0.5, _facingDirection: "x+" as const },
      { pinId: "C2.2", x: 3.5, y: 0.5, _facingDirection: "x+" as const },
    ],
  },
]

const MAX_DIST = 10

test("net-only connections produce no MSP pairs (repro61 regression)", () => {
  const inputProblem: InputProblem = {
    chips: baseChips,
    directConnections: [],
    netConnections: [
      { netId: "GND", pinIds: ["C1.1", "C2.1"] },
      { netId: "VCC", pinIds: ["C1.2", "C2.2"] },
    ],
    availableNetLabelOrientations: {
      GND: ["x+", "x-", "y+", "y-"],
      VCC: ["x+", "x-", "y+", "y-"],
    },
    maxMspPairDistance: MAX_DIST,
  }

  const solver = new MspConnectionPairSolver({ inputProblem })
  solver.solve()

  expect(solver.mspConnectionPairs.length).toBe(0)
})

test("direct connections still produce MSP pairs", () => {
  const inputProblem: InputProblem = {
    chips: baseChips,
    directConnections: [{ pinIds: ["C1.1", "C2.1"] }],
    netConnections: [],
    availableNetLabelOrientations: {},
    maxMspPairDistance: MAX_DIST,
  }

  const solver = new MspConnectionPairSolver({ inputProblem })
  solver.solve()

  expect(solver.mspConnectionPairs.length).toBeGreaterThan(0)
})

test("mix of direct and net connections routes only direct nets", () => {
  const inputProblem: InputProblem = {
    chips: baseChips,
    directConnections: [{ pinIds: ["C1.1", "C2.1"] }],
    netConnections: [{ netId: "VCC", pinIds: ["C1.2", "C2.2"] }],
    availableNetLabelOrientations: {
      VCC: ["x+", "x-", "y+", "y-"],
    },
    maxMspPairDistance: MAX_DIST,
  }

  const solver = new MspConnectionPairSolver({ inputProblem })
  solver.solve()

  // Only the direct connection (C1.1-C2.1) should produce an MSP pair.
  // The net-only VCC connection should be handled by NetLabelPlacementSolver.
  const pairPinIds = solver.mspConnectionPairs.flatMap((p) =>
    p.pins.map((pin) => pin.pinId),
  )
  expect(pairPinIds).toContain("C1.1")
  expect(pairPinIds).toContain("C2.1")
  expect(pairPinIds).not.toContain("C1.2")
  expect(pairPinIds).not.toContain("C2.2")
})
