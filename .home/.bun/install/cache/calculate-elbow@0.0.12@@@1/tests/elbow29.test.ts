import { test, expect } from "bun:test"
import { calculateElbow } from "lib/index"

const scene = {
  point1: {
    x: 500,
    y: 200,
    facingDirection: "y+",
  },
  point2: {
    x: 250,
    y: 150,
    facingDirection: "x+",
  },
} as const

test("elbow29", () => {
  const result = calculateElbow(scene.point1, scene.point2, {
    overshoot: 50,
  })
  expect(result).toEqual([
    { x: 500, y: 200 },
    { x: 500, y: 250 },
    { x: 375, y: 250 },
    { x: 375, y: 150 },
    { x: 250, y: 150 },
  ])
})
