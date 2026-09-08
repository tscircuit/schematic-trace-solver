import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import {
  EPS,
  tracePathContainsPoint,
} from "lib/solvers/RailNetLabelCornerPlacementSolver/geometry"
import type { InputProblem } from "lib/types/InputProblem"
import { convertSolverOutputToCircuitJson } from "tests/fixtures/convertSolverOutputToCircuitJson"
import "tests/fixtures/matcher"
import inputProblem from "./assets/repro-robot-controller-imu-tof.input.json"

// IMU/ToF section from ROVER, captured with @tscircuit/core 0.0.1861.
// Other sections are removed; retained placement and routing options are unchanged.
test("repro robot controller IMU and ToF trace routing", async () => {
  expect([
    ...new Set(inputProblem.chips.map((chip) => chip.sectionId)),
  ]).toEqual(["07_IMU_AND_TOF"])

  const solver = new SchematicTracePipelineSolver(
    inputProblem as InputProblem,
    { hideRatsNet: true },
  )

  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  const sclConnection = inputProblem.netConnections.find(
    (connection) => connection.netId === "I2C_SCL",
  )!
  const sclTrace = solver
    .netLabelToTraceSolver!.getOutput()
    .traces.find(
      (trace) =>
        trace.pinIds.includes("schematic_port_275") &&
        trace.pinIds.includes("schematic_port_288"),
    )!
  const connectedSclPins = inputProblem.chips.flatMap((chip) =>
    chip.pins.filter(
      (pin) =>
        sclConnection.pinIds.includes(pin.pinId) &&
        tracePathContainsPoint(sclTrace.tracePath, pin),
    ),
  )
  expect(connectedSclPins).toHaveLength(2)
  const sdaLabel = solver
    .inlineNetLabelSolver!.getOutput()
    .inlineNetLabelPlacements.find((label) =>
      label.pinIds.includes("schematic_port_276"),
    )!
  expect(sdaLabel.side).toBe("y+")
  expect(sdaLabel.center.y).toBeGreaterThan(sdaLabel.anchorPoint.y)
  const output = solver.netLabelToTraceSolver!.getOutput()
  const connectorIds =
    solver.inlineNetLabelSolver!.getOutput().netLabelConnectorTraceIds!
  const connectorTraces = output.traces.filter((trace) =>
    connectorIds.has(trace.mspPairId),
  )
  expect(connectorTraces).toHaveLength(4)
  for (const trace of connectorTraces) {
    const endpoint = trace.tracePath.at(-1)!
    expect(
      output.netLabelPlacements.some(
        (label) =>
          label.globalConnNetId === trace.globalConnNetId &&
          Math.abs(label.anchorPoint.x - endpoint.x) < EPS &&
          Math.abs(label.anchorPoint.y - endpoint.y) < EPS,
      ),
    ).toBe(true)
  }
  const circuitJson = convertSolverOutputToCircuitJson(solver)
  expect(
    circuitJson
      .filter((element) => element.type === "schematic_text")
      .map((element) => element.text),
  ).toContain("I2C_SDA")
  expect(
    circuitJson
      .filter((element) => element.type === "schematic_net_label")
      .map((element) => element.text),
  ).toContain("V3V3_IMU")
  await expect(solver).toMatchSolverSnapshot(import.meta.path)
})
