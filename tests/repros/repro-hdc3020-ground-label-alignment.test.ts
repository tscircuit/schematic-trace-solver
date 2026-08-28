import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputProblem from "./assets/repro-hdc3020-ground-label-alignment.input.json"

test("repro HDC3020 shared ground rail label alignment", () => {
  const solver = new SchematicTracePipelineSolver(
    inputProblem as InputProblem,
    {
      hideRatsNet: true,
    },
  )

  solver.solve()

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
