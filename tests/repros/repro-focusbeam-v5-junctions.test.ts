import { expect, test } from "bun:test"
import { getSvgFromGraphicsObject, type GraphicsObject } from "graphics-debug"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"
import inputProblemJson from "./assets/repro-focusbeam-v5-junctions.input.json"
import "tests/fixtures/matcher"

const LOCAL_PAIR_IDS = new Set([
  "schematic_port_10-schematic_port_12",
  "schematic_port_21-schematic_port_22",
])
const REPLACEMENT_PAIR_IDS = new Set([
  "schematic_port_10-schematic_port_0",
  "schematic_port_21-schematic_port_4",
])
const FOCUS_COMPONENT_IDS = new Set([
  "schematic_component_5",
  "schematic_component_9",
])

const getFocusedTraceColor = (trace: SolvedTracePath) => {
  if (REPLACEMENT_PAIR_IDS.has(trace.mspPairId)) return "#dc2626"
  return "#15803d"
}

const getFocusedSvg = ({
  inputProblem,
  traces,
}: {
  inputProblem: InputProblem
  traces: SolvedTracePath[]
}) => {
  const graphics: GraphicsObject = {
    rects: inputProblem.chips
      .filter((chip) => FOCUS_COMPONENT_IDS.has(chip.chipId))
      .map((chip) => ({
        center: chip.center,
        width: chip.width,
        height: chip.height,
        fill: "#fff7ed",
        strokeColor: "#9a3412",
        label: chip.chipId,
      })),
    lines: traces
      .filter((trace) =>
        trace.pins.some((pin) => FOCUS_COMPONENT_IDS.has(pin.chipId)),
      )
      .map((trace) => ({
        points: trace.tracePath,
        strokeColor: getFocusedTraceColor(trace),
        label: trace.mspPairId,
      })),
  }

  return getSvgFromGraphicsObject(graphics, { backgroundColor: "white" })
}

test("replaces FocusBeam local leaf-to-junction loops", () => {
  const inputProblem: InputProblem = JSON.parse(
    JSON.stringify(inputProblemJson),
  )
  const solver = new SchematicTracePipelineSolver(inputProblem)

  solver.solve()

  const outputTraces = solver.sameNetJunctionAlignmentSolver!.outputTraces
  const localTraces = outputTraces.filter((trace) =>
    LOCAL_PAIR_IDS.has(trace.mspPairId),
  )
  const replacementTraces = outputTraces.filter((trace) =>
    REPLACEMENT_PAIR_IDS.has(trace.mspPairId),
  )

  expect(localTraces).toHaveLength(0)
  expect(replacementTraces).toHaveLength(2)
  const focusedSvg = getFocusedSvg({ inputProblem, traces: outputTraces })
  expect(focusedSvg).toMatchSvgSnapshot(import.meta.path)
})
