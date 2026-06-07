import { test, expect } from "bun:test"
import { removeDuplicateConsecutivePoints } from "lib/solvers/TraceCleanupSolver/simplifyPath"

test("removeDuplicateConsecutivePoints - empty array returns empty array", () => {
  expect(removeDuplicateConsecutivePoints([])).toEqual([])
})

test("removeDuplicateConsecutivePoints - single point returns unchanged", () => {
  const input = [{ x: 1, y: 2 }]
  expect(removeDuplicateConsecutivePoints(input)).toEqual([{ x: 1, y: 2 }])
})

test("removeDuplicateConsecutivePoints - no duplicates returns unchanged", () => {
  const input = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
  ]
  expect(removeDuplicateConsecutivePoints(input)).toEqual(input)
})

test("removeDuplicateConsecutivePoints - one consecutive duplicate is removed", () => {
  const input = [
    { x: 0, y: 0 },
    { x: 1, y: 1 },
    { x: 1, y: 1 },
    { x: 2, y: 2 },
  ]
  expect(removeDuplicateConsecutivePoints(input)).toEqual([
    { x: 0, y: 0 },
    { x: 1, y: 1 },
    { x: 2, y: 2 },
  ])
})

test("removeDuplicateConsecutivePoints - multiple consecutive duplicates are all removed", () => {
  const input = [
    { x: 0, y: 0 },
    { x: 1, y: 1 },
    { x: 1, y: 1 },
    { x: 1, y: 1 },
    { x: 2, y: 2 },
    { x: 2, y: 2 },
    { x: 3, y: 3 },
  ]
  expect(removeDuplicateConsecutivePoints(input)).toEqual([
    { x: 0, y: 0 },
    { x: 1, y: 1 },
    { x: 2, y: 2 },
    { x: 3, y: 3 },
  ])
})

test("removeDuplicateConsecutivePoints - non-consecutive duplicates are kept", () => {
  // Same x,y appears twice but not consecutively — both should be kept
  const input = [
    { x: 0, y: 0 },
    { x: 1, y: 1 },
    { x: 2, y: 2 },
    { x: 1, y: 1 },
    { x: 0, y: 0 },
  ]
  expect(removeDuplicateConsecutivePoints(input)).toEqual(input)
})

test("removeDuplicateConsecutivePoints - duplicate at splice boundary (UntangleTraceSubsolver scenario)", () => {
  // Simulates: slice(0, p2Index) ends with P, bestRoute starts with P, and slice(p2Index+1) starts with P
  const beforeSplice = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
  ]
  const bestRoute = [
    { x: 1, y: 0 }, // duplicates last point of beforeSplice
    { x: 1, y: 1 },
    { x: 2, y: 1 },
  ]
  const afterSplice = [
    { x: 2, y: 1 }, // duplicates last point of bestRoute
    { x: 3, y: 1 },
  ]
  const combined = [...beforeSplice, ...bestRoute, ...afterSplice]
  expect(removeDuplicateConsecutivePoints(combined)).toEqual([
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 2, y: 1 },
    { x: 3, y: 1 },
  ])
})
