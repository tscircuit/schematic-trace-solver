import { test, expect } from "bun:test"
import { mergeGraphicsObjects } from "lib/solvers/TraceCleanupSolver/mergeGraphicsObjects"

test("mergeGraphicsObjects combines lines from multiple objects", () => {
  const objects = [
    {
      lines: [{ p1: { x: 0, y: 0 }, p2: { x: 1, y: 1 } }],
      points: [],
      rects: [],
      circles: [],
      texts: [],
    },
    {
      lines: [{ p1: { x: 2, y: 2 }, p2: { x: 3, y: 3 } }],
      points: [],
      rects: [],
      circles: [],
      texts: [],
    },
  ]
  const result = mergeGraphicsObjects(objects as any)
  expect(result.lines).toHaveLength(2)
})

test("mergeGraphicsObjects handles undefined objects", () => {
  const objects = [
    undefined,
    {
      lines: [{ p1: { x: 0, y: 0 }, p2: { x: 1, y: 1 } }],
      points: [],
      rects: [],
      circles: [],
      texts: [],
    },
    undefined,
  ]
  const result = mergeGraphicsObjects(objects as any)
  expect(result.lines).toHaveLength(1)
})

test("mergeGraphicsObjects returns empty object for empty array", () => {
  const result = mergeGraphicsObjects([])
  expect(result.lines).toHaveLength(0)
  expect(result.points).toHaveLength(0)
})
