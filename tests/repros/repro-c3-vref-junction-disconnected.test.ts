import { expect, test } from "bun:test"
import { tracePathContainsPoint } from "lib/solvers/RailNetLabelCornerPlacementSolver/geometry"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputProblem from "./assets/repro-c3-vref-junction-disconnected.input.json"

test("cleanup extends C3 branch endpoint to stay connected when VREF rail shifts", async () => {
  const original = structuredClone(inputProblem)
  const solverInput: InputProblem = JSON.parse(JSON.stringify(inputProblem))
  const solver = new SchematicTracePipelineSolver(solverInput, {
    hideRatsNet: true,
  })
  solver.solve()
  expect(solver.solved).toBe(true)
  expect(inputProblem).toEqual(original)

  const before = solver.traceElbowTransitionSimplificationSolver?.getOutput()
  const after = solver.inlineNetLabelSolver?.getOutput()
  expect(before).toBeDefined()
  expect(after).toBeDefined()
  if (!before || !after) throw new Error("Expected pipeline stage outputs")

  const railId = "schematic_port_5-schematic_port_6"
  const branchId = "schematic_port_8-schematic_port_6"
  const originalRail = before.traces.find((trace) => trace.mspPairId === railId)
  const originalBranch = before.traces.find(
    (trace) => trace.mspPairId === branchId,
  )
  const rail = after.traces.find((trace) => trace.mspPairId === railId)
  const branch = after.traces.find((trace) => trace.mspPairId === branchId)
  if (!originalRail || !originalBranch || !rail || !branch) {
    throw new Error("Expected VREF rail and C3 branch traces")
  }

  const originalBranchEnd = originalBranch.tracePath.at(-1)
  const updatedBranchEnd = branch.tracePath.at(-1)
  const shiftedRailPoint = rail.tracePath[1]
  if (!originalBranchEnd || !updatedBranchEnd || !shiftedRailPoint) {
    throw new Error("Expected trace endpoints")
  }

  expect(
    tracePathContainsPoint(originalRail.tracePath, originalBranchEnd),
  ).toBe(true)
  expect(branch.globalConnNetId).toBe(rail.globalConnNetId)
  expect(shiftedRailPoint.y - originalBranchEnd.y).toBeCloseTo(0.02, 8)
  expect(updatedBranchEnd.x).toBeCloseTo(originalBranchEnd.x, 8)
  expect(updatedBranchEnd.y).toBeCloseTo(shiftedRailPoint.y, 8)
  expect(tracePathContainsPoint(rail.tracePath, updatedBranchEnd)).toBe(true)

  await expect(solver).toMatchSolverSnapshot(import.meta.path)
})
