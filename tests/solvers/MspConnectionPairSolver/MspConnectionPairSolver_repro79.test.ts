import { test, expect } from "bun:test"
import type { InputProblem } from "lib/types/InputProblem"
import { MspConnectionPairSolver } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"

/**
 * Regression test for tscircuit/schematic-trace-solver#79
 * (extra net label in repro61 / spurious wire trace between same-net pins).
 *
 * Two scenarios are covered:
 *
 *   (1) **Mixed direct + net case** — a pin appears in both a directConnection
 *       and a netConnection. Before the fix, ConnectivityMap shared state
 *       between directConnMap and netConnMap, so the netConnection's other
 *       pins got merged into the direct-wire net and produced spurious MSP
 *       pairs (and therefore traces).
 *
 *   (2) **Pure net-label-only case** — two chips' pins share a net name (e.g.
 *       two capacitors both labeled GND on pin1) with no direct wire between
 *       them. The MspConnectionPairSolver should produce zero pairs; the
 *       NetLabelPlacementSolver will place independent labels in a later
 *       phase. This is the repro61 scenario from tscircuit/core (PR #1503).
 */

test("MspConnectionPairSolver_repro79 (mixed) - no spurious pair for net-label-only pin", () => {
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
    directConnections: [{ pinIds: ["A.1", "A.2"] }],
    netConnections: [{ netId: "VCC", pinIds: ["A.1", "B.1"] }],
    availableNetLabelOrientations: {
      VCC: ["x+", "x-", "y+", "y-"],
    },
  }

  const solver = new MspConnectionPairSolver({ inputProblem })
  solver.solve()

  expect(solver.solved).toBe(true)

  // B.1 must not appear in any pair: it shares only a net label, no direct wire.
  const pairPinIds = solver.mspConnectionPairs.flatMap((p) =>
    p.pins.map((pin) => pin.pinId),
  )
  expect(pairPinIds).not.toContain("B.1")

  // Exactly one pair: A.1 <-> A.2
  expect(solver.mspConnectionPairs).toHaveLength(1)
  const pair = solver.mspConnectionPairs[0]!
  expect(pair.pins.map((p) => p.pinId).sort()).toEqual(["A.1", "A.2"])
})

test("MspConnectionPairSolver_repro79 (pure net-only) - zero pairs when no direct connections", () => {
  // Repro61-equivalent: two capacitors, each with a GND label on pin1 and a
  // VCC label on pin2. There are no direct wire connections. The solver must
  // not invent MSP pairs between same-net pins; that produces visible spurious
  // traces in the schematic output.
  const inputProblem: InputProblem = {
    chips: [
      {
        chipId: "C1",
        center: { x: 0.7, y: 0 },
        width: 0.5,
        height: 1.2,
        pins: [
          { pinId: "C1.1", x: 0.7, y: 0.6 },
          { pinId: "C1.2", x: 0.7, y: -0.6 },
        ],
      },
      {
        chipId: "C2",
        center: { x: 0, y: 0 },
        width: 0.5,
        height: 1.2,
        pins: [
          { pinId: "C2.1", x: 0, y: 0.6 },
          { pinId: "C2.2", x: 0, y: -0.6 },
        ],
      },
    ],
    directConnections: [],
    netConnections: [
      { netId: "GND", pinIds: ["C1.1", "C2.1"] },
      { netId: "VCC", pinIds: ["C1.2", "C2.2"] },
    ],
    availableNetLabelOrientations: {
      GND: ["y+"],
      VCC: ["y-"],
    },
  }

  const solver = new MspConnectionPairSolver({ inputProblem })
  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.mspConnectionPairs).toEqual([])
})
