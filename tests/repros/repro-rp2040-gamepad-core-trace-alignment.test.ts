import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputProblem from "./assets/repro-rp2040-gamepad-core-trace-alignment.input.json"

// Captured from core d8d83c891b6f9ee40e6634ec0dbcbe5487fea88a (0.0.1959),
// tests/repros/repro-rp2040-gamepad-trace-alignment.test.tsx, via solver:started.
test("keeps the core gamepad ground rails aligned after simplifying detours", async () => {
  const solver = new SchematicTracePipelineSolver(
    inputProblem as unknown as InputProblem,
    {
      hideRatsNet: true,
    },
  )
  solver.solve()

  // Core consumes the inline stage, after both rail alignment and the final
  // elbow simplification. Each side must remain one continuous vertical rail.
  const traces = solver.inlineNetLabelSolver!.getOutput().traces
  const groundTraces = traces.filter((trace) => trace.userNetId === "GND")
  const leftRailXs = new Set<number>()
  const rightRailXs = new Set<number>()
  const pico = inputProblem.chips.find(
    (chip) => chip.chipId === "schematic_component_3",
  )!
  const leftPinX = Math.min(...pico.pins.map((pin) => pin.x))
  const rightPinX = Math.max(...pico.pins.map((pin) => pin.x))

  for (const trace of groundTraces) {
    for (let i = 0; i < trace.tracePath.length - 1; i++) {
      const start = trace.tracePath[i]!
      const end = trace.tracePath[i + 1]!
      if (Math.abs(start.x - end.x) > 1e-6) continue
      if (start.x < leftPinX - 1e-6) leftRailXs.add(start.x)
      if (start.x > rightPinX + 1e-6) rightRailXs.add(start.x)
    }
  }

  expect(leftRailXs.size).toBe(1)
  expect(rightRailXs.size).toBe(1)
  await expect(solver).toMatchSolverSnapshot(import.meta.path)
})
