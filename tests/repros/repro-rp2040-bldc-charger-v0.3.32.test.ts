import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputJson from "./assets/repro-rp2040-bldc-charger-v0.3.32.input.json"

// MustafaMulla29/rp2040-bldc-motor-controller-new v0.3.32, charger sheet.
// Raw core 0.0.2021 input captured via debug:logOutput before solver normalization.
// Refdes, symbol names and net-label text come from the published Circuit JSON;
// all bounds, pins, nets and routing options are preserved. These annotations
// leave all 72 routed trace paths unchanged on solver 0.0.228.
test("repro BLDC charger v0.3.32 battery-bus and thermistor branches", async () => {
  const input = structuredClone(inputJson) as unknown as InputProblem
  const original = structuredClone(input)
  const solver = new SchematicTracePipelineSolver(input, { hideRatsNet: true })
  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  expect(input).toEqual(original)
  // Preserve the real IC body instead of importing the older solver's
  // expanded obstacle, which includes the external pin stems.
  const charger = solver.inputProblem.chips.find(
    (chip) => chip.chipId === "U8",
  )!
  expect(charger.width).toBeCloseTo(2.43)
  expect(charger.height).toBeCloseTo(9.5)

  const { traces } = solver.netLabelToTraceSolver!.getOutput()
  // The screenshot's long VMOTOR branch still runs from R30 up to the
  // C37/D4 battery-bus rail in the current solver. This records the repro's
  // current behavior; it is not an assertion of a routing fix.
  const r30Branch = traces.find((trace) =>
    trace.pinIds.includes("schematic_port_226"),
  )!
  expect(r30Branch).toBeDefined()
  expect(r30Branch.tracePath[0]).toEqual({ x: 14, y: -6.2 })
  expect(
    Math.max(...r30Branch.tracePath.map((point) => point.y)),
  ).toBeGreaterThan(0.5)

  // U8.TS still drops below R24 before joining the R24/R25/J8 network.
  const thermistorBranch = traces.find(
    (trace) =>
      trace.pinIds.includes("schematic_port_139") &&
      trace.pinIds.includes("schematic_port_215"),
  )!
  expect(thermistorBranch).toBeDefined()
  expect(
    Math.min(...thermistorBranch.tracePath.map((point) => point.y)),
  ).toBeLessThan(-2.8)
  await expect(solver).toMatchSolverSnapshot(import.meta.path)
})
