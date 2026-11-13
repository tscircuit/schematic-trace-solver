import { expect, test } from "bun:test"
import { tracePathContainsPoint } from "lib/solvers/RailNetLabelCornerPlacementSolver/geometry"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import { pathIntersectsRenderedLabel } from "lib/utils/pathIntersectsRenderedLabel"
import "tests/fixtures/matcher"
import inputProblem from "./assets/repro-core-vertical-passive-ground-label-overlap.input.json"

// Captured via solver:started from @tscircuit/core repro187. Symbol names and
// display text were added for a readable snapshot; routing geometry is intact.
test("VREF trace clears a vertical passive GND label", async () => {
  const solver = new SchematicTracePipelineSolver(
    inputProblem as unknown as InputProblem,
    { hideRatsNet: true },
  )

  solver.solve()

  expect(solver.solved).toBe(true)
  const { traces, netLabelPlacements } =
    solver.netLabelToTraceSolver!.getOutput()
  const groundLabel = netLabelPlacements.find(
    (label) =>
      label.netId === "GND" && label.pinIds.includes("schematic_port_7"),
  )!
  const vrefTrace = traces.find(
    (trace) =>
      trace.pinIds.includes("schematic_port_6") &&
      trace.pinIds.includes("schematic_port_8"),
  )!
  const vrefRailTrace = traces.find(
    (trace) =>
      trace.pinIds.includes("schematic_port_5") &&
      trace.pinIds.includes("schematic_port_6"),
  )!

  expect(groundLabel).toBeDefined()
  expect(vrefTrace).toBeDefined()
  expect(vrefRailTrace).toBeDefined()
  expect(vrefTrace.globalConnNetId).not.toBe(groundLabel.globalConnNetId)
  // The VREF route must approach the resistor without crossing its GND terminal.
  expect(pathIntersectsRenderedLabel(vrefTrace.tracePath, groundLabel)).toBe(
    false,
  )
  // The C3 VREF branch must remain connected to the R1/R2 VREF rail after cleanup.
  expect(
    tracePathContainsPoint(
      vrefRailTrace.tracePath,
      vrefTrace.tracePath.at(-1)!,
    ),
  ).toBe(true)
  const alignedVrefBranch =
    solver.sameNetJunctionAlignmentSolver!.outputTraces.find(
      (trace) => trace.mspPairId === "schematic_port_22-schematic_port_0",
    )!
  expect(alignedVrefBranch.tracePath.at(-2)!.y).toBeCloseTo(
    alignedVrefBranch.tracePath.at(-1)!.y,
  )
  await expect(solver).toMatchSolverSnapshot(import.meta.path)
})
