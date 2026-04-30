import { test, expect } from "bun:test"
import { generateLShapeRerouteCandidates } from "lib/solvers/TraceCleanupSolver/sub-solver/generateLShapeRerouteCandidates"
import type { LShape } from "lib/solvers/TraceCleanupSolver/sub-solver/findAllLShapedTurns"
import type { Rectangle } from "lib/solvers/TraceCleanupSolver/sub-solver/generateRectangleCandidates"

test("generateLShapeRerouteCandidates generates valid reroute paths", () => {
  const lShape: LShape = {
    p1: { x: 0, y: 0 },
    p2: { x: 0, y: 1 },
    p3: { x: 1, y: 1 },
  }

  const rectangle: Rectangle = {
    x: 0,
    y: 1,
    width: 1,
    height: 1,
  }

  const result = generateLShapeRerouteCandidates({
    lShape,
    rectangle,
    padding: 0.5,
    interactionPoint1: { x: 0, y: 0.5 },
    interactionPoint2: { x: 0.5, y: 1 },
  })

  expect(result).toBeDefined()
  expect(Array.isArray(result)).toBe(true)
})

test("generateLShapeRerouteCandidates returns array of paths", () => {
  const lShape: LShape = {
    p1: { x: 0, y: 0 },
    p2: { x: 0, y: 1 },
    p3: { x: 1, y: 1 },
  }

  const rectangle: Rectangle = {
    x: 0,
    y: 1,
    width: 1,
    height: 1,
  }

  const result = generateLShapeRerouteCandidates({
    lShape,
    rectangle,
    padding: 0.5,
    interactionPoint1: { x: 0, y: 0.5 },
    interactionPoint2: { x: 0.5, y: 1 },
  })

  // Should return multiple candidate paths
  expect(result.length).toBeGreaterThan(0)
  for (const path of result) {
    expect(Array.isArray(path)).toBe(true)
    expect(path.length).toBeGreaterThan(0)
  }
})

test("generateLShapeRerouteCandidates handles different padding values", () => {
  const lShape: LShape = {
    p1: { x: 0, y: 0 },
    p2: { x: 0, y: 1 },
    p3: { x: 1, y: 1 },
  }

  const rectangle: Rectangle = {
    x: 0,
    y: 1,
    width: 1,
    height: 1,
  }

  // With larger padding
  const result = generateLShapeRerouteCandidates({
    lShape,
    rectangle,
    padding: 1.0,
    interactionPoint1: { x: 0, y: 0.5 },
    interactionPoint2: { x: 0.5, y: 1 },
  })

  expect(result).toBeDefined()
  expect(Array.isArray(result)).toBe(true)
})
