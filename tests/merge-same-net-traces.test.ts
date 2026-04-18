import { test, expect } from "bun:test"
import { mergeSameNetTraces } from "lib/solvers/TraceCleanupSolver/mergeSameNetTraces"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

function makeTrace(
  id: string,
  path: { x: number; y: number }[],
  netId?: string,
): SolvedTracePath {
  return {
    mspPairId: id,
    globalConnNetId: netId ?? id,
    tracePath: path,
  } as SolvedTracePath
}

test("mergeSameNetTraces snaps close horizontal segments to average y", () => {
  const traceA = makeTrace(
    "a",
    [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1.0 },
      { x: 2, y: 1.0 },
    ],
    "net1",
  )
  const traceB = makeTrace(
    "b",
    [
      { x: 0, y: 3 },
      { x: 1.5, y: 3 },
      { x: 1.5, y: 1.1 },
      { x: 3, y: 1.1 },
    ],
    "net1",
  )

  const result = mergeSameNetTraces([traceA, traceB], {})

  // Both horizontal segments (y=1.0 and y=1.1) should be snapped to average y=1.05
  const rA = result.find((t) => t.mspPairId === "a")
  const rB = result.find((t) => t.mspPairId === "b")

  expect(rA).toBeDefined()
  expect(rB).toBeDefined()

  // Verify no null/undefined entries in paths
  for (const trace of result) {
    for (const p of trace.tracePath) {
      expect(p).toBeDefined()
      expect(typeof p.x).toBe("number")
      expect(typeof p.y).toBe("number")
    }
  }
})

test("mergeSameNetTraces snaps close vertical segments to average x", () => {
  const traceA = makeTrace(
    "a",
    [
      { x: 0, y: 0 },
      { x: 1.0, y: 0 },
      { x: 1.0, y: 2 },
      { x: 3, y: 2 },
    ],
    "net1",
  )
  const traceB = makeTrace(
    "b",
    [
      { x: 0, y: 5 },
      { x: 1.1, y: 5 },
      { x: 1.1, y: 1 },
      { x: 3, y: 1 },
    ],
    "net1",
  )

  const result = mergeSameNetTraces([traceA, traceB], {})

  // Verify no null/undefined entries in paths
  for (const trace of result) {
    for (const p of trace.tracePath) {
      expect(p).toBeDefined()
      expect(typeof p.x).toBe("number")
      expect(typeof p.y).toBe("number")
    }
  }
})

test("mergeSameNetTraces does not merge segments from different nets", () => {
  const traceA = makeTrace(
    "a",
    [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
    ],
    "net1",
  )
  const traceB = makeTrace(
    "b",
    [
      { x: 0, y: 0.05 },
      { x: 2, y: 0.05 },
    ],
    "net2",
  )

  const result = mergeSameNetTraces([traceA, traceB], {})

  // Different nets: paths should remain unchanged
  const rA = result.find((t) => t.mspPairId === "a")
  const rB = result.find((t) => t.mspPairId === "b")

  expect(rA!.tracePath[0].y).toBe(0)
  expect(rA!.tracePath[1].y).toBe(0)
  expect(rB!.tracePath[0].y).toBe(0.05)
  expect(rB!.tracePath[1].y).toBe(0.05)
})

test("mergeSameNetTraces handles single-point paths without errors", () => {
  const traceA = makeTrace("a", [{ x: 0, y: 0 }], "net1")
  const traceB = makeTrace(
    "b",
    [
      { x: 0, y: 0.05 },
      { x: 2, y: 0.05 },
    ],
    "net1",
  )

  const result = mergeSameNetTraces([traceA, traceB], {})

  // Should not crash
  expect(result.length).toBe(2)
  for (const trace of result) {
    for (const p of trace.tracePath) {
      expect(p).toBeDefined()
      expect(typeof p.x).toBe("number")
      expect(typeof p.y).toBe("number")
    }
  }
})

test("mergeSameNetTraces uses mergedLabelNetIdMap to group traces", () => {
  const traceA = makeTrace(
    "a",
    [
      { x: 0, y: 1.0 },
      { x: 3, y: 1.0 },
    ],
    "net1",
  )
  const traceB = makeTrace(
    "b",
    [
      { x: 0, y: 1.1 },
      { x: 3, y: 1.1 },
    ],
    "net2",
  )

  // Merge net1 and net2 under the same group
  const mergedMap: Record<string, Set<string>> = {
    merged: new Set(["net1", "net2"]),
  }

  const result = mergeSameNetTraces([traceA, traceB], mergedMap)

  // Now they should be merged since they share the merged group
  const rA = result.find((t) => t.mspPairId === "a")
  const rB = result.find((t) => t.mspPairId === "b")

  // Both should be snapped to the average y = 1.05
  expect(rA!.tracePath[0].y).toBeCloseTo(1.05, 5)
  expect(rB!.tracePath[0].y).toBeCloseTo(1.05, 5)
})
