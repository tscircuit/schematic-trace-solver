import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "./bug-report-20260825T103621Z.json"
import "tests/fixtures/matcher"

test("bug-report-20260825T103621Z", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  const alignmentOutput = solver.traceCleanupSolver2!.getOutput()
  const c24ToC26Trace = alignmentOutput.traces.find(
    (trace) => trace.mspPairId === "schematic_port_78-schematic_port_76",
  )
  const groundLabel = alignmentOutput.netLabelPlacements.find(
    (label) =>
      label.mspConnectionPairIds.includes(
        "schematic_port_78-schematic_port_76",
      ) && label.netId === "GND",
  )
  const finalOutput = solver.sameNetJunctionAlignmentSolver!.getOutput()
  const threePinGroundLabel = finalOutput.netLabelPlacements.find(
    (label) =>
      label.mspConnectionPairIds.includes(
        "schematic_port_44-schematic_port_13",
      ) && label.netId === "GND",
  )

  expect(solver.traceCleanupSolver2!.stats).toMatchObject({
    alignedRailGroupCount: 1,
    alignedTraceCount: 1,
  })
  expect(c24ToC26Trace?.tracePath).toEqual([
    { x: -3.9000000000000004, y: -6.68 },
    { x: -3.9000000000000004, y: -6.78 },
    { x: -5.1, y: -6.78 },
    { x: -5.1, y: -6.58 },
  ])
  expect(groundLabel?.anchorPoint).toEqual({
    x: -3.9000000000000004,
    y: -6.78,
  })
  expect(threePinGroundLabel?.anchorPoint).toEqual({
    x: 1.8150000000000002,
    y: -6.0749999999999975,
  })
  expect(
    finalOutput.traces.some(
      (trace) => trace.mspPairId === "available-net-orientation-13-GND",
    ),
  ).toBe(false)
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
