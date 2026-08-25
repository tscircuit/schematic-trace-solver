import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import "tests/fixtures/matcher"
import inputProblem from "./assets/repro-pga300-c6-trace-alignment.input.json"

test("repro: PGA300 C6 trace routing", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  expect(
    solver.sameNetJunctionAlignmentSolver!.stats.alignedJunctionCount,
  ).toBe(2)

  const alignedTraces = solver.sameNetJunctionAlignmentSolver!.outputTraces
  for (const [c6PinId, railY] of [
    ["C6.1", 0.95],
    ["C6.2", 0.15],
  ] as const) {
    const traceToU1 = alignedTraces.find(
      (trace) =>
        trace.pins.some((pin) => pin.pinId === c6PinId) &&
        trace.pins.some((pin) => pin.pinId.startsWith("U1.")),
    )!
    expect(
      traceToU1.tracePath.some(
        (point, index, path) =>
          index > 0 &&
          Math.abs(point.y - railY) < 1e-6 &&
          Math.abs(path[index - 1]!.y - railY) < 1e-6,
      ),
    ).toBe(true)
  }

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
