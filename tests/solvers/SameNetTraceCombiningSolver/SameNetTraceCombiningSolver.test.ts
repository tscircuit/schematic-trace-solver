import { test, expect } from "bun:test"
import { SameNetTraceCombiningSolver } from "lib/solvers/SameNetTraceCombiningSolver/SameNetTraceCombiningSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

function makePath(
  netId: string,
  pairId: string,
  points: Array<{ x: number; y: number }>,
): SolvedTracePath {
  return {
    mspPairId: pairId,
    dcConnNetId: netId,
    globalConnNetId: netId,
    tracePath: points,
    mspConnectionPairIds: [pairId],
    pinIds: [],
    pins: [] as any,
  }
}

test("snaps two close horizontal segments on the same net to the same Y", () => {
  const traces: SolvedTracePath[] = [
    // Trace A: horizontal at y=1.0, from x=0 to x=5, with turning points
    makePath("net1", "pair1", [
      { x: 0, y: 0 },
      { x: 0, y: 1.0 },
      { x: 5, y: 1.0 },
      { x: 5, y: 0 },
    ]),
    // Trace B: horizontal at y=1.03 (very close to 1.0), from x=2 to x=8, with turning points
    makePath("net1", "pair2", [
      { x: 2, y: 0 },
      { x: 2, y: 1.03 },
      { x: 8, y: 1.03 },
      { x: 8, y: 0 },
    ]),
  ]

  const solver = new SameNetTraceCombiningSolver({ traces })
  const output = solver.getOutput()

  expect(output.traces).toHaveLength(2)

  // Find the trace that was snapped (pair2)
  const snapped = output.traces.find((t) => t.mspPairId === "pair2")!
  const horizontal = snapped.tracePath.find(
    (p, i) =>
      i + 1 < snapped.tracePath.length &&
      Math.abs(snapped.tracePath[i + 1].y - p.y) < 1e-6 &&
      Math.abs(snapped.tracePath[i + 1].x - p.x) > 1e-6,
  )

  // The horizontal segment should now be at y=1.0 (snapped from 1.03)
  expect(horizontal).toBeDefined()
  expect(Math.abs(horizontal!.y - 1.0)).toBeLessThan(0.01)
})

test("does not merge segments from different nets", () => {
  const traces: SolvedTracePath[] = [
    makePath("net1", "pair1", [
      { x: 0, y: 0 },
      { x: 0, y: 1.0 },
      { x: 5, y: 1.0 },
      { x: 5, y: 0 },
    ]),
    makePath("net2", "pair2", [
      { x: 2, y: 0 },
      { x: 2, y: 1.03 },
      { x: 8, y: 1.03 },
      { x: 8, y: 0 },
    ]),
  ]

  const solver = new SameNetTraceCombiningSolver({ traces })
  const output = solver.getOutput()

  const net2trace = output.traces.find((t) => t.mspPairId === "pair2")!
  // The y=1.03 segment should remain unchanged since it's a different net
  const stillAt103 = net2trace.tracePath.some(
    (p) => Math.abs(p.y - 1.03) < 1e-6,
  )
  expect(stillAt103).toBe(true)
})

test("does not snap segments that are too far apart (gap > threshold)", () => {
  const traces: SolvedTracePath[] = [
    makePath("net1", "pair1", [
      { x: 0, y: 0 },
      { x: 0, y: 1.0 },
      { x: 3, y: 1.0 },
      { x: 3, y: 0 },
    ]),
    // Far apart in Y
    makePath("net1", "pair2", [
      { x: 2, y: 0 },
      { x: 2, y: 2.0 },
      { x: 8, y: 2.0 },
      { x: 8, y: 0 },
    ]),
  ]

  const solver = new SameNetTraceCombiningSolver({ traces })
  const output = solver.getOutput()

  const t2 = output.traces.find((t) => t.mspPairId === "pair2")!
  const stillAt2 = t2.tracePath.some((p) => Math.abs(p.y - 2.0) < 1e-6)
  expect(stillAt2).toBe(true)
})

test("does not snap segments that do not overlap in the parallel axis", () => {
  const traces: SolvedTracePath[] = [
    makePath("net1", "pair1", [
      { x: 0, y: 0 },
      { x: 0, y: 1.0 },
      { x: 2, y: 1.0 },
      { x: 2, y: 0 },
    ]),
    // No x-overlap, gap > GAP_TOLERANCE
    makePath("net1", "pair2", [
      { x: 10, y: 0 },
      { x: 10, y: 1.03 },
      { x: 15, y: 1.03 },
      { x: 15, y: 0 },
    ]),
  ]

  const solver = new SameNetTraceCombiningSolver({ traces })
  const output = solver.getOutput()

  const t2 = output.traces.find((t) => t.mspPairId === "pair2")!
  const stillAt103 = t2.tracePath.some((p) => Math.abs(p.y - 1.03) < 1e-6)
  expect(stillAt103).toBe(true)
})

test("snaps two close vertical segments on the same net", () => {
  const traces: SolvedTracePath[] = [
    makePath("net1", "pair1", [
      { x: 0, y: 0 },
      { x: 1.0, y: 0 },
      { x: 1.0, y: 5 },
      { x: 0, y: 5 },
    ]),
    makePath("net1", "pair2", [
      { x: 0, y: 2 },
      { x: 1.03, y: 2 },
      { x: 1.03, y: 8 },
      { x: 0, y: 8 },
    ]),
  ]

  const solver = new SameNetTraceCombiningSolver({ traces })
  const output = solver.getOutput()

  const snapped = output.traces.find((t) => t.mspPairId === "pair2")!
  const vertical = snapped.tracePath.find(
    (p, i) =>
      i + 1 < snapped.tracePath.length &&
      Math.abs(snapped.tracePath[i + 1].x - p.x) < 1e-6 &&
      Math.abs(snapped.tracePath[i + 1].y - p.y) > 1e-6,
  )

  expect(vertical).toBeDefined()
  expect(Math.abs(vertical!.x - 1.0)).toBeLessThan(0.01)
})
