import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import { tracePathContainsPoint } from "lib/solvers/RailNetLabelCornerPlacementSolver/geometry"
import { findPerpendicularPathCrossings } from "lib/solvers/TraceCleanupSolver/sub-solver/findIntersectionsWithObstacles"
import "tests/fixtures/matcher"
import input from "./assets/repro-am3352-06-boot.input.json"

// Full sheet from am3352-dev-board-4layer-dogbone.json; routing uses core defaults.
test("repro complete AM3352 06-Boot sheet", async () => {
  const problem = structuredClone(input) as InputProblem
  const solver = new SchematicTracePipelineSolver(problem, {
    hideRatsNet: true,
  })
  solver.solve()
  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  const { traces, inlineNetLabelPlacements } =
    solver.netLabelToTraceSolver!.getOutput()
  for (const netId of ["BOOT_SEL1", "BOOT_SEL2", "BOOT_SEL3"]) {
    const trace = traces.find((trace) => trace.userNetId === netId)!
    expect(trace).toBeDefined()
    expect(trace.tracePath).toHaveLength(4)
    expect(trace.tracePath[1]!.y).toBe(trace.tracePath[0]!.y)
    expect(trace.tracePath[2]!.y).toBe(trace.tracePath[3]!.y)
    const label = inlineNetLabelPlacements.find(
      (label) => label.globalConnNetId === trace.globalConnNetId,
    )!
    expect(label).toBeDefined()
    expect(tracePathContainsPoint(trace.tracePath, label.anchorPoint)).toBe(
      true,
    )
    for (const otherTrace of traces) {
      if (otherTrace.globalConnNetId === trace.globalConnNetId) continue
      expect(
        findPerpendicularPathCrossings(trace.tracePath, otherTrace.tracePath, {
          includeTerminalSegments: true,
        }),
      ).toEqual([])
    }
  }
  await expect(solver).toMatchSolverSnapshot(import.meta.path)
})
