import { expect, test } from "bun:test"
import { SameNetTraceMergeSolver } from "lib/solvers/SameNetTraceMergeSolver/SameNetTraceMergeSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

const baseInputProblem = {
  chips: [],
  directConnections: [],
  netConnections: [],
}

function makeTrace(
  id: string,
  netId: string,
  path: Array<{ x: number; y: number }>,
): SolvedTracePath {
  return {
    mspPairId: id,
    dcConnNetId: netId,
    globalConnNetId: netId,
    userNetId: netId,
    pins: [] as any,
    mspConnectionPairIds: [id],
    pinIds: [],
    tracePath: path,
  }
}

test("merges two close parallel horizontal segments on same net", () => {
  // Two horizontal traces almost at the same y, overlapping x range
  const traceA = makeTrace("A", "GND", [
    { x: 0, y: 0 },
    { x: 2, y: 0 },
  ])
  const traceB = makeTrace("B", "GND", [
    { x: 0, y: 0.05 },
    { x: 2, y: 0.05 },
  ])

  const solver = new SameNetTraceMergeSolver({
    inputProblem: baseInputProblem as any,
    allTraces: [traceA, traceB],
  })
  solver.solve()

  const { traces } = solver.getOutput()

  // Should merge into a single trace
  expect(traces).toHaveLength(1)

  // The merged trace should have a y close to the midpoint (0.025)
  const midY = traces[0].tracePath[0].y
  expect(Math.abs(midY - 0.025)).toBeLessThan(1e-9)
})

test("merges two close parallel vertical segments on same net", () => {
  // Two vertical traces almost at the same x, overlapping y range
  const traceA = makeTrace("A", "VCC", [
    { x: 1, y: 0 },
    { x: 1, y: 3 },
  ])
  const traceB = makeTrace("B", "VCC", [
    { x: 1.07, y: 0 },
    { x: 1.07, y: 3 },
  ])

  const solver = new SameNetTraceMergeSolver({
    inputProblem: baseInputProblem as any,
    allTraces: [traceA, traceB],
  })
  solver.solve()

  const { traces } = solver.getOutput()
  expect(traces).toHaveLength(1)

  // Midpoint x = (1 + 1.07) / 2 = 1.035
  const midX = traces[0].tracePath[0].x
  expect(Math.abs(midX - 1.035)).toBeLessThan(1e-9)
})

test("does not merge segments on different nets", () => {
  // Same positions, but different net IDs
  const traceA = makeTrace("A", "GND", [
    { x: 0, y: 0 },
    { x: 2, y: 0 },
  ])
  const traceB = makeTrace("B", "VCC", [
    { x: 0, y: 0.05 },
    { x: 2, y: 0.05 },
  ])

  const solver = new SameNetTraceMergeSolver({
    inputProblem: baseInputProblem as any,
    allTraces: [traceA, traceB],
  })
  solver.solve()

  const { traces } = solver.getOutput()
  expect(traces).toHaveLength(2)
})

test("does not merge parallel segments that are too far apart", () => {
  // dy = 0.3 > MERGE_THRESHOLD (0.1)
  const traceA = makeTrace("A", "GND", [
    { x: 0, y: 0 },
    { x: 2, y: 0 },
  ])
  const traceB = makeTrace("B", "GND", [
    { x: 0, y: 0.3 },
    { x: 2, y: 0.3 },
  ])

  const solver = new SameNetTraceMergeSolver({
    inputProblem: baseInputProblem as any,
    allTraces: [traceA, traceB],
  })
  solver.solve()

  const { traces } = solver.getOutput()
  expect(traces).toHaveLength(2)
})

test("does not merge segments that don't overlap sufficiently in x range", () => {
  // Same y, same net, but x ranges don't overlap at all
  const traceA = makeTrace("A", "GND", [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
  ])
  const traceB = makeTrace("B", "GND", [
    { x: 3, y: 0.05 },
    { x: 5, y: 0.05 },
  ])

  const solver = new SameNetTraceMergeSolver({
    inputProblem: baseInputProblem as any,
    allTraces: [traceA, traceB],
  })
  solver.solve()

  const { traces } = solver.getOutput()
  expect(traces).toHaveLength(2)
})
