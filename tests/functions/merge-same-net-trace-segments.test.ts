import { expect, test } from "bun:test"
import {
  mergeSameNetTraceSegments,
  SameNetTraceMergeSolver,
} from "lib/solvers/SameNetTraceMergeSolver/SameNetTraceMergeSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

const pin = (pinId: string, x: number, y: number) => ({
  pinId,
  chipId: "U1",
  x,
  y,
})

const trace = (
  mspPairId: string,
  globalConnNetId: string,
  yOffset: number,
): SolvedTracePath => ({
  mspPairId,
  dcConnNetId: globalConnNetId,
  globalConnNetId,
  mspConnectionPairIds: [mspPairId],
  pinIds: [`${mspPairId}-start`, `${mspPairId}-end`],
  pins: [
    pin(`${mspPairId}-start`, 0, yOffset),
    pin(`${mspPairId}-end`, 2, yOffset),
  ],
  tracePath: [
    { x: 0, y: yOffset },
    { x: 0, y: 1 + yOffset },
    { x: 2, y: 1 + yOffset },
    { x: 2, y: yOffset },
  ],
})

const getMiddleSegmentY = (trace: SolvedTracePath) => trace.tracePath[1]!.y

test("mergeSameNetTraceSegments aligns close overlapping same-net segments", () => {
  const traceA = trace("a", "net-1", 0)
  const traceB = trace("b", "net-1", 0.08)

  const result = mergeSameNetTraceSegments([traceA, traceB])

  expect(result.mergeCount).toBe(1)
  expect(getMiddleSegmentY(result.traces[0]!)).toBeCloseTo(1.04)
  expect(getMiddleSegmentY(result.traces[1]!)).toBeCloseTo(1.04)
  expect(result.traces[0]!.tracePath[0]).toEqual({ x: 0, y: 0 })
  expect(result.traces[1]!.tracePath[0]).toEqual({ x: 0, y: 0.08 })
})

test("mergeSameNetTraceSegments leaves different-net segments alone", () => {
  const traceA = trace("a", "net-1", 0)
  const traceB = trace("b", "net-2", 0.08)

  const result = mergeSameNetTraceSegments([traceA, traceB])

  expect(result.mergeCount).toBe(0)
  expect(getMiddleSegmentY(result.traces[0]!)).toBe(1)
  expect(getMiddleSegmentY(result.traces[1]!)).toBe(1.08)
})

test("mergeSameNetTraceSegments leaves same-net segments outside threshold alone", () => {
  const traceA = trace("a", "net-1", 0)
  const traceB = trace("b", "net-1", 0.3)

  const result = mergeSameNetTraceSegments([traceA, traceB])

  expect(result.mergeCount).toBe(0)
  expect(getMiddleSegmentY(result.traces[0]!)).toBe(1)
  expect(getMiddleSegmentY(result.traces[1]!)).toBe(1.3)
})

test("SameNetTraceMergeSolver exposes merged traces through getOutput", () => {
  const solver = new SameNetTraceMergeSolver({
    inputProblem: {
      chips: [],
      directConnections: [],
      netConnections: [],
      availableNetLabelOrientations: {},
    },
    traces: [trace("a", "net-1", 0), trace("b", "net-1", 0.08)],
  })

  solver.solve()

  expect(solver.getOutput().mergeCount).toBe(1)
  expect(getMiddleSegmentY(solver.getOutput().traces[0]!)).toBeCloseTo(1.04)
})
