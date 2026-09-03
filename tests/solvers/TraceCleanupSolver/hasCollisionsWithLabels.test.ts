import { expect, test } from "bun:test"
import { hasCollisionsWithLabels } from "lib/solvers/TraceCleanupSolver/hasCollisionsWithLabels"

const labelBounds = [{ minX: 0, maxX: 1, minY: 0, maxY: 1 }]
const originalPath = [
  { x: 0.75, y: 2 },
  { x: 0.75, y: 1 },
  { x: 0.25, y: 1 },
]

test("allows extending an existing terminal segment along a label boundary", () => {
  const extension = [
    { x: 1.5, y: 1 },
    { x: 0.75, y: 1 },
  ]

  expect(hasCollisionsWithLabels(extension, labelBounds)).toBe(true)
  expect(
    hasCollisionsWithLabels(extension, labelBounds, { originalPath }),
  ).toBe(false)
})

test("still rejects label-interior crossings and disconnected boundary runs", () => {
  expect(
    hasCollisionsWithLabels(
      [
        { x: 1.5, y: 0.5 },
        { x: 0.75, y: 0.5 },
      ],
      labelBounds,
      { originalPath },
    ),
  ).toBe(true)
  expect(
    hasCollisionsWithLabels(
      [
        { x: -0.5, y: 1 },
        { x: 0.1, y: 1 },
      ],
      labelBounds,
      { originalPath },
    ),
  ).toBe(true)
})
