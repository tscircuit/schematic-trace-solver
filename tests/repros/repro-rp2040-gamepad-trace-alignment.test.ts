import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import "tests/fixtures/matcher"
import inputProblem from "./assets/repro-rp2040-gamepad-trace-alignment.input.json"

test("reproduces RP2040 gamepad trace routing", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any, {
    hideRatsNet: true,
  })

  solver.solve()

  const finalTraces = solver
    .finalTraceCleanupSolver!.getOutput()
    .traces.filter((trace) => trace.userNetId === "GND")
  const leftRailXs = new Set<number>()
  const rightRailXs = new Set<number>()
  for (const trace of finalTraces) {
    for (let i = 0; i < trace.tracePath.length - 1; i++) {
      const start = trace.tracePath[i]!
      const end = trace.tracePath[i + 1]!
      if (Math.abs(start.x - end.x) > 1e-6) continue
      if (start.x < -1.778 - 1e-6) leftRailXs.add(start.x)
      if (start.x > 1.778 + 1e-6) rightRailXs.add(start.x)
    }
  }

  expect(leftRailXs.size).toBe(1)
  expect(rightRailXs.size).toBe(1)
  expect(
    solver.finalTraceCleanupSolver!.stats.alignedRailGroupCount,
  ).toBeGreaterThanOrEqual(2)
  expect(
    solver.finalTraceCleanupSolver!.stats.alignedTraceCount,
  ).toBeGreaterThanOrEqual(8)

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
