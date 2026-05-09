import { test, expect } from "bun:test"
import { doesTraceOverlapWithExistingTraces } from "lib/utils/does-trace-overlap-with-existing-traces"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

test("doesTraceOverlapWithExistingTraces returns false for empty traces", () => {
  const newTrace = [
    { x: 0, y: 0 },
    { x: 1, y: 1 },
  ]
  expect(doesTraceOverlapWithExistingTraces(newTrace, [])).toBe(false)
})

test("doesTraceOverlapWithExistingTraces returns true for overlapping trace", () => {
  const newTrace = [
    { x: 0, y: 0 },
    { x: 10, y: 10 },
  ]
  const existingTrace: SolvedTracePath = {
    mspPairId: "trace1",
    mspConnectionPairIds: [],
    pinIds: [],
    tracePath: [
      { x: 0, y: 10 },
      { x: 10, y: 0 },
    ],
  } as any

  expect(doesTraceOverlapWithExistingTraces(newTrace, [existingTrace])).toBe(
    true,
  )
})

test("doesTraceOverlapWithExistingTraces returns false for non-overlapping trace", () => {
  const newTrace = [
    { x: 0, y: 0 },
    { x: 1, y: 1 },
  ]
  const existingTrace: SolvedTracePath = {
    mspPairId: "trace1",
    mspConnectionPairIds: [],
    pinIds: [],
    tracePath: [
      { x: 100, y: 100 },
      { x: 110, y: 110 },
    ],
  } as any

  expect(doesTraceOverlapWithExistingTraces(newTrace, [existingTrace])).toBe(
    false,
  )
})

test("doesTraceOverlapWithExistingTraces checks all existing traces", () => {
  const newTrace = [
    { x: 5, y: 0 },
    { x: 5, y: 10 },
  ]

  const trace1: SolvedTracePath = {
    mspPairId: "trace1",
    mspConnectionPairIds: [],
    pinIds: [],
    tracePath: [
      { x: 0, y: 5 },
      { x: 4, y: 5 },
    ], // doesn't cross x=5
  } as any

  const trace2: SolvedTracePath = {
    mspPairId: "trace2",
    mspConnectionPairIds: [],
    pinIds: [],
    tracePath: [
      { x: 6, y: 5 },
      { x: 10, y: 5 },
    ], // doesn't cross x=5
  } as any

  // Should return false as neither trace crosses x=5
  expect(doesTraceOverlapWithExistingTraces(newTrace, [trace1, trace2])).toBe(
    false,
  )
})
