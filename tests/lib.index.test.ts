import { test, expect } from "bun:test"

test("lib index exports SchematicTracePipelineSolver", async () => {
  const module = await import("lib/index")
  expect(module.SchematicTracePipelineSolver).toBeDefined()
})

test("lib index exports SchematicTraceSingleLineSolver2", async () => {
  const module = await import("lib/index")
  expect(module.SchematicTraceSingleLineSolver2).toBeDefined()
})
