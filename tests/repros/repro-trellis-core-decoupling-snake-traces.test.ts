import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputProblem from "./assets/repro-trellis-core-decoupling-snake-traces.input.json"

// Captured from Trellis Core Linux System-on-Module (cpu-core sheet).
// Decoupling capacitors C9-C15 on the P3V3 and GND rails are placed horizontally
// in a line (x = -12, -10, -8, -6, -4, -2, 0 at y = 8).
//
// Current buggy behavior:
// MspConnectionPairSolver forms an alternating top/bottom Minimum Spanning Tree
// across the capacitors, resulting in an unreadable serpentine / snake ladder:
//   - C9.1 <-> C10.1 (top trace)
//   - C10.2 <-> C11.2 (bottom trace)
//   - C11.1 <-> C12.1 (top trace)
//   - C12.2 <-> C13.2 (bottom trace)
//   - C14.1 <-> C15.1 (top trace)
//   - C14.2 <-> C15.2 (bottom trace)
// with isolated, inconsistent P3V3 and GND labels scattered across them.
//
// Expected behavior:
// Parallel decoupling capacitors on the same power/ground rails should either:
//   1. Each have clean, local power (P3V3) and ground (GND) labels/symbols, OR
//   2. Form symmetric, continuous horizontal bus rails on both top and bottom
//      instead of an alternating snake/zigzag.
test("repro: Trellis Core C9-C15 decoupling capacitors snake traces", async () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as InputProblem)

  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)

  const { traces, netLabelPlacements } =
    solver.netLabelToTraceSolver!.getOutput()

  const hasTrace = (pinA: string, pinB: string) =>
    traces.some((t) => t.pinIds.includes(pinA) && t.pinIds.includes(pinB))

  // Pin the current snake / zigzag trace routing:
  expect(hasTrace("C9.1", "C10.1")).toBe(true)
  expect(hasTrace("C10.2", "C11.2")).toBe(true)
  expect(hasTrace("C11.1", "C12.1")).toBe(true)
  expect(hasTrace("C12.2", "C13.2")).toBe(true)
  expect(hasTrace("C14.1", "C15.1")).toBe(true)
  expect(hasTrace("C14.2", "C15.2")).toBe(true)

  // Pin the inconsistent label placement:
  const p3v3Labels = netLabelPlacements.filter((l) => l.netId === "P3V3")
  const gndLabels = netLabelPlacements.filter((l) => l.netId === "GND")
  expect(p3v3Labels.length).toBeGreaterThan(0)
  expect(gndLabels.length).toBeGreaterThan(0)

  await expect(solver).toMatchSolverSnapshot(import.meta.path)
})
