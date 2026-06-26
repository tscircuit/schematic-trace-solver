import { test, expect } from "bun:test"
import { calculateElbow, type ElbowPoint } from "../lib"

test.skip("elbow03", () => {
  const point1: ElbowPoint = { x: 0, y: 0, facingDirection: "y-" }
  const point2: ElbowPoint = { x: 3, y: 2, facingDirection: "x-" }
  const result = calculateElbow(point1, point2, {
    overshoot: 1,
  })
  expect(result).toEqual([
    { x: 0, y: 0 },
    { x: 0, y: -1 }, // P1 overshoots to (0, -1)
    { x: 1.5, y: -1 }, // Midpoint X, P1 overshot Y
    { x: 1.5, y: 2 }, // Midpoint X, P2 Y (p2EffectiveTargetY is same as p2.y here)
    { x: 2, y: 2 }, // p2EffectiveTargetX (3 - 1), P2 Y
    { x: 3, y: 2 }, // Final P2
  ])
})
