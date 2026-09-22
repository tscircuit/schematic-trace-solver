import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputProblemJson from "./assets/repro-trace-endpoints-stop-at-component-boundary.input.json"

const inputProblem: InputProblem = JSON.parse(JSON.stringify(inputProblemJson))

// F1 and RV1 have ports inside their text-expanded component bounds. The
// router uses temporary boundary endpoints to avoid those obstacles, but the
// final traces must still reach the original left-facing port coordinates.
test("traces reach original ports inside expanded component bounds", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem, {
    hideRatsNet: true,
  })

  solver.solve()

  expect(solver.schematicTraceLinesSolver!.solvedTracePaths).toHaveLength(2)
  const traces = solver.netLabelToTraceSolver!.getOutput().traces
  expect(
    traces.find((trace) => trace.pinIds.includes("F1.1"))?.tracePath,
  ).toContainEqual({ x: -10.4, y: 6 })
  expect(
    traces.find((trace) => trace.pinIds.includes("RV1.1"))?.tracePath,
  ).toContainEqual({ x: -10.4, y: 3.5 })
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
