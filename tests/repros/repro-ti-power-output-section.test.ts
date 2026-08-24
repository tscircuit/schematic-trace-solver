import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import "tests/fixtures/matcher"
import inputProblem from "./repro-ti-power-output-section.input"

test("repro ti power output section", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem)

  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.traceCleanupSolver2!.stats.alignedTraceCount).toBe(2)

  const { traces } = solver.traceCleanupSolver2!.getOutput()
  const { netLabelPlacements } =
    solver.preAlignmentNetLabelTraceCollisionSolver!.getOutput()
  const gndTraces = traces.filter((trace) => trace.userNetId === "GND")
  const gndLabels = netLabelPlacements.filter((label) => label.netId === "GND")
  const gndRailY = gndLabels[0]!.anchorPoint.y

  expect(gndLabels).toHaveLength(1)
  expect(gndTraces).toHaveLength(4)
  expect(
    gndTraces.every((trace) =>
      trace.tracePath.some((point, pointIndex) => {
        const nextPoint = trace.tracePath[pointIndex + 1]
        if (!nextPoint) return false
        return point.y === gndRailY && nextPoint.y === gndRailY
      }),
    ),
  ).toBe(true)
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
