import { expect, test } from "bun:test"
import { mergeCloseParallelSegments } from "lib/solvers/TraceCleanupSolver/mergeCloseParallelSegments"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

const trace = (
  mspPairId: string,
  globalConnNetId: string,
  tracePath: { x: number; y: number }[],
): SolvedTracePath =>
  ({
    mspPairId,
    globalConnNetId,
    tracePath,
    mspConnectionPairIds: [mspPairId],
    pinIds: [],
    pins: [] as any,
    dcConnNetId: globalConnNetId,
  }) as unknown as SolvedTracePath

test("snaps close parallel horizontal segments on the same net to the same Y", () => {
  const traces = [
    trace("a", "VCC", [
      { x: 0, y: 0 },
      { x: 0, y: 1.0 },
      { x: 5, y: 1.0 },
      { x: 5, y: 2 },
    ]),
    trace("b", "VCC", [
      { x: 1, y: 0 },
      { x: 1, y: 1.1 },
      { x: 4, y: 1.1 },
      { x: 4, y: 2 },
    ]),
  ]

  const result = mergeCloseParallelSegments(traces)

  const yA = result[0]!.tracePath[1]!.y
  const yB = result[1]!.tracePath[1]!.y
  expect(yA).toBeCloseTo(yB)
  expect(yA).toBeCloseTo(1.05)
})

test("snaps close parallel vertical segments on the same net to the same X", () => {
  const traces = [
    trace("a", "GND", [
      { x: 0, y: 0 },
      { x: 1.0, y: 0 },
      { x: 1.0, y: 5 },
      { x: 2, y: 5 },
    ]),
    trace("b", "GND", [
      { x: 0, y: 1 },
      { x: 1.1, y: 1 },
      { x: 1.1, y: 4 },
      { x: 2, y: 4 },
    ]),
  ]

  const result = mergeCloseParallelSegments(traces)

  const xA = result[0]!.tracePath[1]!.x
  const xB = result[1]!.tracePath[1]!.x
  expect(xA).toBeCloseTo(xB)
  expect(xA).toBeCloseTo(1.05)
})

test("does not merge segments belonging to different nets", () => {
  const traces = [
    trace("a", "VCC", [
      { x: 0, y: 0 },
      { x: 0, y: 1.0 },
      { x: 5, y: 1.0 },
      { x: 5, y: 2 },
    ]),
    trace("b", "GND", [
      { x: 1, y: 0 },
      { x: 1, y: 1.1 },
      { x: 4, y: 1.1 },
      { x: 4, y: 2 },
    ]),
  ]

  const result = mergeCloseParallelSegments(traces)

  expect(result[0]!.tracePath[1]!.y).toBe(1.0)
  expect(result[1]!.tracePath[1]!.y).toBe(1.1)
})

test("does not merge segments that exceed the threshold", () => {
  const traces = [
    trace("a", "VCC", [
      { x: 0, y: 0 },
      { x: 0, y: 1.0 },
      { x: 5, y: 1.0 },
      { x: 5, y: 3 },
    ]),
    trace("b", "VCC", [
      { x: 1, y: 0 },
      { x: 1, y: 2.0 },
      { x: 4, y: 2.0 },
      { x: 4, y: 3 },
    ]),
  ]

  const result = mergeCloseParallelSegments(traces)

  expect(result[0]!.tracePath[1]!.y).toBe(1.0)
  expect(result[1]!.tracePath[1]!.y).toBe(2.0)
})

test("does not merge segments whose intervals don't overlap", () => {
  const traces = [
    trace("a", "VCC", [
      { x: 0, y: 0 },
      { x: 0, y: 1.0 },
      { x: 2, y: 1.0 },
      { x: 2, y: 2 },
    ]),
    trace("b", "VCC", [
      { x: 5, y: 0 },
      { x: 5, y: 1.1 },
      { x: 8, y: 1.1 },
      { x: 8, y: 2 },
    ]),
  ]

  const result = mergeCloseParallelSegments(traces)

  expect(result[0]!.tracePath[1]!.y).toBe(1.0)
  expect(result[1]!.tracePath[1]!.y).toBe(1.1)
})

test("preserves pin endpoints (does not modify first/last segment endpoints)", () => {
  const traces = [
    trace("a", "VCC", [
      { x: 0, y: 0.0 },
      { x: 5, y: 0.0 },
    ]),
    trace("b", "VCC", [
      { x: 0, y: 0.1 },
      { x: 5, y: 0.1 },
    ]),
  ]

  const result = mergeCloseParallelSegments(traces)

  expect(result[0]!.tracePath[0]!.y).toBe(0.0)
  expect(result[0]!.tracePath[1]!.y).toBe(0.0)
  expect(result[1]!.tracePath[0]!.y).toBe(0.1)
  expect(result[1]!.tracePath[1]!.y).toBe(0.1)
})
