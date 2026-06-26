import { test, expect } from "bun:test"
import { calculateElbow } from "lib/index"

const scene = {
  point1: {
    x: 150,
    y: 250,
    facingDirection: "x+",
  },
  point2: {
    x: 50,
    y: 150,
    facingDirection: "y+",
  },
} as const

test("elbow17", () => {
  const result = calculateElbow(scene.point1, scene.point2, {
    overshoot: 50,
  })
  expect(result).toEqual([
    { x: 150, y: 250 },
    { x: 200, y: 250 },
    { x: 200, y: 200 },
    { x: 50, y: 200 },
    { x: 50, y: 150 },
  ])
})
