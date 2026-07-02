import { expect, test } from "bun:test"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { alignNearbySameNetTraceSegments } from "lib/solvers/TraceCleanupSolver/alignNearbySameNetTraceSegments"
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

test("alignNearbySameNetTraceSegments aligns close interior horizontal segments on the same net", () => {
  const longTrace = makeTrace("pair-a", "NET1", [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 3, y: 1 },
    { x: 3, y: 0 },
  ])
  const shortTrace = makeTrace("pair-b", "NET1", [
    { x: 0, y: 0.08 },
    { x: 1.2, y: 0.08 },
    { x: 1.2, y: 1.08 },
    { x: 2.8, y: 1.08 },
    { x: 2.8, y: 0.08 },
  ])

  const result = alignNearbySameNetTraceSegments([longTrace, shortTrace])

  expect(result.changed).toBe(true)
  expect(result.traces[0]!.tracePath).toEqual(longTrace.tracePath)
  expect(result.traces[1]!.tracePath).toEqual([
    { x: 0, y: 0.08 },
    { x: 1.2, y: 0.08 },
    { x: 1.2, y: 1 },
    { x: 2.8, y: 1 },
    { x: 2.8, y: 0.08 },
  ])
})

test("alignNearbySameNetTraceSegments aligns close interior vertical segments on the same net", () => {
  const leftTrace = makeTrace("pair-a", "NET1", [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 3 },
    { x: 0, y: 3 },
  ])
  const rightTrace = makeTrace("pair-b", "NET1", [
    { x: 0.08, y: 0 },
    { x: 1.08, y: 0 },
    { x: 1.08, y: 3 },
    { x: 0.08, y: 3 },
  ])

  const result = alignNearbySameNetTraceSegments([leftTrace, rightTrace])

  expect(result.changed).toBe(true)
  expect(result.traces[0]!.tracePath).toEqual(leftTrace.tracePath)
  expect(result.traces[1]!.tracePath).toEqual([
    { x: 0.08, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 3 },
    { x: 0.08, y: 3 },
  ])
})

test("alignNearbySameNetTraceSegments leaves different nets unchanged", () => {
  const firstTrace = makeTrace("pair-a", "NET1", [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 3, y: 1 },
    { x: 3, y: 0 },
  ])
  const secondTrace = makeTrace("pair-b", "NET2", [
    { x: 0, y: 0.08 },
    { x: 1.2, y: 0.08 },
    { x: 1.2, y: 1.08 },
    { x: 2.8, y: 1.08 },
    { x: 2.8, y: 0.08 },
  ])

  const result = alignNearbySameNetTraceSegments([firstTrace, secondTrace])

  expect(result.changed).toBe(false)
  expect(result.traces.map((trace) => trace.tracePath)).toEqual([
    firstTrace.tracePath,
    secondTrace.tracePath,
  ])
})

test("alignNearbySameNetTraceSegments does not move endpoint segments", () => {
  const firstTrace = makeTrace("pair-a", "NET1", [
    { x: 0, y: 0 },
    { x: 2, y: 0 },
    { x: 2, y: 1 },
  ])
  const secondTrace = makeTrace("pair-b", "NET1", [
    { x: 0, y: 0.08 },
    { x: 2, y: 0.08 },
    { x: 2, y: 1 },
  ])

  const result = alignNearbySameNetTraceSegments([firstTrace, secondTrace])

  expect(result.changed).toBe(false)
  expect(result.traces.map((trace) => trace.tracePath)).toEqual([
    firstTrace.tracePath,
    secondTrace.tracePath,
  ])
})

test("alignNearbySameNetTraceSegments does not introduce obstacle intersections", () => {
  const keepTrace = makeTrace("pair-a", "NET1", [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 3, y: 1 },
    { x: 3, y: 0 },
  ])
  const moveTrace = makeTrace("pair-b", "NET1", [
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

  const result = alignNearbySameNetTraceSegments([keepTrace, moveTrace], {
    inputProblem,
  })

  expect(result.changed).toBe(false)
  expect(result.traces.map((trace) => trace.tracePath)).toEqual([
    keepTrace.tracePath,
    moveTrace.tracePath,
  ])
})
