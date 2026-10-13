import { beforeAll, expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import { pathIntersectsRenderedLabel } from "lib/utils/pathIntersectsRenderedLabel"
import { convertSolverOutputToCircuitJson } from "tests/fixtures/convertSolverOutputToCircuitJson"
import { getSolverSnapshotSvg } from "tests/fixtures/matcher"
import inputProblem from "./assets/repro-nema34-vbus-lv-custom-symbol.input.json"
import customSymbol from "./assets/repro-nema34-vbus-lv-custom-symbol.circuit.json"

// Routing bounds match core's solver:started capture after tscircuit/core#4580:
// the obstacle includes Q1's body and external terminals. Terminal positions
// and custom drawing primitives are unchanged. Optional stems come from the
// emitted Circuit JSON (core does not export them yet); they remain metadata.
const solver = new SchematicTracePipelineSolver(inputProblem as InputProblem)
const getVbusLabel = (pipeline = solver) =>
  pipeline
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

test("NEMA34 input preserves Q1's emitted stems and supplied routing bounds", () => {
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

  // The solver preserves both the caller's pin-inclusive obstacle and the
  // optional stem metadata, without recalculating the supplied bounds.
  const [solverInput] = solver.getConstructorParams()
  expect(solverInput.chips).toEqual((inputProblem as InputProblem).chips)
})

// Core's pin-inclusive obstacle keeps the upward rail clear of the source stem.
test("NEMA34 VBUS_LV rail label clears the custom MOSFET source stem", () => {
  expect(
    pathIntersectsRenderedLabel(
      [sourcePin.stem.from, sourcePin.stem.to],
      getVbusLabel(),
    ),
  ).toBe(false)
})

test("NEMA34 pin-inclusive bounds clear VBUS_LV without stem metadata", () => {
  const inputWithoutStems = structuredClone(inputProblem) as InputProblem
  for (const chip of inputWithoutStems.chips) {
    for (const pin of chip.pins) delete pin.stem
  }

  const solverWithoutStems = new SchematicTracePipelineSolver(inputWithoutStems)
  solverWithoutStems.solve()
  expect(solverWithoutStems.solved).toBe(true)
  const label = getVbusLabel(solverWithoutStems)
  expect(label.orientation).toBe("y+")
  expect(
    pathIntersectsRenderedLabel(
      [sourcePin.stem.from, sourcePin.stem.to],
      label,
    ),
  ).toBe(false)
})
