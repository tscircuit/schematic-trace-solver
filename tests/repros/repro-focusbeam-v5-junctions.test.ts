import { expect, test } from "bun:test"
import { getSvgFromGraphicsObject, type GraphicsObject } from "graphics-debug"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputChip, InputProblem, PinId } from "lib/types/InputProblem"
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
const getComponentNetSvg = ({
  chip,
  netId,
  focusPinIds,
  traces,
}: {
  chip: InputChip
  netId: string
  focusPinIds: Set<PinId>
  traces: SolvedTracePath[]
}) => {
  const focusPins = chip.pins.filter((pin) => focusPinIds.has(pin.pinId))
  const focusTraces = traces.filter((trace) =>
    trace.pins.some((pin) => focusPinIds.has(pin.pinId)),
  )
  const graphics: GraphicsObject = {
    rects: [
      {
        center: chip.center,
        width: chip.width,
        height: chip.height,
        fill: "#fff7ed",
      },
    ],
    lines: focusTraces.map((trace) => {
      let strokeColor = "#15803d"
      if (REPLACEMENT_PAIR_IDS.has(trace.mspPairId)) strokeColor = "#dc2626"
      return {
        points: trace.tracePath,
        strokeColor,
        strokeWidth: 0.025,
        label: trace.mspPairId,
      }
    }),
    circles: focusPins.map((pin) => ({
      center: pin,
      radius: 0.035,
      fill: "#111827",
    })),
    texts: [
      {
        x: chip.center.x,
        y: chip.center.y,
        text: chip.chipId.replace("schematic_component_", "Component "),
        fontSize: 0.14,
        color: "#7c2d12",
      },
      {
        x: chip.center.x,
        y: chip.center.y + chip.height / 2 + 0.22,
        text: `${netId}: red = replacement, green = hub branch`,
        fontSize: 0.12,
        color: "#111827",
      },
      ...focusPins.map((pin) => ({
        x: pin.x - 0.08,
        y: pin.y + 0.06,
        text: pin.pinId.replace("schematic_port_", "port "),
        fontSize: 0.1,
        color: "#111827",
      })),
    ],
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
  const component5Svg = getComponentNetSvg({
    chip: inputProblem.chips.find(
      (chip) => chip.chipId === "schematic_component_5",
    )!,
    netId: "V5",
    focusPinIds: new Set(["schematic_port_10", "schematic_port_12"]),
    traces: outputTraces,
  })
  const component9Svg = getComponentNetSvg({
    chip: inputProblem.chips.find(
      (chip) => chip.chipId === "schematic_component_9",
    )!,
    netId: "GND",
    focusPinIds: new Set(["schematic_port_21", "schematic_port_22"]),
    traces: outputTraces,
  })
  expect(component5Svg).toMatchSvgSnapshot(import.meta.path, "component-5-v5")
  expect(component9Svg).toMatchSvgSnapshot(import.meta.path, "component-9-gnd")
})
