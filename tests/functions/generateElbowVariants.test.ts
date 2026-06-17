import { generateElbowVariants } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver/generateElbowVariants"
import { test, expect } from "bun:test"
import type { Guideline } from "lib/solvers/GuidelinesSolver/GuidelinesSolver"
import type { Point } from "@tscircuit/math-utils"

test.skip("generateElbowVariants - simple horizontal segment", () => {
  const baseElbow: Point[] = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 2 },
    { x: 3, y: 2 },
  ]

  const guidelines: Guideline[] = [
    { orientation: "vertical", x: 0.5, y: undefined },
    { orientation: "vertical", x: 1.5, y: undefined },
    { orientation: "horizontal", x: undefined, y: 1 },
  ]

  const result = generateElbowVariants({ baseElbow, guidelines })

  expect(result.movableSegments).toHaveLength(2)
  expect(result.movableSegments[0].freedom).toBe("y+")
  expect(result.movableSegments[1].freedom).toBe("x+")

  // Should generate variants for each combination of guideline positions
  expect(result.elbowVariants.length).toBeGreaterThan(1)
})

test("generateElbowVariants - no movable segments", () => {
  const baseElbow: Point[] = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
  ]

  const guidelines: Guideline[] = [
    { orientation: "vertical", x: 0.5, y: undefined },
  ]

  const result = generateElbowVariants({ baseElbow, guidelines })

  expect(result.movableSegments).toHaveLength(0)
  expect(result.elbowVariants).toHaveLength(1)
  expect(result.elbowVariants[0]).toEqual(baseElbow)
})

test.skip("generateElbowVariants - vertical movable segment", () => {
  const baseElbow: Point[] = [
    { x: 0, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: 2 },
    { x: 2, y: 2 },
  ]

  const guidelines: Guideline[] = [
    { orientation: "horizontal", x: undefined, y: 0.5 },
    { orientation: "horizontal", x: undefined, y: 1.5 },
  ]

  const result = generateElbowVariants({ baseElbow, guidelines })

  expect(result.movableSegments).toHaveLength(1)
  expect(result.movableSegments[0].freedom).toBe("x+")

  // Should include original position plus guideline positions
  expect(result.elbowVariants.length).toBe(3) // Original + 2 guidelines
})

test.skip("generateElbowVariants - multiple segments with guidelines", () => {
  const baseElbow: Point[] = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 2, y: 1 },
    { x: 2, y: 2 },
  ]

  const guidelines: Guideline[] = [
    { orientation: "vertical", x: 0.5, y: undefined },
    { orientation: "vertical", x: 1.5, y: undefined },
    { orientation: "horizontal", x: undefined, y: 0.5 },
    { orientation: "horizontal", x: undefined, y: 1.5 },
  ]

  const result = generateElbowVariants({ baseElbow, guidelines })

  expect(result.movableSegments).toHaveLength(3)

  // First segment moves vertically (y+/y-)
  expect(result.movableSegments[0].freedom).toMatch(/^y[+-]$/)
  // Second segment moves horizontally (x+/x-)
  expect(result.movableSegments[1].freedom).toMatch(/^x[+-]$/)
  // Third segment moves vertically (y+/y-)
  expect(result.movableSegments[2].freedom).toMatch(/^y[+-]$/)

  // Should generate multiple variants
  expect(result.elbowVariants.length).toBeGreaterThan(1)
})
