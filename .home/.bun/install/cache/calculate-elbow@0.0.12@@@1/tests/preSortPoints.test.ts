import { test, expect } from "bun:test"
import { calculateElbow, type ElbowPoint } from "../lib"

test("pre-sort preserves start-to-end order", () => {
  const p1: ElbowPoint = { x: 0, y: 0 }
  const p2: ElbowPoint = { x: 3, y: 2 }
  const forward = calculateElbow(p1, p2)
  const backward = calculateElbow(p2, p1)
  expect(backward[0]).toEqual(p2)
  expect(backward[backward.length - 1]).toEqual(p1)
  expect(backward).toEqual([...forward].reverse())
})
