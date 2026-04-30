import { test, expect } from "bun:test"
import { isSegmentAnEndpointSegment } from "lib/solvers/TraceCleanupSolver/isSegmentAnEndpointSegment"

test("isSegmentAnEndpointSegment returns true for first segment", () => {
  const p1 = { x: 0, y: 0 }
  const p2 = { x: 10, y: 0 }
  const originalPath = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
  ]
  expect(isSegmentAnEndpointSegment(p1, p2, originalPath)).toBe(true)
})

test("isSegmentAnEndpointSegment returns true for last segment", () => {
  const p1 = { x: 10, y: 0 }
  const p2 = { x: 10, y: 10 }
  const originalPath = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
  ]
  expect(isSegmentAnEndpointSegment(p1, p2, originalPath)).toBe(true)
})

test("isSegmentAnEndpointSegment returns false for short path", () => {
  const p1 = { x: 0, y: 0 }
  const p2 = { x: 10, y: 0 }
  const originalPath = [{ x: 0, y: 0 }]
  expect(isSegmentAnEndpointSegment(p1, p2, originalPath)).toBe(false)
})
