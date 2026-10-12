import { beforeAll, expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import { pathIntersectsRenderedLabel } from "lib/utils/pathIntersectsRenderedLabel"
import { convertSolverOutputToCircuitJson } from "tests/fixtures/convertSolverOutputToCircuitJson"
import { getSolverSnapshotSvg } from "tests/fixtures/matcher"
import inputProblem from "./assets/repro-nema34-vbus-lv-custom-symbol.input.json"
import customSymbol from "./assets/repro-nema34-vbus-lv-custom-symbol.circuit.json"

// Based on core's solver:started capture for the matching Q1 repro.
// Chip bounds and terminal positions are unchanged; netLabelText was added for
// readability. The optional pin stems were copied from the accompanying emitted
// Circuit JSON (core's adapter does not export them yet). They are input metadata
// until collision handling is implemented; custom drawing primitives remain
// rendering/test context, not additional routing obstacles.
const solver = new SchematicTracePipelineSolver(inputProblem as InputProblem)
const getVbusLabel = () =>
  solver
    .netLabelToTraceSolver!.getOutput()
    .netLabelPlacements.find((label) => label.netId === "VBUS_LV")!
const sourcePin = inputProblem.chips[0]!.pins.find(
  (pin) => pin.displayName === "S",
)!
const sourceStem = customSymbol.find(
  (element) =>
    element.type === "schematic_line" &&
    element.x1 === sourcePin.x &&
    element.y1 === sourcePin.y,
)!

beforeAll(async () => {
  solver.solve()
  expect(solver.solved).toBe(true)
  expect(getVbusLabel().orientation).toBe("y+")
  expect(sourceStem.y2! - sourceStem.y1!).toBeCloseTo(0.635)

  // Replace the generic snapshot box with the actual custom symbol. All wire
  // paths and label anchors still come from this solver run. Core renders the
  // two power nets as rail_up; preserve that style in the semantic snapshot.
  const circuitJson = convertSolverOutputToCircuitJson(solver)
    .filter(
      (element) =>
        ![
          "source_component",
          "source_port",
          "schematic_component",
          "schematic_port",
          "schematic_box",
        ].includes(element.type) &&
        !(
          element.type === "schematic_text" &&
          (element.schematic_component_id ||
            element.schematic_text_id.startsWith("schematic_text_box_"))
        ),
    )
    .map((element) =>
      element.type === "schematic_net_label" &&
      ["VBUS_LV", "PD_VBUS"].includes(element.text)
        ? { ...element, symbol_name: "rail_up" }
        : element,
    )
  // This repo's renderer omits component-owned custom text; render the saved
  // Q1 reference as free text at its unchanged world position.
  circuitJson.push(
    ...(customSymbol as AnyCircuitElement[]).map((element) =>
      element.type === "schematic_text"
        ? { ...element, schematic_component_id: undefined }
        : element,
    ),
  )
  await expect(
    getSolverSnapshotSvg({ solver, circuitJson }),
  ).toMatchSvgSnapshot(import.meta.path)
})

test("NEMA34 input preserves Q1's emitted stems and body bounds", () => {
  for (const pin of inputProblem.chips[0]!.pins) {
    const drawnStem = customSymbol.find(
      (element) =>
        element.type === "schematic_line" &&
        element.x1 === pin.x &&
        element.y1 === pin.y,
    )!
    expect(pin.stem).toEqual({
      from: { x: drawnStem.x1!, y: drawnStem.y1! },
      to: { x: drawnStem.x2!, y: drawnStem.y2! },
    })
  }

  // Check after the full solve: metadata reaches the solver without expanding
  // the authoritative body box to encompass the external stems.
  const [solverInput] = solver.getConstructorParams()
  expect(solverInput.chips).toEqual((inputProblem as InputProblem).chips)
})

// Expected behavior is upward orientation plus clearance from the source stem.
// Body-only chip bounds leave a 0.635 mm stem gap; the 0.42 mm label fits inside
// that gap and is incorrectly considered collision-free, even with explicit
// stem metadata supplied. Consuming that metadata is the follow-up fix.
test.failing("NEMA34 VBUS_LV rail label clears the custom MOSFET source stem", () => {
  expect(
    pathIntersectsRenderedLabel(
      [sourcePin.stem.from, sourcePin.stem.to],
      getVbusLabel(),
    ),
  ).toBe(false)
})
