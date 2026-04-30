import { test, expect } from "bun:test"
import { generateRectangleCandidates } from "lib/solvers/TraceCleanupSolver/sub-solver/generateRectangleCandidates"

test("generateRectangleCandidates returns empty for empty inputs", () => {
  expect(generateRectangleCandidates([], [])).toHaveLength(0)
})

test("generateRectangleCandidates handles multiple point pairs", () => {
  const p1 = [
    { x: 0, y: 0 },
    { x: 0, y: 2 },
  ]
  const p2 = [
    { x: 1, y: 0 },
    { x: 1, y: 2 },
  ]

  const candidates = generateRectangleCandidates(p1, p2)
  // Should have 2x2 = 4 possible rectangles
  expect(candidates.length).toBeGreaterThan(1)
})

test("generateRectangleCandidates generates valid rectangles", () => {
  const intersections1 = [
    { x: 0, y: 0 },
    { x: 0, y: 1 },
  ]
  const intersections2 = [
    { x: 1, y: 0 },
    { x: 1, y: 1 },
  ]

  const candidates = generateRectangleCandidates(intersections1, intersections2)
  expect(candidates.length).toBeGreaterThan(0)

  // Check first candidate has valid rectangle
  const first = candidates[0]
  expect(first.rect.width).toBeGreaterThan(0)
  expect(first.rect.height).toBeGreaterThan(0)
})

test("generateRectangleCandidates creates rectangles with correct bounds", () => {
  const p1 = [{ x: 0, y: 0 }]
  const p2 = [{ x: 5, y: 5 }]

  const candidates = generateRectangleCandidates(p1, p2)
  expect(candidates.length).toBe(1)

  const rect = candidates[0]!.rect
  expect(rect.x).toBe(0)
  expect(rect.y).toBe(0)
  expect(rect.width).toBe(5)
  expect(rect.height).toBe(5)
})

test("generateRectangleCandidates filters out degenerate rectangles", () => {
  // Two points that result in zero area when one dimension is same
  const p1 = [{ x: 0, y: 0 }]
  const p2 = [{ x: 0, y: 5 }] // same x = vertical line, zero width

  const candidates = generateRectangleCandidates(p1, p2)
  // Should filter out because width < 1e-6
  expect(candidates.length).toBe(0)
})
