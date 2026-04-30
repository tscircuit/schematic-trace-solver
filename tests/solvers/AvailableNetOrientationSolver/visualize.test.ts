import { test, expect } from "bun:test"

test("AvailableNetOrientationSolver visualize exports functions", async () => {
  const module = await import(
    "lib/solvers/AvailableNetOrientationSolver/visualize"
  )
  expect(typeof module.visualizeAvailableNetOrientationSolver).toBe("function")
})
