import { test, expect } from "bun:test"
import { calculateElbow, type ElbowPoint } from "../lib"

test.skip("elbow04", () => {
  const point1: ElbowPoint = { x: 0, y: 0, facingDirection: "x-" }
  const point2: ElbowPoint = { x: 3, y: 5, facingDirection: "x+" }
  const result = calculateElbow(point1, point2, {
    overshoot: 1,
  })
  expect(result).toEqual([
    { x: 0, y: 0 },
    { x: -1, y: 0 },
    { x: -1, y: 2.5 },
    { x: 4, y: 2.5 },
    { x: 4, y: 5 },
    { x: 3, y: 5 },
  ])
})
