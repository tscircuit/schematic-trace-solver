import { test, expect } from "bun:test"
import { getPinMap } from "lib/solvers/AvailableNetOrientationSolver/traces"

test("getPinMap creates map from chips and pins", () => {
  const inputProblem = {
    chips: [
      {
        chipId: "U1",
        pins: [
          { pinId: "U1.pin1", x: 0, y: 0 },
          { pinId: "U1.pin2", x: 1, y: 0 },
        ],
      },
    ],
  } as any

  const result = getPinMap(inputProblem)

  expect(result["U1.pin1"]).toBeDefined()
  expect(result["U1.pin1"].chipId).toBe("U1")
  expect(result["U1.pin2"]).toBeDefined()
  expect(result["U1.pin2"].chipId).toBe("U1")
})

test("getPinMap returns empty for no chips", () => {
  const result = getPinMap({ chips: [] } as any)
  expect(Object.keys(result).length).toBe(0)
})
