import { test, expect } from "bun:test"
import { getAllPossibleOrderingsGenerator } from "lib/utils/getAllPossibleOrderingsGenerator"

test("getAllPossibleOrderingsGenerator yields empty for empty array", () => {
  const gen = getAllPossibleOrderingsGenerator([])
  const results: any[] = []
  for (const perm of gen) {
    results.push(perm)
  }
  expect(results).toEqual([[]])
})

test("getAllPossibleOrderingsGenerator yields single permutation for 1 item", () => {
  const gen = getAllPossibleOrderingsGenerator([1])
  const results: any[] = []
  for (const perm of gen) {
    results.push(perm)
  }
  expect(results).toEqual([[1]])
})

test("getAllPossibleOrderingsGenerator yields 2 permutations for 2 items", () => {
  const gen = getAllPossibleOrderingsGenerator([1, 2])
  const results: any[] = []
  for (const perm of gen) {
    results.push(perm)
  }
  expect(results.length).toBe(2)
  expect(results).toContainEqual([1, 2])
  expect(results).toContainEqual([2, 1])
})

test("getAllPossibleOrderingsGenerator yields 6 permutations for 3 items", () => {
  const gen = getAllPossibleOrderingsGenerator([1, 2, 3])
  const results: any[] = []
  for (const perm of gen) {
    results.push(perm)
  }
  expect(results.length).toBe(6)
})

test("getAllPossibleOrderingsGenerator does not mutate input", () => {
  const input = [1, 2]
  const gen = getAllPossibleOrderingsGenerator(input)
  for (const _ of gen) {
    // consume
  }
  expect(input).toEqual([1, 2])
})
