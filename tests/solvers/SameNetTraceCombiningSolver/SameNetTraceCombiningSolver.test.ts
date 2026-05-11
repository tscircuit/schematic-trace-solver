import { expect, test } from "bun:test"
import {
  SameNetTraceCombiningSolver,
  simplifyTracePath,
} from "lib/solvers/SameNetTraceCombiningSolver/SameNetTraceCombiningSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

function makeTrace(
  id: string,
  netId: string,
  path: { x: number; y: number }[],
): SolvedTracePath {
  return {
    mspPairId: id,
    globalConnNetId: netId,
    dcConnNetId: netId,
    tracePath: path.map((p) => ({ ...p })),
    mspConnectionPairIds: [id],
    pinIds: [],
    pins: [
      { pinId: `${id}-p1`, x: path[0].x, y: path[0].y, chipId: "c1" },
      {
        pinId: `${id}-p2`,
        x: path[path.length - 1].x,
        y: path[path.length - 1].y,
        chipId: "c2",
      },
    ],
  }
}

const emptyProblem: InputProblem = {
  chips: [],
  directConnections: [],
  netConnections: [],
  availableNetLabelOrientations: {},
}

// ──────────────────────────────────────────────────────────────────────────────
// Unit tests for SameNetTraceCombiningSolver
// ──────────────────────────────────────────────────────────────────────────────

test("simplifyTracePath removes duplicate adjacent points", () => {
  const path = [
    { x: 0, y: 0 },
    { x: 0, y: 0 }, // duplicate
    { x: 1, y: 0 },
  ]
  const result = simplifyTracePath(path)
  expect(result).toHaveLength(2)
  expect(result[0]).toEqual({ x: 0, y: 0 })
  expect(result[1]).toEqual({ x: 1, y: 0 })
})

test("combines two horizontal same-net segments on the same y axis", () => {
  // Trace A: horizontal segment y=0, x from 0 to 1
  const traceA = makeTrace("a", "VCC", [
    { x: 0, y: 1 },
    { x: 0, y: 0 },
    { x: 1, y: 0 },
  ])
  // Trace B: horizontal segment y=0, x from 1 to 2 (adjacent to A)
  const traceB = makeTrace("b", "VCC", [
    { x: 1, y: 0 },
    { x: 2, y: 0 },
    { x: 2, y: 1 },
  ])

  const solver = new SameNetTraceCombiningSolver({
    inputProblem: emptyProblem,
    traces: [traceA, traceB],
  })
  solver.solve()

  const { traces } = solver.getOutput()

  // The horizontal segment of both traces should now span [0, 2]
  const hasFullSpan = traces.some((t) => {
    const xs = t.tracePath.map((p) => p.x)
    return Math.min(...xs) <= 0 && Math.max(...xs) >= 2
  })
  expect(hasFullSpan).toBe(true)
})

test("combines two vertical same-net segments on the same x axis", () => {
  const traceA = makeTrace("a", "NET1", [
    { x: 1, y: 0 },
    { x: 0, y: 0 },
    { x: 0, y: 1 },
  ])
  const traceB = makeTrace("b", "NET1", [
    { x: 0, y: 1 },
    { x: 0, y: 2 },
    { x: 1, y: 2 },
  ])

  const solver = new SameNetTraceCombiningSolver({
    inputProblem: emptyProblem,
    traces: [traceA, traceB],
  })
  solver.solve()

  const { traces } = solver.getOutput()

  const hasFullSpan = traces.some((t) => {
    const ys = t.tracePath.map((p) => p.y)
    return Math.min(...ys) <= 0 && Math.max(...ys) >= 2
  })
  expect(hasFullSpan).toBe(true)
})

test("does NOT combine segments on different nets", () => {
  const traceA = makeTrace("a", "VCC", [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
  ])
  const traceB = makeTrace("b", "GND", [
    { x: 1, y: 0 },
    { x: 2, y: 0 },
  ])

  const solver = new SameNetTraceCombiningSolver({
    inputProblem: emptyProblem,
    traces: [traceA, traceB],
  })
  solver.solve()

  const { traces } = solver.getOutput()
  // Each trace should remain unchanged: still separate spans
  const traceAOut = traces.find((t) => t.mspPairId === "a")!
  const traceBOut = traces.find((t) => t.mspPairId === "b")!
  const axs = traceAOut.tracePath.map((p) => p.x)
  const bxs = traceBOut.tracePath.map((p) => p.x)
  expect(Math.max(...axs)).toBeLessThanOrEqual(1.01)
  expect(Math.min(...bxs)).toBeGreaterThanOrEqual(0.99)
})

test("does NOT combine segments with a large gap", () => {
  // Gap > MERGE_GAP (0.15) — should remain separate
  const traceA = makeTrace("a", "VCC", [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
  ])
  const traceB = makeTrace("b", "VCC", [
    { x: 1.3, y: 0 },
    { x: 2, y: 0 },
  ])

  const solver = new SameNetTraceCombiningSolver({
    inputProblem: emptyProblem,
    traces: [traceA, traceB],
  })
  solver.solve()

  const { traces } = solver.getOutput()
  const traceAOut = traces.find((t) => t.mspPairId === "a")!
  const axs = traceAOut.tracePath.map((p) => p.x)
  expect(Math.max(...axs)).toBeLessThanOrEqual(1.01)
})

// ──────────────────────────────────────────────────────────────────────────────
// Reproduction: pipeline-level test showing the problem in practice
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Reproduction for issue #29.
 *
 * Two VCC traces share a horizontal segment at y=1.5.
 * Without combining, the segment from x=0 to x=1 appears in trace-A and the
 * segment from x=1 to x=2 appears in trace-B, both on the same horizontal line.
 * After SameNetTraceCombiningSolver runs, one trace extends to cover [0, 2]
 * and the other is aligned to the same span — the shared rail appears once.
 */
test("repro #29: solver combines two adjacent same-net horizontal segments into one span", () => {
  // Simulate two MSP pairs on the same VCC net whose traces both run along y=1.5.
  // Trace A: pin at (-1, 0) → routes up → horizontal at y=1.5 from x=-1 to x=0 → continues
  // Trace B: pin at (1, 0)  → routes up → horizontal at y=1.5 from x=0  to x=1 → continues
  // The horizontal segments are adjacent (touching at x=0) and should be merged.
  const traceA = makeTrace("pair-A", "VCC", [
    { x: -1, y: 0 }, // pin
    { x: -1, y: 1.5 }, // turn
    { x: 0, y: 1.5 }, // end of A's horizontal
  ])
  const traceB = makeTrace("pair-B", "VCC", [
    { x: 0, y: 1.5 }, // start of B's horizontal
    { x: 1, y: 1.5 }, // end of B's horizontal
    { x: 1, y: 0 }, // pin
  ])

  // Without the solver the two horizontal segments at y=1.5 are separate.
  const hSegsRaw: { xMin: number; xMax: number }[] = []
  for (const t of [traceA, traceB]) {
    for (let i = 0; i < t.tracePath.length - 1; i++) {
      const p1 = t.tracePath[i]
      const p2 = t.tracePath[i + 1]
      if (Math.abs(p1.y - p2.y) < 0.01 && Math.abs(p1.y - 1.5) < 0.01) {
        hSegsRaw.push({ xMin: Math.min(p1.x, p2.x), xMax: Math.max(p1.x, p2.x) })
      }
    }
  }
  expect(hSegsRaw).toHaveLength(2) // two separate segments before combining

  // Run the solver
  const solver = new SameNetTraceCombiningSolver({
    inputProblem: emptyProblem,
    traces: [traceA, traceB],
  })
  solver.solve()

  const { traces } = solver.getOutput()

  // After combining, at least one trace should span the full [−1, 1] range at y≈1.5
  const fullSpanExists = traces.some((t) => {
    const hSeg = []
    for (let i = 0; i < t.tracePath.length - 1; i++) {
      const p1 = t.tracePath[i]
      const p2 = t.tracePath[i + 1]
      if (Math.abs(p1.y - p2.y) < 0.01 && Math.abs(p1.y - 1.5) < 0.01) {
        hSeg.push({ xMin: Math.min(p1.x, p2.x), xMax: Math.max(p1.x, p2.x) })
      }
    }
    return hSeg.some((s) => s.xMin <= -1 && s.xMax >= 1)
  })

  expect(fullSpanExists).toBe(true)
})
