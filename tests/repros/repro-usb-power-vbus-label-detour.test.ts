import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputProblemJson from "./assets/repro-usb-power-vbus-label-detour.input.json"

const VBUS_PIN_IDS = new Set(["schematic_port_224", "schematic_port_226"])

test("routes the usb power vbus connection without a label detour", () => {
  const inputProblem: InputProblem = JSON.parse(
    JSON.stringify(inputProblemJson),
  )
  const solver = new SchematicTracePipelineSolver(inputProblem)

  solver.solve()

  const vbusTrace = solver.sameNetJunctionAlignmentSolver!.outputTraces.find(
    (trace) =>
      trace.pins.length === VBUS_PIN_IDS.size &&
      trace.pins.every((pin) => VBUS_PIN_IDS.has(pin.pinId)),
  )
  const gndLabel =
    solver.availableNetOrientationSolver!.outputNetLabelPlacements.find(
      (label) => label.pinIds.includes("schematic_port_225"),
    )

  expect(gndLabel?.orientation).toBe("y-")
  expect(vbusTrace?.tracePath).toEqual([
    { x: 13, y: -6.2 },
    { x: 12.8, y: -6.2 },
    { x: 12.8, y: -5.8 },
    { x: 13, y: -5.8 },
  ])
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
