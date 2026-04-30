import { test, expect } from "bun:test"
import { anchorsForSegment } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/anchors"

test("anchorsForSegment returns start, midpoint, and end", () => {
  const a = { x: 0, y: 0 }
  const b = { x: 10, y: 0 }

  const result = anchorsForSegment(a, b)

  expect(result).toHaveLength(3)
  expect(result[0]).toEqual({ x: 0, y: 0 }) // start
  expect(result[1]).toEqual({ x: 5, y: 0 }) // midpoint
  expect(result[2]).toEqual({ x: 10, y: 0 }) // end
})

test("anchorsForSegment works for vertical segment", () => {
  const a = { x: 5, y: 0 }
  const b = { x: 5, y: 10 }

  const result = anchorsForSegment(a, b)

  expect(result[0]).toEqual({ x: 5, y: 0 })
  expect(result[1]).toEqual({ x: 5, y: 5 })
  expect(result[2]).toEqual({ x: 5, y: 10 })
})

test("anchorsForSegment works for diagonal segment", () => {
  const a = { x: 0, y: 0 }
  const b = { x: 10, y: 10 }

  const result = anchorsForSegment(a, b)

  expect(result[0]).toEqual({ x: 0, y: 0 })
  expect(result[1]).toEqual({ x: 5, y: 5 })
  expect(result[2]).toEqual({ x: 10, y: 10 })
})

test("anchorsForSegment handles negative coordinates", () => {
  const a = { x: -5, y: -5 }
  const b = { x: 5, y: 5 }

  const result = anchorsForSegment(a, b)

  expect(result[0]).toEqual({ x: -5, y: -5 })
  expect(result[1]).toEqual({ x: 0, y: 0 })
  expect(result[2]).toEqual({ x: 5, y: 5 })
})
