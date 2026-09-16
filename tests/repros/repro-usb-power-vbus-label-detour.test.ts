import { getOutputLabelCollisions } from "lib/solvers/InlineNetLabelSolver/getOutputLabelCollisions"
import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import { getTraceConnectedPinComponents } from "lib/solvers/SchematicTraceLinesSolver/getTraceConnectedPinComponents"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputProblemJson from "./assets/repro-usb-power-vbus-label-detour.input.json"

const VBUS_PIN_IDS = new Set(["schematic_port_224", "schematic_port_226"])

test("keeps the compact VBUS route and USB labels clear of neighboring wires", () => {
  const inputProblem: InputProblem = JSON.parse(
    JSON.stringify(inputProblemJson),
  )
  const solver = new SchematicTracePipelineSolver(inputProblem)

  solver.solve()

  const vbusTrace = solver
    .inlineNetLabelSolver!.getOutput()
    .traces.find(
      (trace) =>
        trace.pins.length === VBUS_PIN_IDS.size &&
        trace.pins.every((pin) => VBUS_PIN_IDS.has(pin.pinId)),
    )
  const inlineOutput = solver.inlineNetLabelSolver!.getOutput()
  const usbHighSpeedInlineLabels = inlineOutput.inlineNetLabelPlacements.filter(
    (placement) => placement.netId?.startsWith("USB_HS_"),
  )
  const usbHighSpeedAnchoredLabels = inlineOutput.netLabelPlacements.filter(
    (placement) => placement.netId?.startsWith("USB_HS_"),
  )

  // Distant supply branches may now have separate labels. Verify every rail
  // island remains named, while retaining the USB routing/collision checks.
  for (const pinId of [
    "schematic_port_37",
    "schematic_port_46",
    "schematic_port_54",
    "schematic_port_162",
  ]) {
    const net = inputProblem.netConnections.find((net) =>
      net.pinIds.includes(pinId),
    )!
    const component = getTraceConnectedPinComponents({
      pinIds: net.pinIds,
      traces: inlineOutput.traces,
    }).find((component) => component.pinIds.includes(pinId))!
    expect(
      inlineOutput.netLabelPlacements.some(
        (label) =>
          label.netId === net.netId &&
          label.pinIds.some((id) => component.pinIds.includes(id)),
      ),
    ).toBe(true)
  }
  expect(vbusTrace?.tracePath).toEqual([
    { x: 13, y: -6.2 },
    { x: 12.8, y: -6.2 },
    { x: 12.8, y: -5.8 },
    { x: 13, y: -5.8 },
  ])
  expect(usbHighSpeedAnchoredLabels).toEqual([])
  expect(usbHighSpeedInlineLabels).toHaveLength(4)
  expect(usbHighSpeedInlineLabels.every((label) => label.side === "y+")).toBe(
    true,
  )
  const dm = usbHighSpeedInlineLabels.find((label) =>
    label.pinIds.includes("schematic_port_191"),
  )!
  const vbusConnector = inlineOutput.traces.find((trace) =>
    trace.pinIds.includes("schematic_port_192"),
  )!
  expect(dm.center.y - dm.height / 2).toBeGreaterThan(dm.stubTracePath![0].y)
  expect(dm.center.y + dm.height / 2).toBeLessThan(
    vbusConnector.tracePath[0]!.y,
  )
  for (const pinId of ["schematic_port_188", "schematic_port_190"]) {
    expect(
      inputProblem.directConnections
        .filter((connection) => connection.pinIds.includes(pinId))
        .every((connection) => !connection.allowInlineNetLabel),
    ).toBe(true)
    expect(
      inlineOutput.netLabelPlacements.some((label) =>
        label.pinIds.includes(pinId),
      ),
    ).toBe(true)
  }
  expect(
    getOutputLabelCollisions(inlineOutput).filter((collision) => {
      const labels =
        collision.kind === "label-label" ? collision.labels : [collision.label]
      return labels.some((label) =>
        usbHighSpeedInlineLabels.some((usb) => usb === label),
      )
    }),
  ).toEqual([])
  for (const pinId of [
    "schematic_port_83",
    "schematic_port_84",
    "schematic_port_191",
    "schematic_port_193",
  ]) {
    expect(
      [...usbHighSpeedInlineLabels, ...usbHighSpeedAnchoredLabels].filter(
        (label) => label.pinIds.includes(pinId),
      ),
    ).toHaveLength(1)
  }
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
