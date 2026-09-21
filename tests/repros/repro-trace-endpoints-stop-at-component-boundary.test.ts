import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputProblemJson from "./assets/repro-trace-endpoints-stop-at-component-boundary.input.json"

const inputProblem: InputProblem = JSON.parse(JSON.stringify(inputProblemJson))

// F1 and RV1 have ports inside their text-expanded component bounds. The
// routed traces currently stop at the lower bounds instead of reaching the
// original left-facing port coordinates.
test("trace endpoints stop at component boundaries before reaching target ports", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem, {
    hideRatsNet: true,
  })

  solver.solve()

  expect(solver.schematicTraceLinesSolver!.solvedTracePaths).toHaveLength(2)
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
