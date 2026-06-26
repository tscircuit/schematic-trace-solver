import { test, expect } from "bun:test"
import { calculateElbow } from "lib/index"

const scene = {
  point1: {
    x: 250,
    y: 200,
    facingDirection: "y-",
  },
  point2: {
    x: 350,
    y: 250,
    facingDirection: "y+",
  },
} as const

test.skip("elbow20", () => {
  const result = calculateElbow(scene.point1, scene.point2, {
    overshoot: 50,
  })
  expect(result).toEqual([
    { x: 250, y: 200 },
    { x: 250, y: 150 },
    { x: 300, y: 150 },
    { x: 300, y: 300 },
    { x: 350, y: 300 },
    { x: 350, y: 250 },
  ])
})
