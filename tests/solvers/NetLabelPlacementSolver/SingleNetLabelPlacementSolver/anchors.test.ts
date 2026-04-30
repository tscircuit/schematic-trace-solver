import { test, expect } from "bun:test"
import { anchorsForSegment } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/anchors"

test("anchorsForSegment returns start, midpoint, end", () => {
  const result = anchorsForSegment({ x: 0, y: 0 }, { x: 10, y: 0 })
  expect(result).toEqual([
    { x: 0, y: 0 },
    { x: 5, y: 0 },
    { x: 10, y: 0 },
  ])
})

test("anchorsForSegment works with vertical segment", () => {
  const result = anchorsForSegment({ x: 5, y: 0 }, { x: 5, y: 10 })
  expect(result).toEqual([
    { x: 5, y: 0 },
    { x: 5, y: 5 },
    { x: 5, y: 10 },
  ])
})

test("anchorsForSegment works with negative coordinates", () => {
  const result = anchorsForSegment({ x: -5, y: -5 }, { x: 5, y: 5 })
  expect(result).toEqual([
    { x: -5, y: -5 },
    { x: 0, y: 0 },
    { x: 5, y: 5 },
  ])
})
