import { test, expect } from "bun:test"
import { getOrthogonalMinimumSpanningTree } from "lib/solvers/MspConnectionPairSolver/getMspConnectionPairsFromPins"

test("getOrthogonalMinimumSpanningTree returns empty for no pins", () => {
  const result = getOrthogonalMinimumSpanningTree([])
  expect(result).toEqual([])
})

test("getOrthogonalMinimumSpanningTree returns empty for single pin", () => {
  const result = getOrthogonalMinimumSpanningTree([
    { pinId: "pin1", x: 0, y: 0 },
  ])
  expect(result).toEqual([])
})

test("getOrthogonalMinimumSpanningTree returns pairs for two pins", () => {
  const pins = [
    { pinId: "pin1", x: 0, y: 0 },
    { pinId: "pin2", x: 10, y: 0 },
  ]
  const result = getOrthogonalMinimumSpanningTree(pins)
  // Should connect pin1 and pin2
  expect(result.length).toBe(1)
  expect(result[0]).toContain("pin1")
  expect(result[0]).toContain("pin2")
})

test("getOrthogonalMinimumSpanningTree throws for duplicate pinIds", () => {
  const pins = [
    { pinId: "pin1", x: 0, y: 0 },
    { pinId: "pin1", x: 10, y: 0 },
  ]
  expect(() => getOrthogonalMinimumSpanningTree(pins)).toThrow()
})
