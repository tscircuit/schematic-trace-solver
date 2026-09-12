import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "./bug-report-20260911T195723Z.json"
import "tests/fixtures/matcher"

test("bug-report-20260911T195723Z", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  const v3v3Label = solver.netLabelToTraceSolver!.outputNetLabelPlacements.find(
    (label) =>
      label.netId === "V3V3" && label.pinIds.includes("schematic_port_141"),
  )
  const v3v3Connector = solver.netLabelToTraceSolver!.outputTraces.find(
    (trace) => trace.mspPairId === "available-net-orientation-43-V3V3",
  )

  expect(v3v3Label?.orientation).toBe("y+")
  expect(v3v3Connector).toBeUndefined()
  const v3v3HostTrace = solver.netLabelToTraceSolver!.outputTraces.find(
    (trace) => trace.pinIds.includes("schematic_port_141"),
  )
  expect(v3v3HostTrace?.tracePath).toContainEqual({ x: -6.5, y: -19 })
  expect(v3v3HostTrace?.tracePath).toContainEqual(v3v3Label!.anchorPoint)
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
