import { test, expect } from "bun:test"
import { SameNetMergeSegmentSolver } from "lib/solvers/SameNetMergeSegmentSolver/SameNetMergeSegmentSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

function makeSolvedTrace(
  id: string,
  netId: string,
  path: Array<{ x: number; y: number }>,
): SolvedTracePath {
  return {
    mspPairId: id,
    dcConnNetId: netId,
    globalConnNetId: netId,
    pins: [] as any,
    tracePath: path,
    mspConnectionPairIds: [id],
    pinIds: [],
  }
}

test("merges two horizontal same-net segments at similar Y", () => {
  const traceA = makeSolvedTrace("a", "net1", [
    { x: 0, y: 0 },
    { x: 3, y: 0 },
  ])
  const traceB = makeSolvedTrace("b", "net1", [
    { x: 0, y: 0.1 },
    { x: 3, y: 0.1 },
  ])
  const solver = new SameNetMergeSegmentSolver({ traces: [traceA, traceB] })
  solver.solve()
  expect(solver.solved).toBe(true)
  const { traces } = solver.getOutput()
  for (const trace of traces) {
    for (const pt of trace.tracePath) {
      expect(Math.abs(pt.y - 0.05)).toBeLessThan(0.01)
    }
  }
})

test("merges two vertical same-net segments at similar X", () => {
  const traceA = makeSolvedTrace("a", "net2", [
    { x: 0, y: 0 },
    { x: 0, y: 5 },
  ])
  const traceB = makeSolvedTrace("b", "net2", [
    { x: 0.15, y: 0 },
    { x: 0.15, y: 5 },
  ])
  const solver = new SameNetMergeSegmentSolver({ traces: [traceA, traceB] })
  solver.solve()
  expect(solver.solved).toBe(true)
  const { traces } = solver.getOutput()
  for (const trace of traces) {
    for (const pt of trace.tracePath) {
      expect(Math.abs(pt.x - 0.075)).toBeLessThan(0.01)
    }
  }
})

test("does NOT merge segments from different nets", () => {
  const traceA = makeSolvedTrace("a", "net1", [
    { x: 0, y: 0 },
    { x: 3, y: 0 },
  ])
  const traceB = makeSolvedTrace("b", "net2", [
    { x: 0, y: 0.1 },
    { x: 3, y: 0.1 },
  ])
  const solver = new SameNetMergeSegmentSolver({ traces: [traceA, traceB] })
  solver.solve()
  expect(solver.solved).toBe(true)
  const { traces } = solver.getOutput()
  expect(traces[0]!.tracePath[0]!.y).toBeCloseTo(0, 5)
  expect(traces[1]!.tracePath[0]!.y).toBeCloseTo(0.1, 5)
})

test("does NOT merge segments that are far apart (> threshold)", () => {
  const traceA = makeSolvedTrace("a", "net1", [
    { x: 0, y: 0 },
    { x: 3, y: 0 },
  ])
  const traceB = makeSolvedTrace("b", "net1", [
    { x: 0, y: 1.0 },
    { x: 3, y: 1.0 },
  ])
  const solver = new SameNetMergeSegmentSolver({ traces: [traceA, traceB] })
  solver.solve()
  expect(solver.solved).toBe(true)
  const { traces } = solver.getOutput()
  expect(traces[0]!.tracePath[0]!.y).toBeCloseTo(0, 5)
  expect(traces[1]!.tracePath[0]!.y).toBeCloseTo(1.0, 5)
})

test("extends merged segment to cover union of both extents", () => {
  const traceA = makeSolvedTrace("a", "net1", [
    { x: 0, y: 0 },
    { x: 2, y: 0 },
  ])
  const traceB = makeSolvedTrace("b", "net1", [
    { x: 1, y: 0.1 },
    { x: 4, y: 0.1 },
  ])
  const solver = new SameNetMergeSegmentSolver({ traces: [traceA, traceB] })
  solver.solve()
  expect(solver.solved).toBe(true)
  const { traces } = solver.getOutput()
  for (const trace of traces) {
    const xs = trace.tracePath.map((p) => p.x)
    expect(Math.min(...xs)).toBeCloseTo(0, 5)
    expect(Math.max(...xs)).toBeCloseTo(4, 5)
  }
})
