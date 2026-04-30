import { test, expect } from "bun:test"
import {
  aabbFromPoints,
  midBetweenPointAndRect,
} from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/mid"

test("aabbFromPoints creates correct bounds", () => {
  const result = aabbFromPoints({ x: 5, y: 10 }, { x: 15, y: 20 })
  expect(result.minX).toBe(5)
  expect(result.maxX).toBe(15)
  expect(result.minY).toBe(10)
  expect(result.maxY).toBe(20)
})

test("aabbFromPoints handles reversed points", () => {
  const result = aabbFromPoints({ x: 15, y: 20 }, { x: 5, y: 10 })
  expect(result.minX).toBe(5)
  expect(result.maxX).toBe(15)
  expect(result.minY).toBe(10)
  expect(result.maxY).toBe(20)
})

test("midBetweenPointAndRect returns midpoint when point is to the left", () => {
  const rect = { minX: 10, maxX: 20, minY: 0, maxY: 10 }
  const result = midBetweenPointAndRect("x", { x: 0, y: 5 }, rect)
  expect(result).toEqual([5]) // (0 + 10) / 2 = 5
})

test("midBetweenPointAndRect returns midpoint when point is to the right", () => {
  const rect = { minX: 10, maxX: 20, minY: 0, maxY: 10 }
  const result = midBetweenPointAndRect("x", { x: 30, y: 5 }, rect)
  expect(result).toEqual([25]) // (30 + 20) / 2 = 25
})

test("midBetweenPointAndRect returns both sides when point is within rect", () => {
  const rect = { minX: 10, maxX: 20, minY: 0, maxY: 10 }
  const result = midBetweenPointAndRect("x", { x: 15, y: 5 }, rect)
  expect(result).toEqual([9.8, 20.2]) // minX - 0.2, maxX + 0.2
})

test("midBetweenPointAndRect works on y axis", () => {
  const rect = { minX: 0, maxX: 10, minY: 10, maxY: 20 }
  const result = midBetweenPointAndRect("y", { x: 5, y: 0 }, rect)
  expect(result).toEqual([5]) // (0 + 10) / 2 = 5
})
