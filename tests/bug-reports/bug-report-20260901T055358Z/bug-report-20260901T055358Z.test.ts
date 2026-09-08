import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "./bug-report-20260901T055358Z.json"
import "tests/fixtures/matcher"

test("bug-report-20260901T055358Z", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  const groundLabelConnectorId = "available-net-orientation-19-GND"
  const preAlignmentOutput =
    solver.preAlignmentNetLabelTraceCollisionSolver!.getOutput()
  const groundLabelConnector = preAlignmentOutput.traces.find(
    (trace) => trace.mspPairId === groundLabelConnectorId,
  )
  const cc2Label = preAlignmentOutput.netLabelPlacements.find(
    (label) => label.netId === "CC2",
  )
  const groundReroute = preAlignmentOutput.completedReroutes.find(
    (reroute) => reroute.initialTrace.mspPairId === groundLabelConnectorId,
  )

  // The anchored CC2 fallback temporarily forces a detour. Once inline
  // conversion succeeds and supersedes that fallback, its exact reroute is
  // safely unwound instead of changing CC2's orientation.
  expect(cc2Label?.orientation).toBe("y+")
  expect(groundReroute).toBeDefined()
  expect(groundLabelConnector).toBeDefined()
  expect(groundLabelConnector!.tracePath.length).toBeGreaterThan(2)

  const inlineOutput = solver.inlineNetLabelSolver!.getOutput()
  const restoredGroundLabelConnector = inlineOutput.traces.find(
    (trace) => trace.mspPairId === groundLabelConnectorId,
  )
  expect(
    inlineOutput.netLabelPlacements.some((label) => label.netId === "CC2"),
  ).toBe(false)
  expect(
    inlineOutput.inlineNetLabelPlacements.some(
      (label) => label.netId === "CC2",
    ),
  ).toBe(true)
  expect(restoredGroundLabelConnector?.tracePath).toEqual(
    groundReroute!.initialTrace.tracePath,
  )
  expect(
    solver.inlineNetLabelSolver!.stats.restoredSupersededLabelRerouteCount,
  ).toBe(1)

  const finalGroundLabelConnector = solver
    .netLabelToTraceSolver!.getOutput()
    .traces.find((trace) => trace.mspPairId === groundLabelConnectorId)
  expect(finalGroundLabelConnector?.tracePath).toEqual(
    restoredGroundLabelConnector?.tracePath,
  )

  // A reroute must not trade the USB_DN inline label for a tag over the
  // neighboring USB wires.
  expect(
    inlineOutput.inlineNetLabelPlacements.some((label) =>
      label.pinIds.includes("schematic_port_85"),
    ),
  ).toBe(true)
  for (const netLabelText of ["XIN", "XOUT"]) {
    const connection = inputProblem.netConnections.find(
      (connection) => connection.netLabelText === netLabelText,
    )!
    expect(connection.allowInlineNetLabel).toBe(true)
    expect(
      inlineOutput.inlineNetLabelPlacements.some(
        (label) => label.netId === connection.netId,
      ),
    ).toBe(true)
  }
  // IOVDD4 is a power-net anchor, not an opted-in inline signal.
  const power = inputProblem.netConnections.find((connection) =>
    connection.pinIds.includes("schematic_port_61"),
  )!
  expect(power.allowInlineNetLabel).not.toBe(true)
  expect(
    inlineOutput.netLabelPlacements.some((label) =>
      label.pinIds.includes("schematic_port_61"),
    ),
  ).toBe(true)
  expect(
    inlineOutput.inlineNetLabelPlacements.some((label) =>
      label.pinIds.includes("schematic_port_61"),
    ),
  ).toBe(false)
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
