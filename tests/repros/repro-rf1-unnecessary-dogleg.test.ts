import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import "tests/fixtures/matcher"
import inputProblem from "./assets/repro-rf1-unnecessary-dogleg.input.json"

// Captured from @tscircuit/core 0.0.1829 at commit b761dc8.
// The nearly level RF1 endpoints should produce an effectively straight trace,
// rather than a clearance-sized dogleg between the two inductors.
test("repro RF1 unnecessary dogleg between aligned inductors", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  const rfTrace = solver
    .netLabelToTraceSolver!.getOutput()
    .traces.find((trace) => trace.userNetId === "RF1")!
  const yCoordinates = rfTrace.tracePath.map((point) => point.y)

  expect(rfTrace.pins[0]!._facingDirection).toBe("x+")
  expect(Math.max(...yCoordinates) - Math.min(...yCoordinates)).toBeLessThan(
    0.01,
  )
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
