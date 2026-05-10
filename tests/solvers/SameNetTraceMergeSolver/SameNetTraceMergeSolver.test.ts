import { expect, test } from "bun:test"
import { SameNetTraceMergeSolver } from "lib/solvers/SameNetTraceMergeSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

const makeTrace = (
  mspPairId: string,
  globalConnNetId: string,
  tracePath: Array<{ x: number; y: number }>,
): SolvedTracePath => {
  const start = tracePath[0]!
  const end = tracePath[tracePath.length - 1]!
  const startPinId = `${mspPairId}-start`
  const endPinId = `${mspPairId}-end`

  return {
    mspPairId,
    dcConnNetId: globalConnNetId,
    globalConnNetId,
    pins: [
      { pinId: startPinId, chipId: "chip-a", x: start.x, y: start.y },
      { pinId: endPinId, chipId: "chip-b", x: end.x, y: end.y },
    ],
    tracePath: tracePath.map((point) => ({ ...point })),
    mspConnectionPairIds: [mspPairId],
    pinIds: [startPinId, endPinId],
  }
}

const solve = (inputTraces: SolvedTracePath[]) => {
  const solver = new SameNetTraceMergeSolver({
    inputTraces,
    mergeDistance: 0.1,
    minParallelOverlap: 0.05,
  })
  solver.solve()
  return solver
}

test("snaps close same-net horizontal internal segments onto a shared axis", () => {
  const solver = solve([
    makeTrace("trace-a", "net-1", [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 2, y: 1 },
      { x: 2, y: 0 },
    ]),
    makeTrace("trace-b", "net-1", [
      { x: 0, y: 2 },
      { x: 0, y: 1.08 },
      { x: 2, y: 1.08 },
      { x: 2, y: 2 },
    ]),
  ])

  const [traceA, traceB] = solver.getOutput().traces

  expect(traceA!.tracePath[0]).toEqual({ x: 0, y: 0 })
  expect(traceA!.tracePath[3]).toEqual({ x: 2, y: 0 })
  expect(traceB!.tracePath[0]).toEqual({ x: 0, y: 2 })
  expect(traceB!.tracePath[3]).toEqual({ x: 2, y: 2 })
  expect(traceA!.tracePath[1]!.y).toBeCloseTo(1.04)
  expect(traceA!.tracePath[2]!.y).toBeCloseTo(1.04)
  expect(traceB!.tracePath[1]!.y).toBeCloseTo(1.04)
  expect(traceB!.tracePath[2]!.y).toBeCloseTo(1.04)
  expect(solver.stats.mergedSegmentGroups).toBe(1)
})

test("snaps close same-net vertical internal segments onto a shared axis", () => {
  const solver = solve([
    makeTrace("trace-a", "net-1", [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 2 },
      { x: 0, y: 2 },
    ]),
    makeTrace("trace-b", "net-1", [
      { x: 2, y: 0 },
      { x: 1.08, y: 0 },
      { x: 1.08, y: 2 },
      { x: 2, y: 2 },
    ]),
  ])

  const [traceA, traceB] = solver.getOutput().traces

  expect(traceA!.tracePath[1]!.x).toBeCloseTo(1.04)
  expect(traceA!.tracePath[2]!.x).toBeCloseTo(1.04)
  expect(traceB!.tracePath[1]!.x).toBeCloseTo(1.04)
  expect(traceB!.tracePath[2]!.x).toBeCloseTo(1.04)
})

test("does not merge close segments from different nets", () => {
  const solver = solve([
    makeTrace("trace-a", "net-1", [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 2, y: 1 },
      { x: 2, y: 0 },
    ]),
    makeTrace("trace-b", "net-2", [
      { x: 0, y: 2 },
      { x: 0, y: 1.08 },
      { x: 2, y: 1.08 },
      { x: 2, y: 2 },
    ]),
  ])

  const [traceA, traceB] = solver.getOutput().traces

  expect(traceA!.tracePath[1]!.y).toBe(1)
  expect(traceA!.tracePath[2]!.y).toBe(1)
  expect(traceB!.tracePath[1]!.y).toBe(1.08)
  expect(traceB!.tracePath[2]!.y).toBe(1.08)
  expect(solver.stats.mergedSegmentGroups).toBe(0)
})

test("does not move terminal segments because they pin trace endpoints", () => {
  const solver = solve([
    makeTrace("trace-a", "net-1", [
      { x: 0, y: 1 },
      { x: 2, y: 1 },
      { x: 2, y: 0 },
    ]),
    makeTrace("trace-b", "net-1", [
      { x: 0, y: 2 },
      { x: 0, y: 1.08 },
      { x: 2, y: 1.08 },
      { x: 2, y: 2 },
    ]),
  ])

  const [traceA, traceB] = solver.getOutput().traces

  expect(traceA!.tracePath[0]).toEqual({ x: 0, y: 1 })
  expect(traceA!.tracePath[1]).toEqual({ x: 2, y: 1 })
  expect(traceB!.tracePath[1]!.y).toBe(1.08)
  expect(traceB!.tracePath[2]!.y).toBe(1.08)
  expect(solver.stats.mergedSegmentGroups).toBe(0)
})

test("rejects a same-net merge that would introduce a different-net crossing", () => {
  const solver = solve([
    makeTrace("trace-a", "net-1", [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 2, y: 1 },
      { x: 2, y: 0 },
    ]),
    makeTrace("trace-b", "net-1", [
      { x: 0, y: 2 },
      { x: 0, y: 1.08 },
      { x: 2, y: 1.08 },
      { x: 2, y: 2 },
    ]),
    makeTrace("blocking-trace", "net-2", [
      { x: 1, y: 1.03 },
      { x: 1, y: 1.05 },
    ]),
  ])

  const [traceA, traceB] = solver.getOutput().traces

  expect(traceA!.tracePath[1]!.y).toBe(1)
  expect(traceA!.tracePath[2]!.y).toBe(1)
  expect(traceB!.tracePath[1]!.y).toBe(1.08)
  expect(traceB!.tracePath[2]!.y).toBe(1.08)
  expect(solver.stats.mergedSegmentGroups).toBe(0)
  expect(solver.stats.skippedUnsafeGroups).toBe(1)
})
