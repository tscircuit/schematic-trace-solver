import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import { pathIntersectsRenderedLabel } from "lib/utils/pathIntersectsRenderedLabel"
import "tests/fixtures/matcher"
import inputProblem from "./assets/repro-tmc5160-ground-bus-full-chip.input.json"

// Full 49-pin core capture: the upper GNDA/CLK rail and lower GNDD1/ENC
// rail are separate branches of GND. A label must not jump across the gap
// between them merely because alignment gives both rails the same x.
test("TMC5160 separate ground branches keep every GND symbol clear", async () => {
  const solver = new SchematicTracePipelineSolver(
    inputProblem as unknown as InputProblem,
    { hideRatsNet: true },
  )
  solver.solve()
  expect(solver.solved).toBe(true)
  const { traces, netLabelPlacements } =
    solver.netLabelToTraceSolver!.getOutput()
  const groundLabels = netLabelPlacements.filter(
    (label) => label.netId === "GND",
  )
  expect(groundLabels).toHaveLength(4)
  for (const label of groundLabels) {
    // Permit attachment-boundary contact, but not wires through the body.
    expect(
      traces.filter(
        (trace) =>
          trace.globalConnNetId === label.globalConnNetId &&
          pathIntersectsRenderedLabel(trace.tracePath, {
            ...label,
            width: label.width - 0.002,
            height: label.height - 0.002,
          }),
      ),
    ).toEqual([])
  }
  await expect(solver).toMatchSolverSnapshot(import.meta.path)
})
