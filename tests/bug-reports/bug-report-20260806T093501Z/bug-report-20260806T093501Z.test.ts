import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import { detectTraceLabelOverlap } from "lib/solvers/TraceLabelOverlapAvoidanceSolver/detectTraceLabelOverlap"
import inputProblem from "./bug-report-20260806T093501Z.json"
import "tests/fixtures/matcher"

test("bug-report-20260806T093501Z", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  const vmRailTrace = solver
    .sameNetJunctionAlignmentSolver!.getOutput()
    .traces.find(
      (trace) => trace.mspPairId === "schematic_port_41-schematic_port_48",
    )
  expect(vmRailTrace).toBeDefined()

  const vmRailTraceLength = vmRailTrace!.tracePath.reduce(
    (length, point, pointIndex, tracePath) => {
      if (pointIndex === 0) return length
      const previousPoint = tracePath[pointIndex - 1]!
      return (
        length +
        Math.abs(point.x - previousPoint.x) +
        Math.abs(point.y - previousPoint.y)
      )
    },
    0,
  )
  expect(vmRailTraceLength).toBeCloseTo(12.002)
  expect(vmRailTrace!.tracePath).toEqual([
    { x: -12, y: 6.88 },
    { x: -12, y: 8.301 },
    { x: -5.9, y: 8.301 },
    { x: -5.9, y: 5.920000000000001 },
    { x: -4, y: 5.920000000000001 },
    { x: -4, y: 6.12 },
  ])

  const groundTrace = solver
    .sameNetJunctionAlignmentSolver!.getOutput()
    .traces.find(
      (trace) => trace.mspPairId === "schematic_port_25-schematic_port_42",
    )
  expect(groundTrace?.tracePath).toEqual([
    { x: -7.7, y: 3.299999999999999 },
    { x: -7.7, y: 4.840999999999999 },
    { x: -8.699999999999998, y: 4.840999999999999 },
    { x: -8.699999999999998, y: 4.71 },
    { x: -12, y: 4.71 },
    { x: -12, y: 6.12 },
  ])

  const finalOutput = solver.sameNetJunctionAlignmentSolver!.getOutput()
  expect(
    detectTraceLabelOverlap({
      traces: finalOutput.traces,
      netLabels: finalOutput.netLabelPlacements,
    }).map(({ trace, label }) => `${trace.mspPairId}->${label.netId}`),
  ).toEqual([
    "schematic_port_25-schematic_port_42->.C_CP > .pin2 to .U_GATE > .CPL",
  ])

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
