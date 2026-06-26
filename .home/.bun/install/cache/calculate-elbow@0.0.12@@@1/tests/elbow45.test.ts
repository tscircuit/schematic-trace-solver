import { test, expect } from "bun:test"
import { calculateElbow } from "lib/index"

const scene = {
  point1: {
    x: -3.5512907000000005,
    y: 0.0002732499999993365,
    facingDirection: "x-",
  },
  point2: {
    x: 2.4487906999999995,
    y: -0.00027334999999961695,
    facingDirection: "x-",
  },
} as const

test("elbow45", () => {
  const overshoot = 0.2
  const result = calculateElbow(scene.point1, scene.point2, {
    overshoot,
  })
  const expected = [
    { x: scene.point1.x, y: scene.point1.y },
    { x: scene.point1.x - overshoot, y: scene.point1.y },
    { x: scene.point1.x - overshoot, y: scene.point1.y + overshoot },
    { x: scene.point2.x - overshoot, y: scene.point1.y + overshoot },
    { x: scene.point2.x - overshoot, y: scene.point2.y },
    { x: scene.point2.x, y: scene.point2.y },
  ]

  expect(result).toHaveLength(expected.length)
  for (let i = 0; i < result.length; i++) {
    expect(result[i]?.x).toBeCloseTo(expected[i]!.x, 5)
    expect(result[i]?.y).toBeCloseTo(expected[i]!.y, 5)
  }
})
