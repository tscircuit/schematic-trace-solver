import { test, expect } from "bun:test"
import {
  removeDuplicateConsecutivePoints,
  simplifyPath,
} from "lib/solvers/TraceCleanupSolver/simplifyPath"

test("removeDuplicateConsecutivePoints: empty path", () => {
  expect(removeDuplicateConsecutivePoints([])).toEqual([])
})

test("removeDuplicateConsecutivePoints: single point", () => {
  expect(removeDuplicateConsecutivePoints([{ x: 0, y: 0 }])).toEqual([
    { x: 0, y: 0 },
  ])
})

test("removeDuplicateConsecutivePoints: two different points", () => {
  expect(
    removeDuplicateConsecutivePoints([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ]),
  ).toEqual([
    { x: 0, y: 0 },
    { x: 1, y: 0 },
  ])
})

test("removeDuplicateConsecutivePoints: exact duplicates", () => {
  expect(
    removeDuplicateConsecutivePoints([
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ]),
  ).toEqual([
    { x: 0, y: 0 },
    { x: 1, y: 0 },
  ])
})

test("removeDuplicateConsecutivePoints: run of three duplicates", () => {
  expect(
    removeDuplicateConsecutivePoints([
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ]),
  ).toEqual([
    { x: 0, y: 0 },
    { x: 1, y: 0 },
  ])
})

test("removeDuplicateConsecutivePoints: non-consecutive kept", () => {
  expect(
    removeDuplicateConsecutivePoints([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 0 },
    ]),
  ).toEqual([
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: 0 },
  ])
})

test("removeDuplicateConsecutivePoints: near-duplicates within epsilon", () => {
  expect(
    removeDuplicateConsecutivePoints([
      { x: 0, y: 0 },
      { x: 1e-10, y: 0 },
      { x: 1, y: 1 },
    ]),
  ).toEqual([
    { x: 0, y: 0 },
    { x: 1, y: 1 },
  ])
})

test("simplifyPath: deduplicates before simplifying", () => {
  const result = simplifyPath([
    { x: 0, y: 0 },
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
  ])
  expect(result).toEqual([
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
  ])
})

test("simplifyPath: duplicate at splice boundary", () => {
  const result = simplifyPath([
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 0 },
    { x: 2, y: 1 },
    { x: 2, y: 2 },
  ])
  expect(result).toEqual([
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 2, y: 1 },
    { x: 2, y: 2 },
  ])
})
