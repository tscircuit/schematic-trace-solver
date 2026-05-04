import { test, expect } from "bun:test"
import type { InputProblem } from "lib/types/InputProblem"
import { MspConnectionPairSolver } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"

/**
 * Regression test for issue #79.
 *
 * When a net (e.g. VCC) connects pins A.1 and B.1 via netConnections, and A.1 is
 * also part of a direct wire connection, the shared-reference bug in
 * getConnectivityMapsFromInputProblem caused B.1 to be merged into the direct-wire
 * net — resulting in spurious MSP pairs (and therefore spurious wire traces) that
 * included B.1.
 *
 * After the fix (cloning directConnMap.netMap before passing to netConnMap), the
 * direct-wire net only contains A.1 and A.2. B.1 is only reachable via the global
 * (net-label) connectivity and should NOT generate a wire trace.
 */
test("MspConnectionPairSolver_repro79 - no spurious pairs for net-label-only pins", () => {
  const inputProblem: InputProblem = {
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
        center: { x: 3, y: 0 },
        width: 1,
        height: 1,
        pins: [{ pinId: "B.1", x: 2.5, y: 0 }],
      },
    ],
    directConnections: [
      { pinIds: ["A.1", "A.2"] },
    ],
    netConnections: [
      { netId: "VCC", pinIds: ["A.1", "B.1"] },
    ],
    availableNetLabelOrientations: {
      VCC: ["x+", "x-", "y+", "y-"],
    },
  }

  const solver = new MspConnectionPairSolver({ inputProblem })
  solver.solve()

  expect(solver.solved).toBe(true)

  // Only the direct wire pair A.1--A.2 should exist.
  // B.1 must NOT appear in any MSP pair since it is connected only via net label.
  const pairPinIds = solver.mspConnectionPairs.flatMap((p) =>
    p.pins.map((pin) => pin.pinId),
  )

  expect(pairPinIds).not.toContain("B.1")

  // Exactly one pair: A.1 <-> A.2
  expect(solver.mspConnectionPairs).toHaveLength(1)
  const pair = solver.mspConnectionPairs[0]!
  const pairIds = pair.pins.map((p) => p.pinId).sort()
  expect(pairIds).toEqual(["A.1", "A.2"])
})
