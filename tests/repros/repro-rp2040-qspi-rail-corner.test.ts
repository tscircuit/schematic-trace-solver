import { expect, test } from "bun:test"
import { getTraceCorners } from "lib/solvers/RailNetLabelCornerPlacementSolver/geometry"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "./assets/repro-rp2040-qspi-rail-corner.input.json"
import "tests/fixtures/matcher"

// Complete solver:started input from @tscircuit/core 0.0.1958 rendering
// tests/components/primitive-components/schematic-section-rp2040.test.tsx.
// Preserve every section and the original routing settings. The QSPI V3V3
// label must follow its trace's right-hand corner after routing moves it.
test("reproduces the QSPI rail label placement in core's full RP2040 schematic", async () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)
  solver.solve()

  const output = solver.inlineNetLabelSolver!.getOutput()
  const label = output.netLabelPlacements.find(
    (label) =>
      label.netId === "V3V3" && label.pinIds.includes("schematic_port_138"),
  )!
  const trace = output.traces.find((trace) =>
    label.mspConnectionPairIds.includes(trace.mspPairId),
  )!
  const rightCorner = getTraceCorners(trace.tracePath).reduce(
    (right, corner) =>
      corner.x > right.x || (corner.x === right.x && corner.y > right.y)
        ? corner
        : right,
  )

  expect(label.orientation).toBe("y+")
  expect(label.anchorPoint).toEqual(rightCorner)
  await expect(solver).toMatchSolverSnapshot(import.meta.path)
})
