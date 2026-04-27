import { test, expect } from "bun:test"
import { SameNetTraceMergeSolver } from "lib/solvers/SameNetTraceMergeSolver/SameNetTraceMergeSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"

const inputProblem: InputProblem = {
  chips: [],
  directConnections: [],
  netConnections: [],
  availableNetLabelOrientations: {},
}

const buildTrace = (
  mspPairId: string,
  globalConnNetId: string,
  tracePath: { x: number; y: number }[],
): SolvedTracePath => ({
  mspPairId,
  dcConnNetId: globalConnNetId,
  globalConnNetId,
  pins: [
    { pinId: `${mspPairId}.a`, x: tracePath[0]!.x, y: tracePath[0]!.y, chipId: "A" },
    {
      pinId: `${mspPairId}.b`,
      x: tracePath[tracePath.length - 1]!.x,
      y: tracePath[tracePath.length - 1]!.y,
      chipId: "B",
    },
  ],
  tracePath,
  mspConnectionPairIds: [mspPairId],
  pinIds: [`${mspPairId}.a`, `${mspPairId}.b`],
})

test("merges two close parallel horizontal segments on the same net", () => {
  // Two paths on the same net. Each path has a middle horizontal segment
  // with non-pin endpoints separated by 0.05 in y.
  const traceA = buildTrace("A", "NET1", [
    { x: 0, y: 0 },
    { x: 0, y: 1.0 },
    { x: 4, y: 1.0 },
    { x: 4, y: 2 },
  ])
  const traceB = buildTrace("B", "NET1", [
    { x: 1, y: 0 },
    { x: 1, y: 1.05 },
    { x: 3, y: 1.05 },
    { x: 3, y: 2 },
  ])

  const solver = new SameNetTraceMergeSolver({
    inputProblem,
    traces: [traceA, traceB],
    gapThreshold: 0.15,
  })
  solver.solve()
  expect(solver.solved).toBe(true)

  const out = solver.getOutput().traces
  // Both middle segments should now share the same y.
  const aMid = out[0]!.tracePath[1]!.y
  const bMid = out[1]!.tracePath[1]!.y
  expect(Math.abs(aMid - bMid)).toBeLessThan(1e-6)
  // Pin endpoints unchanged.
  expect(out[0]!.tracePath[0]).toEqual({ x: 0, y: 0 })
  expect(out[0]!.tracePath[out[0]!.tracePath.length - 1]).toEqual({ x: 4, y: 2 })
  expect(out[1]!.tracePath[0]).toEqual({ x: 1, y: 0 })
  expect(out[1]!.tracePath[out[1]!.tracePath.length - 1]).toEqual({ x: 3, y: 2 })
})

test("does not merge segments on different nets", () => {
  const traceA = buildTrace("A", "NET1", [
    { x: 0, y: 0 },
    { x: 0, y: 1.0 },
    { x: 4, y: 1.0 },
    { x: 4, y: 2 },
  ])
  const traceB = buildTrace("B", "NET2", [
    { x: 1, y: 0 },
    { x: 1, y: 1.05 },
    { x: 3, y: 1.05 },
    { x: 3, y: 2 },
  ])

  const solver = new SameNetTraceMergeSolver({
    inputProblem,
    traces: [traceA, traceB],
    gapThreshold: 0.15,
  })
  solver.solve()

  const out = solver.getOutput().traces
  expect(out[0]!.tracePath[1]!.y).toBe(1.0)
  expect(out[1]!.tracePath[1]!.y).toBe(1.05)
})

test("does not merge segments whose gap exceeds the threshold", () => {
  const traceA = buildTrace("A", "NET1", [
    { x: 0, y: 0 },
    { x: 0, y: 1.0 },
    { x: 4, y: 1.0 },
    { x: 4, y: 2 },
  ])
  const traceB = buildTrace("B", "NET1", [
    { x: 1, y: 0 },
    { x: 1, y: 1.5 },
    { x: 3, y: 1.5 },
    { x: 3, y: 2.5 },
  ])

  const solver = new SameNetTraceMergeSolver({
    inputProblem,
    traces: [traceA, traceB],
    gapThreshold: 0.15,
  })
  solver.solve()

  const out = solver.getOutput().traces
  expect(out[0]!.tracePath[1]!.y).toBe(1.0)
  expect(out[1]!.tracePath[1]!.y).toBe(1.5)
})
