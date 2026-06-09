import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "./assets/repro29-redundant-parallel-same-net-segments.input.json"
import "tests/fixtures/matcher"

/**
 * https://github.com/tscircuit/schematic-trace-solver/issues/29
 *
 * A solder jumper bridges R1, so JP6.2, R1.1 and R1.2 are one net. The
 * R1.2-R1.1 trace loops around the resistor body and its bottom leg
 * (y=0) runs redundantly right next to the straight JP6.2-R1.1 trace
 * (y=0.05), drawing two close parallel lines. The SameNetTraceMergeSolver
 * should combine them onto the same Y.
 */
test("repro29 close same-net trace segments are combined", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)
  solver.solve()

  const traces = solver.netLabelNetLabelCollisionSolver!.traces
  const straightTrace = traces.find((t) => t.mspPairId === "R1.1-JP6.2")!
  const loopTrace = traces.find((t) => t.mspPairId === "R1.2-R1.1")!
  expect(straightTrace).toBeDefined()
  expect(loopTrace).toBeDefined()

  const getHorizontalYs = (tracePath: Array<{ x: number; y: number }>) => {
    const ys: number[] = []
    for (let i = 0; i + 1 < tracePath.length; i++) {
      if (
        Math.abs(tracePath[i]!.y - tracePath[i + 1]!.y) < 1e-6 &&
        Math.abs(tracePath[i]!.x - tracePath[i + 1]!.x) > 1e-6
      ) {
        ys.push(tracePath[i]!.y)
      }
    }
    return ys
  }

  // The loop's bottom leg should lie on the same Y as the straight trace
  // instead of running parallel right below it
  const straightY = getHorizontalYs(straightTrace.tracePath)[0]!
  const loopBottomY = Math.min(...getHorizontalYs(loopTrace.tracePath))
  expect(Math.abs(loopBottomY - straightY)).toBeLessThan(1e-6)

  // Pins must not have moved
  expect(loopTrace.tracePath[0]!.x).toBeCloseTo(4.5, 9)
  expect(loopTrace.tracePath[0]!.y).toBeCloseTo(1.2, 9)
  expect(loopTrace.tracePath[loopTrace.tracePath.length - 1]!.x).toBeCloseTo(
    4.5,
    9,
  )
  expect(loopTrace.tracePath[loopTrace.tracePath.length - 1]!.y).toBeCloseTo(
    0.2,
    9,
  )

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
