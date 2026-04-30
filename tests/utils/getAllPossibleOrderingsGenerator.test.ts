import { test, expect } from "bun:test"
import { getAllPossibleOrderingsGenerator } from "lib/utils/getAllPossibleOrderingsGenerator"

test("getAllPossibleOrderingsGenerator yields empty array for empty input", () => {
  const results = [...getAllPossibleOrderingsGenerator([])]
  expect(results).toEqual([[]])
})

test("getAllPossibleOrderingsGenerator yields single permutation for 1 item", () => {
  const results = [...getAllPossibleOrderingsGenerator([1])]
  expect(results).toEqual([[1]])
})

test("getAllPossibleOrderingsGenerator yields 2 permutations for 2 items", () => {
  const results = [...getAllPossibleOrderingsGenerator([1, 2])]
  expect(results).toHaveLength(2)
  expect(results).toContainEqual([1, 2])
  expect(results).toContainEqual([2, 1])
})

test("getAllPossibleOrderingsGenerator yields 6 permutations for 3 items", () => {
  const results = [...getAllPossibleOrderingsGenerator([1, 2, 3])]
  expect(results).toHaveLength(6) // 3! = 6
})

test("getAllPossibleOrderingsGenerator yields 24 permutations for 4 items", () => {
  const results = [...getAllPossibleOrderingsGenerator([1, 2, 3, 4])]
  expect(results).toHaveLength(24) // 4! = 24
})

test("getAllPossibleOrderingsGenerator does not mutate original array", () => {
  const arr = [1, 2, 3]
  const gen = getAllPossibleOrderingsGenerator(arr)
  const firstResult = gen.next()
  expect(arr).toEqual([1, 2, 3])
})

test("getAllPossibleOrderingsGenerator works with strings", () => {
  const results = [...getAllPossibleOrderingsGenerator(["a", "b"])]
  expect(results).toContainEqual(["a", "b"])
  expect(results).toContainEqual(["b", "a"])
})
