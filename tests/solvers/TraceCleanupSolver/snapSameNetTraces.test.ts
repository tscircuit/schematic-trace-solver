import { test, expect } from "bun:test"
import { snapSameNetTraces } from "lib/solvers/TraceCleanupSolver/snapSameNetTraces"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

// Helper: build a minimal SolvedTracePath for testing
function makePath(
  id: string,
  netId: string,
  points: Array<{ x: number; y: number }>,
): SolvedTracePath {
  return {
    mspPairId: id,
    dcConnNetId: netId,
    globalConnNetId: netId,
    mspConnectionPairIds: [id],
    pinIds: [],
    pins: [] as any,
    tracePath: points,
  }
}

test("snaps two same-net vertical segments that are close together", () => {
  // Two vertical traces at x=1.00 and x=1.03 (distance 0.03, within threshold 0.05)
  // whose Y ranges overlap — they should be snapped to x=1.015
  const traces: SolvedTracePath[] = [
    makePath("A", "NET1", [
      { x: 0, y: 0 },
      { x: 1.0, y: 0 },
      { x: 1.0, y: 1 },
      { x: 2, y: 1 },
    ]),
    makePath("B", "NET1", [
      { x: 0, y: 0.5 },
      { x: 1.03, y: 0.5 },
      { x: 1.03, y: 1.5 },
      { x: 2, y: 1.5 },
    ]),
  ]

  const result = snapSameNetTraces(traces, 0.05)

  const traceA = result.find((t) => t.mspPairId === "A")!
  const traceB = result.find((t) => t.mspPairId === "B")!

  // Find the vertical segments and verify they share the same X
  const vertXA = traceA.tracePath.find((p, i, arr) => {
    if (i === arr.length - 1) return false
    return (
      Math.abs(p.x as number) - (arr[i + 1]!.x as number)) < 1e-6 &&
      Math.abs(p.y as number) - (arr[i + 1]!.y as number)) > 1e-6
    )
  })!

  const vertXB = traceB.tracePath.find((p, i, arr) => {
    if (i === arr.length - 1) return false
    return (
      Math.abs(p.x as number) - (arr[i + 1]!.x as number)) < 1e-6 &&
      Math.abs(p.y as number) - (arr[i + 1]!.y as number)) > 1e-6
    )
  })!

  expect(vertXA).toBeDefined()
  expect(vertXB).toBeDefined()
  expect(Math.abs(vertXA! - vertXB!)).toBeLessThan(1e-6)
  // Should snap to midpoint 1.015
  expect(Math.abs(vertXA! - 1.015)).toBeLessThan(1e-6)
})

test("snaps two same-net horizontal segments that are close together", () => {
  // Two horizontal traces at y=2.00 and y=2.04 (distance 0.04, within threshold 0.05)
  // whose X ranges overlap
  const traces: SolvedTracePath[] = [
    makePath("C", "NET2", [
      { x: 0, y: 0 },
      { x: 0, y: 2.0 },
      { x: 3, y: 2.0 },
    ]),
    makePath("D", "NET2", [
      { x: 0.5, y: 0 },
      { x: 0.5, y: 2.04 },
      { x: 3, y: 2.04 },
    ]),
  ]

  const result = snapSameNetTraces(traces, 0.05)

  const traceC = result.find((t) => t.mspPairId === "C")!
  const traceD = result.find((t) => t.mspPairId === "D")!

  // Last segment of each trace is horizontal — find Y of horizontal endpoint
  const lastC = traceC.tracePath[traceC.tracePath.length - 1]!
  const lastD = traceD.tracePath[traceD.tracePath.length - 1]!

  expect(Math.abs(lastC.y - lastD.y)).toBeLessThan(1e-6)
  expect(Math.abs(lastC.y - 2.02)).toBeLessThan(1e-6)
})

test("does NOT snap segments that are far apart", () => {
  // Distance of 0.2 > threshold of 0.05
  const traces: SolvedTracePath[] = [
    makePath("E", "NET3", [
      { x: 0, y: 0 },
      { x: 1.0, y: 0 },
      { x: 1.0, y: 1 },
    ]),
    makePath("F", "NET3", [
      { x: 0, y: 0 },
      { x: 1.2, y: 0 },
      { x: 1.2, y: 1 },
    ]),
  ]

  const result = snapSameNetTraces(traces, 0.05)

  // X coords of vertical segments should remain 1.0 and 1.2
  const xE = result.find((t) => t.mspPairId === "E")!.tracePath[1]!.x
  const xF = result.find((t) => t.mspPairId === "F")!.tracePath[1]!.x

  expect(Math.abs(xE - 1.0)).toBeLessThan(1e-6)
  expect(Math.abs(xF - 1.2)).toBeLessThan(1e-6)
})

test("does NOT snap segments from different nets", () => {
  // Same distance (0.03) but different nets — should NOT snap
  const traces: SolvedTracePath[] = [
    makePath("G", "NET4", [
      { x: 0, y: 0 },
      { x: 1.0, y: 0 },
      { x: 1.0, y: 1 },
    ]),
    makePath("H", "NET5", [
      { x: 0, y: 0.5 },
      { x: 1.03, y: 0.5 },
      { x: 1.03, y: 1.5 },
    ]),
  ]

  const result = snapSameNetTraces(traces, 0.05)

  const xG = result.find((t) => t.mspPairId === "G")!.tracePath[1]!.x
  const xH = result.find((t) => t.mspPairId === "H")!.tracePath[1]!.x

  // Should be unchanged
  expect(Math.abs(xG - 1.0)).toBeLessThan(1e-6)
  expect(Math.abs(xH - 1.03)).toBeLessThan(1e-6)
})

test("handles empty trace list", () => {
  const result = snapSameNetTraces([])
  expect(result).toEqual([])
})

test("handles single trace with no pair", () => {
  const traces = [
    makePath("I", "NET6", [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
    ]),
  ]
  const result = snapSameNetTraces(traces)
  // Should be unchanged
  expect(result[0]!.tracePath[1]!.x).toBeCloseTo(1, 9)
})

test("preserves original traces array (does not mutate input)", () => {
  const traces: SolvedTracePath[] = [
    makePath("J", "NET7", [
      { x: 0, y: 0 },
      { x: 1.0, y: 0 },
      { x: 1.0, y: 1 },
    ]),
    makePath("K", "NET7", [
      { x: 0, y: 0.5 },
      { x: 1.03, y: 0.5 },
      { x: 1.03, y: 1.5 },
    ]),
  ]

  const originalXJ = traces[0]!.tracePath[1]!.x
  const originalXK = traces[1]!.tracePath[1]!.x

  snapSameNetTraces(traces, 0.05)

  // Input traces should NOT be mutated
  expect(traces[0]!.tracePath[1]!.x).toBeCloseTo(originalXJ, 9)
  expect(traces[1]!.tracePath[1]!.x).toBeCloseTo(originalXK, 9)
})
