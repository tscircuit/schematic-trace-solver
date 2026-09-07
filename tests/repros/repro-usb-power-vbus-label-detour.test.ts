import { findLabelCollisions } from "tests/fixtures/findLabelCollisions"
import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
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
  const gndLabel =
    solver.availableNetOrientationSolver!.outputNetLabelPlacements.find(
      (label) =>
        label.pinIds.includes("schematic_port_37") &&
        label.pinIds.includes("schematic_port_46"),
    )
  const gndLabelConnector = solver.availableNetOrientationSolver!.traces.find(
    (trace) =>
      trace.mspPairId.startsWith("available-net-orientation-") &&
      trace.pinIds.includes("schematic_port_37") &&
      trace.pinIds.includes("schematic_port_46"),
  )
  const neighboringV3v3Label =
    solver.availableNetOrientationSolver!.outputNetLabelPlacements.find(
      (label) =>
        label.pinIds.includes("schematic_port_54") &&
        label.pinIds.includes("schematic_port_162"),
    )
  const inlineOutput = solver.inlineNetLabelSolver!.getOutput()
  const usbHighSpeedInlineLabels = inlineOutput.inlineNetLabelPlacements.filter(
    (placement) => placement.netId?.startsWith("USB_HS_"),
  )
  const usbHighSpeedAnchoredLabels = inlineOutput.netLabelPlacements.filter(
    (placement) => placement.netId?.startsWith("USB_HS_"),
  )

  expect(gndLabel?.orientation).toBe("y-")
  expect(gndLabel?.anchorPoint.x).toBeCloseTo(-2.34)
  expect(gndLabel?.anchorPoint.y).toBeCloseTo(1.3)
  expect(gndLabelConnector?.tracePath).toEqual([
    { x: -1.75, y: 1.2999999999999976 },
    { x: -2.34, y: 1.2999999999999976 },
  ])
  expect(neighboringV3v3Label?.anchorPoint.x).toBeCloseTo(-3.655)
  expect(neighboringV3v3Label?.anchorPoint.y).toBeCloseTo(-0.3)
  expect(vbusTrace?.tracePath).toEqual([
    { x: 13, y: -6.2 },
    { x: 12.8, y: -6.2 },
    { x: 12.8, y: -5.8 },
    { x: 13, y: -5.8 },
  ])
  expect(
    usbHighSpeedInlineLabels.some(
      (label) =>
        label.pinIds.includes("schematic_port_191") && label.side === "y-",
    ),
  ).toBe(true)
  const collisions = findLabelCollisions(inlineOutput)
  expect(
    collisions.traceLabels.filter(({ label }) =>
      label.netId?.startsWith("USB_HS_"),
    ),
  ).toEqual([])
  expect(
    collisions.labelPairs.filter((pair) =>
      pair.some((label) => label.netId?.startsWith("USB_HS_")),
    ),
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
