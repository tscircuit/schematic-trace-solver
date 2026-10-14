import { expect, test } from "bun:test"
import { tracePathContainsPoint } from "lib/solvers/RailNetLabelCornerPlacementSolver/geometry"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputProblem from "./assets/repro-c3-vref-junction-disconnected.input.json"

// Unchanged eight-component input captured from Core repro187, already in #1188.
// Cleanup moves the R1/R2 VREF rail but leaves C3's branch endpoint behind.
test("repro cleanup disconnects C3 from the VREF rail", async () => {
  const original = structuredClone(inputProblem)
  const solver = new SchematicTracePipelineSolver(
    inputProblem as unknown as InputProblem,
    { hideRatsNet: true },
  )
  solver.solve()
  expect(solver.solved).toBe(true)
  expect(inputProblem).toEqual(original)

  const before = solver.traceElbowTransitionSimplificationSolver!.getOutput()
  // Core renders this stage's output, so the gap also survives to the schematic.
  const after = solver.inlineNetLabelSolver!.getOutput()
  const railId = "schematic_port_5-schematic_port_6"
  const branchId = "schematic_port_8-schematic_port_6"
  const originalRail = before.traces.find(
    (trace) => trace.mspPairId === railId,
  )!
  const originalBranch = before.traces.find(
    (trace) => trace.mspPairId === branchId,
  )!
  const rail = after.traces.find((trace) => trace.mspPairId === railId)!
  const branch = after.traces.find((trace) => trace.mspPairId === branchId)!

  expect(
    tracePathContainsPoint(
      originalRail.tracePath,
      originalBranch.tracePath.at(-1)!,
    ),
  ).toBe(true)
  expect(branch.globalConnNetId).toBe(rail.globalConnNetId)
  expect(branch.tracePath).toEqual(originalBranch.tracePath)
  expect(tracePathContainsPoint(rail.tracePath, branch.tracePath.at(-1)!)).toBe(
    false,
  )
  expect(rail.tracePath[1]!.y - branch.tracePath.at(-1)!.y).toBeCloseTo(0.02, 8)

  // No fallback label represents C3's connection after the junction is lost.
  const vrefLabels = [
    ...after.netLabelPlacements,
    ...after.inlineNetLabelPlacements,
  ].filter((label) => label.globalConnNetId === branch.globalConnNetId)
  expect(vrefLabels).toHaveLength(1)
  expect(
    vrefLabels.some((label) =>
      tracePathContainsPoint(branch.tracePath, label.anchorPoint),
    ),
  ).toBe(false)

  await expect(solver).toMatchSolverSnapshot(import.meta.path)
})
