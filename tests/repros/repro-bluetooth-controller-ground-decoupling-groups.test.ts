import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputProblem from "./assets/repro-bluetooth-controller-ground-decoupling-groups.input.json"

test("repro Bluetooth controller GND trace between decoupling groups", () => {
  const solver = new SchematicTracePipelineSolver(
    inputProblem as InputProblem,
    {
      hideRatsNet: true,
    },
  )

  solver.solve()

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
