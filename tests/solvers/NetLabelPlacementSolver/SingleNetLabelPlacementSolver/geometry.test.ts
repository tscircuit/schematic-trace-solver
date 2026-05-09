import { test, expect } from "bun:test"
import {
  getDimsForOrientation,
  getCenterFromAnchor,
} from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"

test("getDimsForOrientation returns correct dims for horizontal orientation", () => {
  const result = getDimsForOrientation({ orientation: "x+" })
  expect(result.width).toBeDefined()
  expect(result.height).toBeDefined()
  expect(result.width).toBeGreaterThan(0)
  expect(result.height).toBeGreaterThan(0)
})

test("getDimsForOrientation returns correct dims for vertical orientation", () => {
  const result = getDimsForOrientation({ orientation: "y+" })
  // For vertical orientation, width/height are swapped
  expect(result.width).toBeDefined()
  expect(result.height).toBeDefined()
})

test("getDimsForOrientation accepts custom netLabelWidth", () => {
  const result = getDimsForOrientation({
    orientation: "x+",
    netLabelWidth: 1.0,
  })
  expect(result.width).toBe(1.0)
})

test("getCenterFromAnchor returns correct center for x+ orientation", () => {
  const anchor = { x: 0, y: 0 }
  const result = getCenterFromAnchor(anchor, "x+", 0.5, 0.2)
  expect(result.x).toBe(0.25) // anchor.x + width/2
  expect(result.y).toBe(0)
})

test("getCenterFromAnchor returns correct center for x- orientation", () => {
  const anchor = { x: 0, y: 0 }
  const result = getCenterFromAnchor(anchor, "x-", 0.5, 0.2)
  expect(result.x).toBe(-0.25) // anchor.x - width/2
  expect(result.y).toBe(0)
})

test("getCenterFromAnchor returns correct center for y+ orientation", () => {
  const anchor = { x: 0, y: 0 }
  const result = getCenterFromAnchor(anchor, "y+", 0.5, 0.2)
  expect(result.x).toBe(0)
  expect(result.y).toBe(0.1) // anchor.y + height/2
})

test("getCenterFromAnchor returns correct center for y- orientation", () => {
  const anchor = { x: 0, y: 0 }
  const result = getCenterFromAnchor(anchor, "y-", 0.5, 0.2)
  expect(result.x).toBe(0)
  expect(result.y).toBe(-0.1) // anchor.y - height/2
})
