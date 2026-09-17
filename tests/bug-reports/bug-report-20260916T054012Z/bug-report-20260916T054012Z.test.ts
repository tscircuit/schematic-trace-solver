import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "./bug-report-20260916T054012Z.json"
import "tests/fixtures/matcher"
import { getRectBounds } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import { traceCrossesBoundsInterior } from "lib/solvers/AvailableNetOrientationSolver/geometry"

test("bug-report-20260916T054012Z", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  const { outputNetLabelPlacements: labels, outputTraces: traces } =
    solver.netLabelToTraceSolver!
  const ground = labels.find((label) =>
    label.pinIds.includes("schematic_port_115"),
  )!
  expect(ground.pinIds).toContain("schematic_port_117")
  expect(ground.orientation).toBe("y-")
  expect(
    traceCrossesBoundsInterior(
      getRectBounds(ground.center, ground.width, ground.height),
      Object.fromEntries(traces.map((trace) => [trace.mspPairId, trace])),
    ),
  ).toBe(false)

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
