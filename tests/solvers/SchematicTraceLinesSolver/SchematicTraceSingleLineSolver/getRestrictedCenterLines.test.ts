import { test, expect } from "bun:test"

test("getRestrictedCenterLines module exports functions", async () => {
  const module = await import(
    "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver/getRestrictedCenterLines"
  )
  expect(typeof module.getRestrictedCenterLines).toBe("function")
})
