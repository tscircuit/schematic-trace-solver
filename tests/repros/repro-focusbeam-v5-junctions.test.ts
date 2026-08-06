import { expect, test } from "bun:test"
import { getSvgFromGraphicsObject, type GraphicsObject } from "graphics-debug"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"
import inputProblemJson from "./assets/repro-focusbeam-v5-junctions.input.json"
import "tests/fixtures/matcher"

const LOCAL_V5_PAIR_ID = "schematic_port_10-schematic_port_12"
const EXTERNAL_V5_PAIR_ID = "schematic_port_12-schematic_port_0"
const FOCUS_COMPONENT_IDS = new Set([
  "schematic_component_5",
  "schematic_component_9",
])

const getV5TraceColor = (trace: SolvedTracePath) => {
  if (trace.mspPairId === LOCAL_V5_PAIR_ID) return "#dc2626"
  return "#15803d"
}

const getFocusedV5Svg = ({
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
      .filter((trace) => trace.userNetId === "V5")
      .map((trace) => ({
        points: trace.tracePath,
        strokeColor: getV5TraceColor(trace),
        label: trace.mspPairId,
      })),
  }

  return getSvgFromGraphicsObject(graphics, { backgroundColor: "white" })
}

test("keeps the FocusBeam local V5 loop separate from external rails", () => {
  const inputProblem: InputProblem = JSON.parse(
    JSON.stringify(inputProblemJson),
  )
  const solver = new SchematicTracePipelineSolver(inputProblem)

  solver.solve()

  const outputTraces = solver.sameNetJunctionAlignmentSolver!.outputTraces
  const localV5Trace = outputTraces.find(
    (trace) => trace.mspPairId === LOCAL_V5_PAIR_ID,
  )!
  const externalV5Trace = outputTraces.find(
    (trace) => trace.mspPairId === EXTERNAL_V5_PAIR_ID,
  )!

  expect(localV5Trace.tracePath[1]!.x).toBeCloseTo(-1.2)
  expect(externalV5Trace.tracePath[1]!.x).not.toBeCloseTo(
    localV5Trace.tracePath[1]!.x,
  )
  const focusedV5Svg = getFocusedV5Svg({ inputProblem, traces: outputTraces })
  expect(focusedV5Svg).toMatchSvgSnapshot(import.meta.path)
})
