import { test, expect } from "bun:test"
import { dir, type FacingDirection } from "lib/utils/dir"

test("dir returns correct vector for x+", () => {
  expect(dir("x+")).toEqual({ x: 1, y: 0 })
})

test("dir returns correct vector for x-", () => {
  expect(dir("x-")).toEqual({ x: -1, y: 0 })
})

test("dir returns correct vector for y+", () => {
  expect(dir("y+")).toEqual({ x: 0, y: 1 })
})

test("dir returns correct vector for y-", () => {
  expect(dir("y-")).toEqual({ x: 0, y: -1 })
})

test("dir throws error for invalid direction", () => {
  expect(() => dir("invalid" as FacingDirection)).toThrow()
})
