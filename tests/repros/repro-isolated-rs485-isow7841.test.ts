import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputProblem from "./assets/repro-isolated-rs485-isow7841.input.json"

test("repro isolated RS-485 ISOW7841 schematic traces", () => {
  const solver = new SchematicTracePipelineSolver(
    inputProblem as unknown as InputProblem,
  )

  solver.solve()

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
