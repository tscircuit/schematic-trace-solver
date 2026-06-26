import { test, expect } from "bun:test"
import { calculateElbow, type ElbowPoint } from "../lib"

test("elbow05", () => {
  const point1: ElbowPoint = { x: 0, y: 0, facingDirection: "y+" }
  const point2: ElbowPoint = { x: 3, y: 5, facingDirection: "y+" }
  const result = calculateElbow(point1, point2, {
    overshoot: 1,
  })
  expect(result).toEqual([
    { x: 0, y: 0 },
    { x: 0, y: 6 }, // Move along p1's axis (y) to p2's effective target y
    { x: 3, y: 6 }, // Turn and move to p2's effective target x
    { x: 3, y: 5 }, // Final approach to p2
  ])
})
