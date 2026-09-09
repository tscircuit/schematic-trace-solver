import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "./assets/rtc-imu-microsd-section.input.json"
import "tests/fixtures/matcher"

test("RTC IMU microSD section trace routing", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)
  solver.solve()

  const output = solver.railNetLabelCornerPlacementSolver!.getOutput()
  const v3v3Label = output.netLabelPlacements.find(
    (label) =>
      label.netId === "V3V3" && label.pinIds.includes("schematic_port_23"),
  )!
  const labelConnector = output.traces.find(
    (trace) =>
      trace.mspPairId.startsWith("available-net-orientation-") &&
      trace.globalConnNetId === v3v3Label.globalConnNetId &&
      trace.tracePath.some(
        (point) =>
          point.x === v3v3Label.anchorPoint.x &&
          point.y === v3v3Label.anchorPoint.y,
      ),
  )!
  const traceEndpoints = [
    labelConnector.tracePath[0],
    labelConnector.tracePath[labelConnector.tracePath.length - 1],
  ]

  expect(traceEndpoints).toContainEqual(v3v3Label.anchorPoint)
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
