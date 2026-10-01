import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "./bug-report-20261001T055134Z.json"
import "tests/fixtures/matcher"

test("bug-report-20261001T055134Z", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  expect(solver.solved).toBe(true)
  const output = solver.netLabelToTraceSolver!.getOutput()
  const rail = output.traces.find(
    (trace) =>
      trace.pinIds.includes("schematic_port_15") &&
      trace.pinIds.includes("schematic_port_14") &&
      !solver.availableNetOrientationSolver!.netLabelConnectorTraceIds.has(
        trace.mspPairId,
      ),
  )!
  const connector = output.traces.find(
    (trace) =>
      trace.pinIds.includes("schematic_port_15") &&
      solver.availableNetOrientationSolver!.netLabelConnectorTraceIds.has(
        trace.mspPairId,
      ),
  )!
  const label = output.netLabelPlacements.find(
    (label) =>
      label.netId === "VBUS_RAW" && label.pinIds.includes("schematic_port_15"),
  )!
  const lowerPin = solver.inputProblem.chips[0]!.pins.find(
    (pin) => pin.pinId === "schematic_port_15",
  )!

  // Leave from the lower pin's rail corner, with just the elbow at the label.
  expect(connector.tracePath).toEqual([
    rail.tracePath[1]!,
    { x: label.anchorPoint.x, y: lowerPin.y },
    label.anchorPoint,
  ])
  expect(connector.tracePath[0]!.y).toBe(lowerPin.y)
  expect(rail.tracePath).toEqual(
    solver.schematicTraceLinesSolver!.solvedTracePaths.find(
      (trace) => trace.mspPairId === rail.mspPairId,
    )!.tracePath,
  )

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
