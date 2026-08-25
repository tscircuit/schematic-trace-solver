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
  const groundConnection = inputProblem.netConnections.find((connection) =>
    connection.pinIds.includes("schematic_port_14"),
  )!
  const groundTraces = traces.filter((trace) =>
    trace.pinIds.every((pinId) => groundConnection.pinIds.includes(pinId)),
  )
  const groundLabels = netLabelPlacements.filter(
    (label) => label.globalConnNetId === groundTraces[0]!.globalConnNetId,
  )
  const groundRailY = groundLabels[0]!.anchorPoint.y

  expect(groundLabels).toHaveLength(1)
  expect(groundTraces).toHaveLength(4)
  expect(
    groundTraces.every((trace) =>
      trace.tracePath.some((point, pointIndex) => {
        const nextPoint = trace.tracePath[pointIndex + 1]
        if (!nextPoint) return false
        return point.y === groundRailY && nextPoint.y === groundRailY
      }),
    ),
  ).toBe(true)
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
