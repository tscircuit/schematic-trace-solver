import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import capturedInput from "./assets/repro-esp32-c3-v1.0.1.input.json"
import "tests/fixtures/matcher"

// Exact solver input captured from mohan-bee/esp32-c3 v1.0.1, reduced to its
// MCU section so the orphaned branch is visible in the snapshot. R6 is
// schematic_component_14 and its V3V3 pin is schematic_port_120.
const chips = capturedInput.chips.filter((chip) => chip.sectionId === "MCU")
const pinIds = new Set(
  chips.flatMap((chip) => chip.pins.map((pin) => pin.pinId)),
)
const inputProblem = {
  ...capturedInput,
  chips,
  directConnections: [],
  netConnections: capturedInput.netConnections
    .map((connection) => ({
      ...connection,
      pinIds: connection.pinIds.filter((pinId) => pinIds.has(pinId)),
    }))
    .filter((connection) => connection.pinIds.length > 0),
  textBoxes: capturedInput.textBoxes.filter((textBox) =>
    chips.some((chip) => chip.chipId === textBox.chipId),
  ),
}

test("repro ESP32-C3 fallback label leaves an orphaned V3V3 trace", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  const output = solver.netLabelToTraceSolver!.getOutput()
  const r6Trace = output.traces.find(
    (trace) =>
      trace.pinIds.includes("schematic_port_120") &&
      trace.pinIds.includes("schematic_port_134"),
  )!
  const traceEnd = r6Trace.tracePath.at(-1)!
  const targetPin = inputProblem.chips
    .flatMap((chip) => chip.pins)
    .find((pin) => pin.pinId === "schematic_port_134")!
  const r6FallbackLabel = output.netLabelPlacements.find(
    (label) =>
      label.netId === "V3V3" && label.pinIds.includes("schematic_port_120"),
  )

  expect((r6Trace as typeof r6Trace & { error?: string }).error).toBe(
    "No collision-free path found",
  )
  expect(traceEnd).not.toMatchObject({ x: targetPin.x, y: targetPin.y })
  expect(r6FallbackLabel).toBeDefined()
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
