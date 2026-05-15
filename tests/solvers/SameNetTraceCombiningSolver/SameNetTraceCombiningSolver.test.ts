import { test, expect } from "bun:test"
import { SameNetTraceCombiningSolver } from "lib/solvers/SameNetTraceCombiningSolver/SameNetTraceCombiningSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

function makeTrace(
  mspPairId: string,
  path: { x: number; y: number }[],
  dcConnNetId?: string,
): SolvedTracePath {
  return {
    mspPairId,
    dcConnNetId,
    tracePath: path,
    pins: [{ pinId: "p1", position: path[0] }, { pinId: "p2", position: path[path.length - 1] }],
    mspConnectionPairIds: [mspPairId],
  } as SolvedTracePath
}

test("combines parallel traces on the same net", () => {
  const traces = [
    makeTrace("t1", [{ x: 0, y: 0 }, { x: 5, y: 0 }], "net1"),
    makeTrace("t2", [{ x: 5.2, y: 0 }, { x: 10, y: 0 }], "net1"),
  ]
  const solver = new SameNetTraceCombiningSolver({ traces, proximityThreshold: 1 })
  const result = solver.solve()
  expect(result.combinedCount).toBeGreaterThan(0)
  expect(result.traces.length).toBeLessThan(traces.length)
})

test("does not combine traces on different nets", () => {
  const traces = [
    makeTrace("t1", [{ x: 0, y: 0 }, { x: 5, y: 0 }], "net1"),
    makeTrace("t2", [{ x: 5.2, y: 0 }, { x: 10, y: 0 }], "net2"),
  ]
  const solver = new SameNetTraceCombiningSolver({ traces, proximityThreshold: 1 })
  const result = solver.solve()
  expect(result.combinedCount).toBe(0)
  expect(result.traces.length).toBe(traces.length)
})

test("does not combine traces that are far apart", () => {
  const traces = [
    makeTrace("t1", [{ x: 0, y: 0 }, { x: 5, y: 0 }], "net1"),
    makeTrace("t2", [{ x: 20, y: 0 }, { x: 25, y: 0 }], "net1"),
  ]
  const solver = new SameNetTraceCombiningSolver({ traces, proximityThreshold: 0.5 })
  const result = solver.solve()
  expect(result.combinedCount).toBe(0)
  expect(result.traces.length).toBe(traces.length)
})

test("handles vertical traces", () => {
  const traces = [
    makeTrace("t1", [{ x: 0, y: 0 }, { x: 0, y: 5 }], "net1"),
    makeTrace("t2", [{ x: 0, y: 5.2 }, { x: 0, y: 10 }], "net1"),
  ]
  const solver = new SameNetTraceCombiningSolver({ traces, proximityThreshold: 1 })
  const result = solver.solve()
  expect(result.combinedCount).toBeGreaterThan(0)
})
