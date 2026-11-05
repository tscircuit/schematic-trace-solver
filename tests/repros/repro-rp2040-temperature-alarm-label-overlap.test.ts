import { expect, test } from "bun:test"
import { getAnchoredNetLabelRenderedBounds } from "lib/solvers/InlineNetLabelSolver/getAnchoredNetLabelRenderedBounds"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputJson from "./assets/repro-rp2040-temperature-alarm-label-overlap.input.json"

// imrishabh18/rp2040-motor-controller v1.0.42, position_alarm / Temperature Alarm.
// Byte-for-byte copy of the real five-component core capture introduced in #1282:
// repro-rp2040-temperature-alarm.input.json. No geometry or connections are changed.
// That repro covers a missing buzzer wire; this one pins a separate final-output
// collision between the BUZZER_SINK and V3V3 labels beside BZ1.
test("repro Temperature Alarm leaves BUZZER_SINK overlapping V3V3 beside BZ1", async () => {
  const input = structuredClone(inputJson) as unknown as InputProblem
  const original = structuredClone(input)
  const solver = new SchematicTracePipelineSolver(input, { hideRatsNet: true })
  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  expect(input).toEqual(original)

  const output = solver.netLabelToTraceSolver!.getOutput()
  const buzzerPositive = "schematic_port_293"
  const buzzerNegative = "schematic_port_294"
  const transistorDrain = "schematic_port_299"
  const supplyLabel = output.netLabelPlacements.find(
    (label) =>
      label.netLabelText === "V3V3" && label.pinIds.includes(buzzerPositive),
  )
  const sinkLabel = output.netLabelPlacements.find(
    (label) =>
      label.netLabelText === "BUZZER_SINK" &&
      label.pinIds.includes(buzzerNegative) &&
      label.pinIds.includes(transistorDrain),
  )
  expect(supplyLabel).toBeDefined()
  expect(sinkLabel).toBeDefined()
  expect(supplyLabel!.globalConnNetId).not.toBe(sinkLabel!.globalConnNetId)
  expect(
    output.traces.some(
      (trace) =>
        trace.pinIds.includes(buzzerNegative) &&
        trace.pinIds.includes(transistorDrain),
    ),
  ).toBe(true)

  const supplyBounds = getAnchoredNetLabelRenderedBounds(supplyLabel!)
  const sinkBounds = getAnchoredNetLabelRenderedBounds(sinkLabel!)
  const overlapWidth = Math.max(
    0,
    Math.min(supplyBounds.maxX, sinkBounds.maxX) -
      Math.max(supplyBounds.minX, sinkBounds.minX),
  )
  const overlapHeight = Math.max(
    0,
    Math.min(supplyBounds.maxY, sinkBounds.maxY) -
      Math.max(supplyBounds.minY, sinkBounds.minY),
  )

  // Pin the current bug in final solver geometry, independently of the SVG.
  // A fix should change this assertion to .toBe(0) and update the snapshot.
  expect(overlapWidth * overlapHeight).toBeGreaterThan(0)
  await expect(solver).toMatchSolverSnapshot(import.meta.path)
})
