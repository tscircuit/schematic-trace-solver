import { test, expect } from "bun:test"
import { calculateElbow, type ElbowPoint } from "../lib"

test("elbow01", () => {
  const point1: ElbowPoint = { x: 0, y: 0 }
  const point2: ElbowPoint = { x: 3, y: 2 }
  const result = calculateElbow(point1, point2)
  expect(result).toEqual([
    { x: 0, y: 0 },
    { x: 1.5, y: 0 },
    { x: 1.5, y: 2 },
    { x: 3, y: 2 },
  ])
})
