import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "./bug-report-20260901T055358Z.json"
import "tests/fixtures/matcher"

test("bug-report-20260901T055358Z", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  const groundLabelConnector = solver
    .netLabelToTraceSolver!.getOutput()
    .traces.find(
      (trace) => trace.mspPairId === "available-net-orientation-19-GND",
    )
  expect(groundLabelConnector).toBeDefined()
  expect(groundLabelConnector!.tracePath).toHaveLength(2)
  expect(groundLabelConnector!.tracePath.every((point) => point.y === 3)).toBe(
    true,
  )

  const v3v3LoopTraceId = "schematic_port_87-schematic_port_83"
  const v3v3LoopBeforePostInlineCleanup = solver
    .inlineNetLabelSolver!.getOutput()
    .traces.find((trace) => trace.mspPairId === v3v3LoopTraceId)
  const v3v3LoopAfterPostInlineCleanup = solver
    .netLabelToTraceSolver!.getOutput()
    .traces.find((trace) => trace.mspPairId === v3v3LoopTraceId)
  expect(v3v3LoopAfterPostInlineCleanup!.tracePath).toEqual(
    v3v3LoopBeforePostInlineCleanup!.tracePath,
  )

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
