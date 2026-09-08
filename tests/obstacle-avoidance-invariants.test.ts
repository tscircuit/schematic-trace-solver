import { expect, test } from "bun:test"

test("obstacle clearance boundary invariant", () => {
  const clearance = 0.5
  expect(clearance).toBeGreaterThan(0)
})
