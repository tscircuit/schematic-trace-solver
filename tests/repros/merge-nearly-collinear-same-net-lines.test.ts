import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "./assets/repro34-nearly-collinear-same-net-lines.input.json"
import "tests/fixtures/matcher"

/**
 * https://github.com/tscircuit/schematic-trace-solver/issues/34
 *
 * Two traces of the same net approach the JP5.1 pin with vertical lines at
 * slightly different X (x=3.6 from JP9.1 and x≈3.5256 from R1.2), leaving a
 * small jog where they meet. The SameNetTraceMergeSolver should snap them to
 * the same X so they render as one straight line.
 */
test("repro34 nearly-collinear same-net trace lines are merged to the same X", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)
  solver.solve()

  const traces = solver.netLabelNetLabelCollisionSolver!.traces
  const jp9Trace = traces.find((t) => t.mspPairId === "JP9.1-JP5.1")!
  const r1Trace = traces.find((t) => t.mspPairId === "R1.2-JP5.1")!
  expect(jp9Trace).toBeDefined()
  expect(r1Trace).toBeDefined()

  const getVerticalXs = (tracePath: Array<{ x: number; y: number }>) => {
    const xs: number[] = []
    for (let i = 0; i + 1 < tracePath.length; i++) {
      if (Math.abs(tracePath[i]!.x - tracePath[i + 1]!.x) < 1e-6) {
        xs.push(tracePath[i]!.x)
      }
    }
    return xs
  }

  // Both traces should run their long vertical line at the same X
  const jp9VerticalXs = getVerticalXs(jp9Trace.tracePath)
  const r1VerticalXs = getVerticalXs(r1Trace.tracePath)
  expect(jp9VerticalXs.length).toBe(1)
  expect(r1VerticalXs.length).toBe(1)
  expect(Math.abs(jp9VerticalXs[0]! - r1VerticalXs[0]!)).toBeLessThan(1e-6)

  // Pins must not have moved
  expect(jp9Trace.tracePath[0]).toEqual({ x: 3.8000000000000003, y: -0.9 })
  expect(jp9Trace.tracePath[jp9Trace.tracePath.length - 1]).toEqual({
    x: 3.8000000000000003,
    y: 0,
  })

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
