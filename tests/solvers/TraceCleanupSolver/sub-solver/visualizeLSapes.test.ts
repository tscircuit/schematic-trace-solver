import { test, expect } from "bun:test"
import { visualizeLSapes } from "lib/solvers/TraceCleanupSolver/sub-solver/visualizeLSapes"
import type { LShape } from "lib/solvers/TraceCleanupSolver/sub-solver/findAllLShapedTurns"

test("visualizeLSapes handles single LShape", () => {
  const lShape: LShape = {
    p1: { x: 0, y: 0 },
    p2: { x: 0, y: 1 },
    p3: { x: 1, y: 1 },
  }

  const result = visualizeLSapes(lShape)
  expect(result.circles).toHaveLength(1)
  expect(result.lines).toHaveLength(1)
})

test("visualizeLSapes handles array of LShapes", () => {
  const lShapes: LShape[] = [
    {
      p1: { x: 0, y: 0 },
      p2: { x: 0, y: 1 },
      p3: { x: 1, y: 1 },
    },
    {
      p1: { x: 10, y: 0 },
      p2: { x: 10, y: 1 },
      p3: { x: 11, y: 1 },
    },
  ]

  const result = visualizeLSapes(lShapes)
  expect(result.circles).toHaveLength(2)
  expect(result.lines).toHaveLength(2)
})

test("visualizeLSapes marks corner with blue circle", () => {
  const lShape: LShape = {
    p1: { x: 0, y: 0 },
    p2: { x: 0, y: 1 },
    p3: { x: 1, y: 1 },
  }

  const result = visualizeLSapes(lShape)
  expect(result.circles![0].fill).toBe("blue")
  expect(result.circles![0].center).toEqual({ x: 0, y: 1 })
})

test("visualizeLSapes draws lines with correct points", () => {
  const lShape: LShape = {
    p1: { x: 0, y: 0 },
    p2: { x: 0, y: 1 },
    p3: { x: 1, y: 1 },
  }

  const result = visualizeLSapes(lShape)
  expect(result.lines![0].points).toEqual([
    { x: 0, y: 0 },
    { x: 0, y: 1 },
    { x: 1, y: 1 },
  ])
})

test("visualizeLSapes uses light blue color for lines", () => {
  const lShape: LShape = {
    p1: { x: 0, y: 0 },
    p2: { x: 0, y: 1 },
    p3: { x: 1, y: 1 },
  }

  const result = visualizeLSapes(lShape)
  expect(result.lines![0].strokeColor).toBe("lightblue")
})
