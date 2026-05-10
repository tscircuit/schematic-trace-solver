import { test, expect } from "bun:test"
import { SameNetTraceMergingSolver } from "lib/solvers/SameNetTraceMergingSolver/SameNetTraceMergingSolver"
import type { InputProblem } from "lib/types/InputProblem"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

/**
 * Helpers to build minimal traces for testing.
 * Each trace connects two pins and carries a globalConnNetId.
 */
function makeTrace(
  id: string,
  netId: string,
  path: Array<{ x: number; y: number }>,
): SolvedTracePath {
  return {
    mspPairId: id,
    dcConnNetId: netId,
    globalConnNetId: netId,
    pins: [
      { pinId: `${id}-a`, x: path[0].x, y: path[0].y, chipId: "U1" },
      {
        pinId: `${id}-b`,
        x: path[path.length - 1].x,
        y: path[path.length - 1].y,
        chipId: "U2",
      },
    ],
    tracePath: path,
    mspConnectionPairIds: [id],
    pinIds: [`${id}-a`, `${id}-b`],
  }
}

const EMPTY_PROBLEM: InputProblem = {
  chips: [],
  directConnections: [],
  netConnections: [],
  availableNetLabelOrientations: {},
}

// ─── repro: two same-net horizontal runs close in y ──────────────────────────

test("merges two same-net horizontal segments that are close in y", () => {
  /**
   * Before:
   *   trace1: (0,0) → (4,0)          y = 0.0
   *   trace2: (0,0.12) → (4,0.12)    y = 0.12  (interior only — pins would be at edges)
   *
   * We give trace2 interior points so snapping is allowed:
   *   trace2: (0,0.12) → (1,0.12) → (3,0.12) → (4,0.12)
   *            pin        interior   interior     pin
   *
   * After merge, the two interior points of trace2 should move to y = 0.
   */
  const trace1 = makeTrace("t1", "GND", [
    { x: 0, y: 0 },
    { x: 4, y: 0 },
  ])
  const trace2 = makeTrace("t2", "GND", [
    { x: 0, y: 0.12 }, // pin — fixed
    { x: 1, y: 0.12 }, // interior
    { x: 3, y: 0.12 }, // interior
    { x: 4, y: 0.12 }, // pin — fixed
  ])

  const solver = new SameNetTraceMergingSolver({
    inputProblem: EMPTY_PROBLEM,
    traces: [trace1, trace2],
  })
  solver.solve()

  expect(solver.solved).toBe(true)

  const out = solver.getOutput()
  const t2 = out.traces.find((t) => t.mspPairId === "t2")!

  // Interior points should now sit on y = 0 (snapped to trace1)
  expect(t2.tracePath[1].y).toBeCloseTo(0, 5)
  expect(t2.tracePath[2].y).toBeCloseTo(0, 5)

  // Pin endpoints must not move
  expect(t2.tracePath[0].y).toBeCloseTo(0.12, 5)
  expect(t2.tracePath[t2.tracePath.length - 1].y).toBeCloseTo(0.12, 5)
})

// ─── merges vertical segments ─────────────────────────────────────────────────

test("merges two same-net vertical segments that are close in x", () => {
  const trace1 = makeTrace("t1", "VCC", [
    { x: 0, y: 0 },
    { x: 0, y: 4 },
  ])
  const trace2 = makeTrace("t2", "VCC", [
    { x: 0.1, y: 0 }, // pin
    { x: 0.1, y: 1 }, // interior
    { x: 0.1, y: 3 }, // interior
    { x: 0.1, y: 4 }, // pin
  ])

  const solver = new SameNetTraceMergingSolver({
    inputProblem: EMPTY_PROBLEM,
    traces: [trace1, trace2],
  })
  solver.solve()

  expect(solver.solved).toBe(true)

  const t2 = solver.getOutput().traces.find((t) => t.mspPairId === "t2")!
  expect(t2.tracePath[1].x).toBeCloseTo(0, 5)
  expect(t2.tracePath[2].x).toBeCloseTo(0, 5)
})

// ─── different nets must NOT be merged ────────────────────────────────────────

test("does not merge segments from different nets", () => {
  const trace1 = makeTrace("t1", "GND", [
    { x: 0, y: 0 },
    { x: 4, y: 0 },
  ])
  const trace2 = makeTrace("t2", "VCC", [
    { x: 0, y: 0.1 }, // pin
    { x: 1, y: 0.1 }, // interior
    { x: 3, y: 0.1 }, // interior
    { x: 4, y: 0.1 }, // pin
  ])

  const solver = new SameNetTraceMergingSolver({
    inputProblem: EMPTY_PROBLEM,
    traces: [trace1, trace2],
  })
  solver.solve()

  expect(solver.solved).toBe(true)

  const t2 = solver.getOutput().traces.find((t) => t.mspPairId === "t2")!
  // y must remain unchanged — different nets
  for (const pt of t2.tracePath) {
    expect(pt.y).toBeCloseTo(0.1, 5)
  }
})

// ─── too far apart — no merge ─────────────────────────────────────────────────

test("does not merge same-net segments that are too far apart", () => {
  const trace1 = makeTrace("t1", "GND", [
    { x: 0, y: 0 },
    { x: 4, y: 0 },
  ])
  const trace2 = makeTrace("t2", "GND", [
    { x: 0, y: 1.0 }, // pin
    { x: 1, y: 1.0 }, // interior
    { x: 3, y: 1.0 }, // interior
    { x: 4, y: 1.0 }, // pin
  ])

  const solver = new SameNetTraceMergingSolver({
    inputProblem: EMPTY_PROBLEM,
    traces: [trace1, trace2],
  })
  solver.solve()

  const t2 = solver.getOutput().traces.find((t) => t.mspPairId === "t2")!
  for (const pt of t2.tracePath) {
    expect(pt.y).toBeCloseTo(1.0, 5)
  }
})
