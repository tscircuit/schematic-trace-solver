import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import "tests/fixtures/matcher"
import inputProblem from "./bug-report-20260825T103621Z.json"

test("bug-report-20260825T103621Z", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  const alignmentOutput = solver.traceCleanupSolver2!.getOutput()
  const getAlignedTrace = (mspPairId: string) =>
    alignmentOutput.traces.find((trace) => trace.mspPairId === mspPairId)
  const c14ToC16Trace = getAlignedTrace("schematic_port_52-schematic_port_50")
  const c16ToC17Trace = getAlignedTrace("schematic_port_54-schematic_port_52")
  const c22ToC23Trace = getAlignedTrace("schematic_port_74-schematic_port_72")
  const c23ToC24Trace = getAlignedTrace("schematic_port_76-schematic_port_74")
  const c24ToC26Trace = getAlignedTrace("schematic_port_78-schematic_port_76")

  expect(solver.traceCleanupSolver2!.stats).toMatchObject({
    alignedRailGroupCount: 2,
    alignedTraceCount: 3,
  })
  expect(c14ToC16Trace?.tracePath).toEqual([
    { x: -4.1, y: 4.62 },
    { x: -4.1, y: 3.8200000000000003 },
    { x: -5.2, y: 3.8200000000000003 },
    { x: -5.2, y: 5.22 },
  ])
  expect(c16ToC17Trace?.tracePath).toEqual([
    { x: -3.3, y: 4.0200000000000005 },
    { x: -3.3, y: 3.8200000000000003 },
    { x: -4.1, y: 3.8200000000000003 },
    { x: -4.1, y: 4.62 },
  ])
  expect(c22ToC23Trace?.tracePath).toEqual([
    { x: -6, y: -6.58 },
    { x: -6, y: -6.88 },
    { x: -7, y: -6.88 },
    { x: -7, y: -6.58 },
  ])
  expect(c23ToC24Trace?.tracePath).toEqual([
    { x: -5.1, y: -6.58 },
    { x: -5.1, y: -6.88 },
    { x: -6, y: -6.88 },
    { x: -6, y: -6.58 },
  ])
  expect(c24ToC26Trace?.tracePath).toEqual([
    { x: -3.9000000000000004, y: -6.68 },
    { x: -3.9000000000000004, y: -6.88 },
    { x: -5.1, y: -6.88 },
    { x: -5.1, y: -6.58 },
  ])

  const finalOutput = solver.sameNetJunctionAlignmentSolver!.getOutput()
  const getFinalTrace = (mspPairId: string) =>
    finalOutput.traces.find((trace) => trace.mspPairId === mspPairId)
  const lowerGroundTrace = getFinalTrace("schematic_port_48-schematic_port_44")
  const groundLabelConnector = getFinalTrace("available-net-orientation-13-GND")
  const createdGroundLabelConnector =
    solver.availableNetOrientationSolver!.traces.find(
      (trace) => trace.mspPairId === "available-net-orientation-13-GND",
    )
  const threePinGroundLabel = finalOutput.netLabelPlacements.find(
    (label) =>
      label.mspConnectionPairIds.includes(
        "schematic_port_44-schematic_port_13",
      ) && label.netId === "GND",
  )

  if (!lowerGroundTrace || !groundLabelConnector || !threePinGroundLabel) {
    throw new Error("Expected the three-pin GND traces and label")
  }

  expect(groundLabelConnector?.tracePath).toEqual([
    lowerGroundTrace.tracePath[1]!,
    threePinGroundLabel.anchorPoint,
  ])
  expect(createdGroundLabelConnector?.tracePath).toEqual(
    groundLabelConnector.tracePath,
  )
  expect(threePinGroundLabel.anchorPoint).toEqual({
    x: 2.105,
    y: -6.0749999999999975,
  })

  const topGroundLabel = finalOutput.netLabelPlacements.find(
    (label) =>
      label.mspConnectionPairIds.includes(
        "schematic_port_54-schematic_port_52",
      ) && label.netId === "GND",
  )
  const bottomGroundLabel = finalOutput.netLabelPlacements.find(
    (label) =>
      label.mspConnectionPairIds.includes(
        "schematic_port_78-schematic_port_76",
      ) && label.netId === "GND",
  )
  expect(topGroundLabel?.anchorPoint).toEqual({
    x: -3.3,
    y: 3.8200000000000003,
  })
  expect(bottomGroundLabel?.anchorPoint).toEqual({
    x: -3.9000000000000004,
    y: -6.88,
  })
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
