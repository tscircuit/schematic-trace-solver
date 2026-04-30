import { test, expect } from "bun:test"

test("generateElbowVariants module exports functions", async () => {
  const module = await import(
    "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver/generateElbowVariants"
  )
  expect(typeof module.generateElbowVariants).toBe("function")
})
