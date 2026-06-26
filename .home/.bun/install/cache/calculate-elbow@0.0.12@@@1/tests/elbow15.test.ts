import { test, expect } from "bun:test"
import { calculateElbow } from "lib/index"

const scene = {
  point1: {
    x: 200,
    y: 250,
    facingDirection: "x+",
  },
  point2: {
    x: 300,
    y: 150,
    facingDirection: "y+",
  },
} as const

test("elbow15", () => {
  const result = calculateElbow(scene.point1, scene.point2, {
    overshoot: 50,
  })
  expect(result).toEqual([
    { x: 200, y: 250 },
    { x: 300, y: 250 },
    { x: 300, y: 150 },
  ])
})
