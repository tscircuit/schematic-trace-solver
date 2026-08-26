import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputProblemJson from "./assets/repro-isolated-rs485-isow7841.input.json"

test("repro isolated RS-485 ISOW7841 schematic traces", () => {
  const inputProblem: InputProblem = JSON.parse(
    JSON.stringify(inputProblemJson),
  )
  const solver = new SchematicTracePipelineSolver(inputProblem)

  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.schematicTraceLinesSolver?.solvedTracePaths).toHaveLength(50)
  expect(solver.schematicTraceLinesSolver?.failedConnectionPairs).toHaveLength(
    0,
  )
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
