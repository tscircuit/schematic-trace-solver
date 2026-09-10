import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import { pathIntersectsRenderedLabel } from "lib/utils/pathIntersectsRenderedLabel"
import "tests/fixtures/matcher"
import inputProblem from "./assets/repro173-boost-drv8711-ground-label-overlap.input.json"

// Power stage solver input captured via solver:started from core's
// tests/repros/repro173-boost-drv8711-cross-sheet-netlabel-overlap.test.tsx
// at 2ad5cd0a, after https://github.com/tscircuit/core/pull/3794.
// Only symbolName and netLabelText were added for readable snapshots; routing
// geometry, pin order, and all eight cross-sheet U1 gate-drive labels are intact.
// The controller sheet is solved independently, so its input is not needed.
test("repro173 BOOST-DRV8711 ground trace clears the R1 GND label", async () => {
  const solver = new SchematicTracePipelineSolver(
    inputProblem as unknown as InputProblem,
    { hideRatsNet: true },
  )
  solver.solve()

  expect(solver.solved).toBe(true)

  const { traces, netLabelPlacements } =
    solver.netLabelToTraceSolver!.getOutput()
  const r1GroundLabel = netLabelPlacements.find(
    (label) =>
      label.netId === "GND" && label.pinIds.includes("schematic_port_83"),
  )!
  const c1ToR2GroundTrace = traces.find(
    (trace) =>
      trace.pinIds.includes("schematic_port_78") &&
      trace.pinIds.includes("schematic_port_85"),
  )!

  // A detour around VM must also keep the C1-to-R2 ground rail clear of
  // the GND label below R1, even though both belong to the same net.
  expect(
    pathIntersectsRenderedLabel(c1ToR2GroundTrace.tracePath, r1GroundLabel),
  ).toBe(false)
  expect(
    netLabelPlacements
      .filter((label) => label.netId === "VM")
      .some((label) =>
        pathIntersectsRenderedLabel(c1ToR2GroundTrace.tracePath, label),
      ),
  ).toBe(false)
  await expect(solver).toMatchSolverSnapshot(import.meta.path)
})
