import { test, expect } from "bun:test"
import { calculateElbow } from "lib/index"

const scene = {
  point1: {
    x: 100,
    y: 200,
    facingDirection: "y+",
  },
  point2: {
    x: 200,
    y: 50,
    facingDirection: "y+",
  },
} as const

test("elbow12", () => {
  const result = calculateElbow(scene.point1, scene.point2, {
    overshoot: 50,
  })
  expect(result).toEqual([
    { x: 100, y: 200 },
    { x: 100, y: 250 },
    { x: 200, y: 250 },
    { x: 200, y: 50 },
  ])
})
