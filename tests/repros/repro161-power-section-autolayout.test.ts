import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputProblemJson from "./assets/repro161-power-section-autolayout.input.json"

const EXPECTED_V3V3_RAIL_Y = -3.105

// Captured from @tscircuit/core repro161 after schematic auto-layout.
test("core repro161 power section trace routing", () => {
  const inputProblem: InputProblem = JSON.parse(
    JSON.stringify(inputProblemJson),
  )
  const solver = new SchematicTracePipelineSolver(inputProblem)

  solver.solve()

  const v3v3Traces = solver.sameNetJunctionAlignmentSolver!.outputTraces.filter(
    (trace) => trace.userNetId === "V3V3",
  )
  const horizontalRailYs = v3v3Traces.flatMap((trace) =>
    trace.tracePath.flatMap((point, index) => {
      const nextPoint = trace.tracePath[index + 1]
      if (!nextPoint || point.y !== nextPoint.y) return []
      return [point.y]
    }),
  )

  expect(horizontalRailYs).toHaveLength(3)
  for (const railY of horizontalRailYs) {
    expect(railY).toBeCloseTo(EXPECTED_V3V3_RAIL_Y)
  }
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
