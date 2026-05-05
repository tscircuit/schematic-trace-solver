import { test, expect } from "bun:test"

test("visualizeInputProblem exports function", async () => {
  const module = await import(
    "lib/solvers/SchematicTracePipelineSolver/visualizeInputProblem"
  )
  expect(typeof module.visualizeInputProblem).toBe("function")
})
