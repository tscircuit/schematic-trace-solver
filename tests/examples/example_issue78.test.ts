import { test, expect } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import "tests/fixtures/matcher"
import inputProblem from "../assets/example_issue78.json"

/**
 * Reproduction for issue #78: "Fix extra trace lines in post-processing step"
 *
 * NE555 timer circuit with a J1 connector and maxMspPairDistance=6.
 * The UntangleTraceSubsolver reroutes L-shaped corners and the path
 * concatenation in _applyBestRoute() can produce duplicate consecutive
 * points or redundant collinear intermediate points, which render as
 * extra short line segments in the schematic output.
 *
 * This test verifies that all trace paths are clean after solving:
 * no duplicate consecutive points and no collinear intermediate points.
 */
test("example_issue78: NE555 with J1 connector should have clean trace paths", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  const traces = solver.traceCleanupSolver!.getOutput().traces

  for (const trace of traces) {
    const path = trace.tracePath

    // No duplicate consecutive points (would render as zero-length segments)
    for (let i = 0; i < path.length - 1; i++) {
      const p1 = path[i]
      const p2 = path[i + 1]
      const dist = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2)
      expect(dist).toBeGreaterThan(1e-9)
    }

    // No redundant collinear intermediate points (would render as extra segments)
    for (let i = 0; i < path.length - 2; i++) {
      const p1 = path[i]
      const p2 = path[i + 1]
      const p3 = path[i + 2]
      const isCollinearH =
        Math.abs(p1.y - p2.y) < 1e-9 && Math.abs(p2.y - p3.y) < 1e-9
      const isCollinearV =
        Math.abs(p1.x - p2.x) < 1e-9 && Math.abs(p2.x - p3.x) < 1e-9
      expect(isCollinearH || isCollinearV).toBe(false)
    }
  }

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
