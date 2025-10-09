import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import { inputProblem } from "site/examples/example14.page"
import { getSvgFromGraphicsObject } from "graphics-debug"

test("example14 snapshot", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem)

  solver.solve()

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})

test("example14 svg generation", async () => {
  const solver = new SchematicTracePipelineSolver(inputProblem)

  solver.solve()

  const graphicsObject = solver.visualize()
  const svg = getSvgFromGraphicsObject(graphicsObject, {
    backgroundColor: "white",
  })

  await Bun.write("example14_fix.svg", svg)
})