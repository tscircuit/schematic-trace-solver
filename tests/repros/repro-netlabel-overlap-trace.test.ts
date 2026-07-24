import { expect, test } from "bun:test"
import { doSegmentsIntersect } from "@tscircuit/math-utils"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "./assets/repro-netlabel-overlap-trace.input.json"
import "tests/fixtures/matcher"

// Regression (from @tscircuit/core repro147): a GND net label ends up overlapping
// the B1/SW1 junction trace instead of being placed clear of it.
test("repro147 netlabel overlaps trace", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  const trace = solver.schematicTraceLinesSolver!.solvedTracePaths.find(
    (candidate) => candidate.mspPairId === "B1.1-SW1.1",
  )!
  const b1 = inputProblem.chips.find(
    (chip) => chip.chipId === "schematic_component_0",
  )!
  const b1Top = b1.center.y + b1.height / 2
  expect(
    trace.tracePath.some((point) => point.y > b1Top),
  ).toBe(true)
  const pendingTrace = solver.mspConnectionPairSolver!.mspConnectionPairs.find(
    (candidate) => candidate.mspPairId === "B1.2-C3.2",
  )!
  expect(
    trace.tracePath.some((point, index, path) => {
      const nextPoint = path[index + 1]
      return (
        nextPoint !== undefined &&
        doSegmentsIntersect(
          point,
          nextPoint,
          pendingTrace.pins[0],
          pendingTrace.pins[1],
        )
      )
    }),
  ).toBe(false)

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
