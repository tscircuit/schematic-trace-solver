import { test, expect } from "bun:test"
import { calculateElbow } from "lib/index"

const scene = {
  point1: {
    x: 500,
    y: 100,
    facingDirection: "x-",
  },
  point2: {
    x: 150,
    y: 200,
    facingDirection: "x+",
  },
} as const

test("elbow23", () => {
  const result = calculateElbow(scene.point1, scene.point2, {
    overshoot: 50,
  })
  expect(result).toEqual([
    { x: 500, y: 100 },
    { x: 450, y: 100 },
    { x: 325, y: 100 },
    { x: 325, y: 200 },
    { x: 200, y: 200 },
    { x: 150, y: 200 },
  ])
})
