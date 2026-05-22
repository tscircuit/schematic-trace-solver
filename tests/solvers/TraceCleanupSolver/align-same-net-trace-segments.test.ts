import { expect, test } from "bun:test"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { alignSameNetTraceSegments } from "lib/solvers/TraceCleanupSolver/alignSameNetTraceSegments"
import type { InputProblem } from "lib/types/InputProblem"

const makeTrace = (
  mspPairId: string,
  globalConnNetId: string,
  tracePath: Array<{ x: number; y: number }>,
): SolvedTracePath =>
  ({
    mspPairId,
    globalConnNetId,
    tracePath,
    mspConnectionPairIds: [mspPairId],
    pinIds: [`${mspPairId}.1`, `${mspPairId}.2`],
    pins: [],
  }) as unknown as SolvedTracePath

test("alignSameNetTraceSegments aligns a close same-net segment group to the longest segment", () => {
  const longest = makeTrace("pair-a", "NET1", [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 4, y: 1 },
    { x: 4, y: 0 },
  ])
  const middle = makeTrace("pair-b", "NET1", [
    { x: 0, y: 0.06 },
    { x: 1.2, y: 0.06 },
    { x: 1.2, y: 1.06 },
    { x: 3.2, y: 1.06 },
    { x: 3.2, y: 0.06 },
  ])
  const shortest = makeTrace("pair-c", "NET1", [
    { x: 0, y: 0.11 },
    { x: 1.4, y: 0.11 },
    { x: 1.4, y: 1.11 },
    { x: 2.8, y: 1.11 },
    { x: 2.8, y: 0.11 },
  ])

  const result = alignSameNetTraceSegments({
    traces: [middle, shortest, longest],
  })

  expect(result.changed).toBe(true)
  expect(result.traces[0]!.tracePath[2]!.y).toBe(1)
  expect(result.traces[0]!.tracePath[3]!.y).toBe(1)
  expect(result.traces[1]!.tracePath[2]!.y).toBe(1)
  expect(result.traces[1]!.tracePath[3]!.y).toBe(1)
  expect(result.traces[2]!.tracePath).toEqual(longest.tracePath)
})

test("alignSameNetTraceSegments aligns close interior vertical segments", () => {
  const left = makeTrace("pair-a", "NET1", [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 3 },
    { x: 0, y: 3 },
  ])
  const right = makeTrace("pair-b", "NET1", [
    { x: 0.08, y: 0 },
    { x: 1.08, y: 0 },
    { x: 1.08, y: 3 },
    { x: 0.08, y: 3 },
  ])

  const result = alignSameNetTraceSegments({ traces: [left, right] })

  expect(result.changed).toBe(true)
  expect(result.traces[1]!.tracePath).toEqual([
    { x: 0.08, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 3 },
    { x: 0.08, y: 3 },
  ])
})

test("alignSameNetTraceSegments does not align different nets", () => {
  const first = makeTrace("pair-a", "NET1", [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 3, y: 1 },
    { x: 3, y: 0 },
  ])
  const second = makeTrace("pair-b", "NET2", [
    { x: 0, y: 0.08 },
    { x: 1.2, y: 0.08 },
    { x: 1.2, y: 1.08 },
    { x: 2.8, y: 1.08 },
    { x: 2.8, y: 0.08 },
  ])

  const result = alignSameNetTraceSegments({ traces: [first, second] })

  expect(result.changed).toBe(false)
  expect(result.traces.map((trace) => trace.tracePath)).toEqual([
    first.tracePath,
    second.tracePath,
  ])
})

test("alignSameNetTraceSegments leaves endpoint-only segments anchored", () => {
  const first = makeTrace("pair-a", "NET1", [
    { x: 0, y: 0 },
    { x: 2, y: 0 },
    { x: 2, y: 1 },
  ])
  const second = makeTrace("pair-b", "NET1", [
    { x: 0, y: 0.08 },
    { x: 2, y: 0.08 },
    { x: 2, y: 1 },
  ])

  const result = alignSameNetTraceSegments({ traces: [first, second] })

  expect(result.changed).toBe(false)
  expect(result.traces.map((trace) => trace.tracePath)).toEqual([
    first.tracePath,
    second.tracePath,
  ])
})

test("alignSameNetTraceSegments does not align close segments within the same trace", () => {
  const trace = makeTrace("pair-a", "NET1", [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 3, y: 1 },
    { x: 3, y: 1.08 },
    { x: 1, y: 1.08 },
    { x: 1, y: 2 },
  ])

  const result = alignSameNetTraceSegments({ traces: [trace] })

  expect(result.changed).toBe(false)
  expect(result.traces[0]!.tracePath).toEqual(trace.tracePath)
})

test("alignSameNetTraceSegments rejects moves that add chip intersections", () => {
  const keep = makeTrace("pair-a", "NET1", [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 3, y: 1 },
    { x: 3, y: 0 },
  ])
  const move = makeTrace("pair-b", "NET1", [
    { x: 0, y: 0.08 },
    { x: 1.2, y: 0.08 },
    { x: 1.2, y: 1.08 },
    { x: 2.8, y: 1.08 },
    { x: 2.8, y: 0.08 },
  ])
  const inputProblem: InputProblem = {
    chips: [
      {
        chipId: "obstacle",
        center: { x: 2, y: 1 },
        width: 1,
        height: 0.08,
        pins: [],
      },
    ],
    directConnections: [],
    netConnections: [],
    availableNetLabelOrientations: {},
  }

  const result = alignSameNetTraceSegments({
    traces: [keep, move],
    inputProblem,
  })

  expect(result.changed).toBe(false)
  expect(result.traces.map((trace) => trace.tracePath)).toEqual([
    keep.tracePath,
    move.tracePath,
  ])
})
