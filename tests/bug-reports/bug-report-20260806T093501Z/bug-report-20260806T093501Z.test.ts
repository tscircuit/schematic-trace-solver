import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
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
  expect(vmRailTrace!.tracePath).toHaveLength(10)

  const groundTrace = solver
    .sameNetJunctionAlignmentSolver!.getOutput()
    .traces.find(
      (trace) => trace.mspPairId === "schematic_port_25-schematic_port_42",
    )
  expect(groundTrace?.tracePath).toEqual([
    { x: -7.7, y: 3.299999999999999 },
    { x: -7.7, y: 4.71 },
    { x: -12, y: 4.71 },
    { x: -12, y: 6.12 },
  ])

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
