import { test, expect } from "bun:test"
import { removeDuplicateConsecutivePoints } from "lib/utils/removeDuplicateConsecutivePoints"

test("removeDuplicateConsecutivePoints removes consecutive duplicates", () => {
  const path = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 0 },
    { x: 2, y: 0 },
    { x: 2, y: 0 },
    { x: 2, y: 0 },
    { x: 3, y: 1 },
  ]
  const result = removeDuplicateConsecutivePoints(path)
  expect(result).toEqual([
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 2, y: 0 },
    { x: 3, y: 1 },
  ])
})

test("removeDuplicateConsecutivePoints handles empty path", () => {
  expect(removeDuplicateConsecutivePoints([])).toEqual([])
})

test("removeDuplicateConsecutivePoints handles single point", () => {
  expect(removeDuplicateConsecutivePoints([{ x: 1, y: 2 }])).toEqual([
    { x: 1, y: 2 },
  ])
})

test("removeDuplicateConsecutivePoints keeps non-consecutive duplicates", () => {
  const path = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: 0 },
  ]
  const result = removeDuplicateConsecutivePoints(path)
  expect(result).toEqual([
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: 0 },
  ])
})

test("removeDuplicateConsecutivePoints treats near-equal points as duplicates", () => {
  const path = [
    { x: 0, y: 0 },
    { x: 1e-10, y: 1e-10 },
    { x: 1, y: 1 },
  ]
  const result = removeDuplicateConsecutivePoints(path)
  expect(result).toEqual([
    { x: 0, y: 0 },
    { x: 1, y: 1 },
  ])
})
