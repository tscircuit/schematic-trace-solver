import { test, expect } from "bun:test"
import { countTurns } from "lib/solvers/TraceCleanupSolver/countTurns"

test("countTurns returns 0 for straight line", () => {
  const points = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 20, y: 0 },
  ]
  expect(countTurns(points)).toBe(0)
})

test("countTurns returns 1 for single corner", () => {
  const points = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
  ]
  expect(countTurns(points)).toBe(1)
})

test("countTurns returns 2 for S-curve", () => {
  const points = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 20, y: 10 },
  ]
  expect(countTurns(points)).toBe(2)
})

test("countTurns returns 0 for single point", () => {
  const points = [{ x: 5, y: 5 }]
  expect(countTurns(points)).toBe(0)
})

test("countTurns returns 0 for two points", () => {
  const points = [
    { x: 0, y: 0 },
    { x: 10, y: 10 },
  ]
  expect(countTurns(points)).toBe(0)
})
