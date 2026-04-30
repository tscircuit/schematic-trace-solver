import { test, expect } from "bun:test"
import { visualizeCandidates } from "lib/solvers/TraceCleanupSolver/sub-solver/visualizeCandidates"

test("visualizeCandidates returns empty graphics for empty candidates", () => {
  const result = visualizeCandidates([])
  expect(result.lines).toHaveLength(0)
  expect(result.circles).toHaveLength(0)
})

test("visualizeCandidates creates lines for each candidate path", () => {
  const candidates = [
    [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ],
    [
      { x: 10, y: 10 },
      { x: 11, y: 11 },
    ],
  ]

  const result = visualizeCandidates(candidates)
  expect(result.lines).toHaveLength(2)
})

test("visualizeCandidates uses default gray color", () => {
  const candidates = [
    [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ],
  ]

  const result = visualizeCandidates(candidates)
  expect(result.lines![0].strokeColor).toBe("gray")
})

test("visualizeCandidates accepts custom color", () => {
  const candidates = [
    [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ],
  ]

  const result = visualizeCandidates(candidates, "blue")
  expect(result.lines![0].strokeColor).toBe("blue")
})

test("visualizeCandidates adds intersection points as green circles", () => {
  const candidates = [
    [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ],
  ]
  const intersectionPoints = [{ x: 0.5, y: 0.5 }]

  const result = visualizeCandidates(candidates, "gray", intersectionPoints)
  expect(result.circles).toHaveLength(1)
  expect(result.circles![0].fill).toBe("green")
})

test("visualizeCandidates intersection points have correct centers", () => {
  const candidates = [
    [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ],
  ]
  const intersectionPoints = [
    { x: 5, y: 5 },
    { x: 10, y: 10 },
  ]

  const result = visualizeCandidates(candidates, "gray", intersectionPoints)
  expect(result.circles).toHaveLength(2)
  expect(result.circles![0].center).toEqual({ x: 5, y: 5 })
  expect(result.circles![1].center).toEqual({ x: 10, y: 10 })
})

test("visualizeCandidates uses correct radius for intersection points", () => {
  const candidates = [
    [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ],
  ]
  const intersectionPoints = [{ x: 0, y: 0 }]

  const result = visualizeCandidates(candidates, "gray", intersectionPoints)
  expect(result.circles![0].radius).toBe(0.01)
})
