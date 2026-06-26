import { test, expect } from "bun:test"
import { calculateElbow } from "lib/index"

const scene = {
  point1: {
    x: 450,
    y: 150,
    facingDirection: "y+",
  },
  point2: {
    x: 300,
    y: 300,
    facingDirection: "x+",
  },
} as const

test("elbow27", () => {
  const result = calculateElbow(scene.point1, scene.point2, {
    overshoot: 50,
  })
  expect(result).toEqual([
    { x: 450, y: 150 },
    { x: 450, y: 300 },
    { x: 300, y: 300 },
  ])
})
