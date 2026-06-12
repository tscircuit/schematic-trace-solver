import { test, expect } from "bun:test"
import { mergeParallelTraces } from "lib/solvers/TraceCleanupSolver/mergeParallelTraces"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

function createTrace(
  mspPairId: string,
  globalConnNetId: string,
  tracePath: { x: number; y: number }[],
): SolvedTracePath {
  return {
    mspPairId,
    globalConnNetId,
    tracePath,
    mspConnectionPairIds: [mspPairId],
    pinIds: [],
    dcConnNetId: globalConnNetId,
    userNetId: "",
    pins: [],
  } as any
}

test("mergeParallelTraces - horizontal segments same net snap to median Y", () => {
  const traces = [
    createTrace("trace1", "net1", [{ x: 0, y: 100 }, { x: 10, y: 100 }, { x: 20, y: 100 }]),
    createTrace("trace2", "net1", [{ x: 0, y: 102 }, { x: 10, y: 102 }, { x: 20, y: 102 }]),
    createTrace("trace3", "net1", [{ x: 0, y: 105 }, { x: 10, y: 105 }, { x: 20, y: 105 }]),
  ]

  const netIdMap = new Map<string, string>()
  netIdMap.set("trace1", "net1")
  netIdMap.set("trace2", "net1")
  netIdMap.set("trace3", "net1")

  const result = mergeParallelTraces(traces, netIdMap, 5)

  // All traces should have Y = 102 (median of 100, 102, 105)
  for (const trace of result) {
    for (const point of trace.tracePath) {
      expect(point.y).toBe(102)
    }
  }
})

test("mergeParallelTraces - vertical segments same net snap to median X", () => {
  const traces = [
    createTrace("trace1", "net1", [{ x: 200, y: 0 }, { x: 200, y: 10 }]),
    createTrace("trace2", "net1", [{ x: 201, y: 0 }, { x: 201, y: 10 }]),
    createTrace("trace3", "net1", [{ x: 205, y: 0 }, { x: 205, y: 10 }]),
  ]

  const netIdMap = new Map<string, string>()
  netIdMap.set("trace1", "net1")
  netIdMap.set("trace2", "net1")
  netIdMap.set("trace3", "net1")

  const result = mergeParallelTraces(traces, netIdMap, 5)

  // All traces should have X = 201 (median of 200, 201, 205)
  for (const trace of result) {
    for (const point of trace.tracePath) {
      expect(point.x).toBe(201)
    }
  }
})

test("mergeParallelTraces - different nets not merged", () => {
  const traces = [
    createTrace("trace1", "net1", [{ x: 0, y: 100 }, { x: 10, y: 100 }]),
    createTrace("trace2", "net2", [{ x: 0, y: 102 }, { x: 10, y: 102 }]),
  ]

  const netIdMap = new Map<string, string>()
  netIdMap.set("trace1", "net1")
  netIdMap.set("trace2", "net2")

  const result = mergeParallelTraces(traces, netIdMap, 5)

  // Traces should keep original coordinates
  expect(result[0].tracePath[0].y).toBe(100)
  expect(result[1].tracePath[0].y).toBe(102)
})

test("mergeParallelTraces - segments beyond tolerance not merged", () => {
  const traces = [
    createTrace("trace1", "net1", [{ x: 0, y: 100 }, { x: 10, y: 100 }]),
    createTrace("trace2", "net1", [{ x: 0, y: 110 }, { x: 10, y: 110 }]),
  ]

  const netIdMap = new Map<string, string>()
  netIdMap.set("trace1", "net1")
  netIdMap.set("trace2", "net1")

  const result = mergeParallelTraces(traces, netIdMap, 5)

  // Traces should keep original coordinates (diff = 10 > tolerance 5)
  expect(result[0].tracePath[0].y).toBe(100)
  expect(result[1].tracePath[0].y).toBe(110)
})

test("mergeParallelTraces - single trace unaffected", () => {
  const traces = [
    createTrace("trace1", "net1", [{ x: 0, y: 100 }, { x: 10, y: 100 }]),
  ]

  const netIdMap = new Map<string, string>()
  netIdMap.set("trace1", "net1")

  const result = mergeParallelTraces(traces, netIdMap, 5)

  expect(result[0].tracePath[0].y).toBe(100)
})

test("mergeParallelTraces - mixed horizontal and vertical", () => {
  const traces = [
    createTrace("trace_h1", "net1", [{ x: 0, y: 100 }, { x: 10, y: 100 }]), // horizontal
    createTrace("trace_h2", "net1", [{ x: 0, y: 102 }, { x: 10, y: 102 }]), // horizontal
    createTrace("trace_v1", "net1", [{ x: 200, y: 0 }, { x: 200, y: 10 }]), // vertical
    createTrace("trace_v2", "net1", [{ x: 201, y: 0 }, { x: 201, y: 10 }]), // vertical
  ]

  const netIdMap = new Map<string, string>()
  for (const t of traces) netIdMap.set(t.mspPairId, "net1")

  const result = mergeParallelTraces(traces, netIdMap, 5)

  // Horizontal: median of 100, 102 = 101
  const hTraces = result.filter((t) => t.mspPairId.startsWith("trace_h"))
  for (const trace of hTraces) {
    for (const point of trace.tracePath) {
      expect(point.y).toBe(101)
    }
  }

  // Vertical: median of 200, 201 = 200.5
  const vTraces = result.filter((t) => t.mspPairId.startsWith("trace_v"))
  for (const trace of vTraces) {
    for (const point of trace.tracePath) {
      expect(point.x).toBe(200.5)
    }
  }
})