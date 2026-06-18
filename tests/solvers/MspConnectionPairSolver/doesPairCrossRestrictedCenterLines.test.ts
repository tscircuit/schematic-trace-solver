import { test, expect } from "bun:test"

test("doesPairCrossRestrictedCenterLines exports function", async () => {
  const module = await import(
    "lib/solvers/MspConnectionPairSolver/doesPairCrossRestrictedCenterLines"
  )
  expect(typeof module.doesPairCrossRestrictedCenterLines).toBe("function")
})
